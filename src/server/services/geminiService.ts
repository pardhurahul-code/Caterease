import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 15000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiUnavailableError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms = 18000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new GeminiUnavailableError('Gemini AI request timed out. Please try again in a moment.', 504));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

function handleGeminiError(err: unknown): never {
  if (err instanceof GeminiUnavailableError) {
    throw err;
  }
  const message = err instanceof Error ? err.message : 'Gemini AI service error';
  if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID') || message.includes('403') || message.includes('400')) {
    throw new GeminiUnavailableError(
      'Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.',
      403
    );
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    throw new GeminiUnavailableError(
      'Gemini API rate limit reached. Please try again shortly or upgrade your API tier.',
      429
    );
  }
  if (message.includes('UNAVAILABLE') || message.includes('503') || message.includes('high demand')) {
    throw new GeminiUnavailableError(
      'Gemini AI is temporarily experiencing high demand. Please retry in a few moments.',
      503
    );
  }
  throw new GeminiUnavailableError(`CaterEase AI could not process the request: ${message}`, 502);
}

export async function estimateFoodQuantities(input: {
  guests: number;
  eventType: string;
  mealType: string;
  ageGroupDistribution?: string;
  durationHours: number;
  foodPreferences: string;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable live Gemini AI estimation.'
    );
  }

  const prompt = `You are a master executive catering chef and event planner for CaterEase.
Calculate practical, realistic catering food quantities for:
- Guests: ${input.guests}
- Event Type: ${input.eventType}
- Meal Type: ${input.mealType}
- Age Group Distribution: ${input.ageGroupDistribution || 'Balanced adults and families'}
- Event Duration: ${input.durationHours} hours
- Dietary & Food Preferences: ${input.foodPreferences}

Return realistic weights (kg), piece counts, and beverage liters including a sensible buffer (usually 8-12%) to avoid shortages while preventing heavy waste.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riceQuantity: { type: Type.STRING, description: 'Recommended rice/biryani quantity with unit (e.g., 24 kg uncooked / ~60 kg cooked)' },
              startersQuantity: { type: Type.STRING, description: 'Total starter pieces and weight (e.g., 600 pieces across 3 varieties)' },
              mainCourseQuantity: { type: Type.STRING, description: 'Main course gravies/curries & breads quantity' },
              dessertsQuantity: { type: Type.STRING, description: 'Dessert portions/weight' },
              beverageQuantity: { type: Type.STRING, description: 'Beverage volume in liters and glasses' },
              approximateServings: { type: Type.INTEGER, description: 'Total effective servings including buffer' },
              suggestedBufferPercent: { type: Type.INTEGER, description: 'Recommended safety buffer percentage' },
              assumptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Clear culinary planning assumptions used for the calculation',
              },
              chefTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Practical execution tips for zero waste and smooth service',
              },
            },
          },
        },
      })
    );
    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function recommendMenuWithAI(input: {
  guests: number;
  budget: number;
  eventType: string;
  preferences: string;
  dietaryRestrictions: string;
  cuisine: string;
  catalogItems: Array<{ id: number; name: string; category: string; price: string; dietaryType: string }>;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable AI menu recommendations.'
    );
  }

  const prompt = `Recommend a curated catering menu from CaterEase's real catalog items below.
Client requirements:
- Guests: ${input.guests}
- Target Total Budget: ₹${input.budget}
- Event Type: ${input.eventType}
- Food Preferences: ${input.preferences}
- Dietary Restrictions: ${input.dietaryRestrictions}
- Cuisine Preference: ${input.cuisine}

Available CaterEase Catalog Dishes (ONLY reference dish names & IDs from this list):
${JSON.stringify(input.catalogItems)}

Explain why each dish fits, how to split vegetarian/Jain/non-veg portions, and keep total suggested per-guest cost realistic.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              menuTitle: { type: Type.STRING },
              summary: { type: Type.STRING },
              recommendedItemIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              coursePlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    course: { type: Type.STRING },
                    dishName: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                },
              },
              dietaryNotes: { type: Type.STRING },
            },
          },
        },
      })
    );
    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function generateBudgetTipsWithAI(input: {
  guests: number;
  eventType: string;
  tier: string;
  estimatedFoodCost: number;
  serviceCharge: number;
  deliveryCharge: number;
  taxAmount: number;
  estimatedTotal: number;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable AI budget advice.'
    );
  }

  const prompt = `Provide 4 concrete, actionable catering budget-saving tips for a ${input.guests}-guest ${input.eventType} (${input.tier} tier) with an estimated backend-calculated total of ₹${input.estimatedTotal} (food ₹${input.estimatedFoodCost}, service ₹${input.serviceCharge}, delivery ₹${input.deliveryCharge}, tax ₹${input.taxAmount}). Never change the numbers above; give practical culinary and logistics optimizations.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              savingSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      })
    );
    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    handleGeminiError(err);
  }
}

export type ChatModelTier = 'fast' | 'general' | 'deep';

function extractGroundingSources(response: any): Array<{ title: string; uri: string }> {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const out: Array<{ title: string; uri: string }> = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (typeof uri === 'string' && uri.startsWith('http') && !seen.has(uri)) {
      seen.add(uri);
      out.push({
        uri,
        title: typeof title === 'string' && title.trim() ? title.trim() : uri,
      });
    }
  }
  return out;
}

export async function chatWithCaterEaseAI(input: {
  message: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  mode?: ChatModelTier;
  useSearchGrounding?: boolean;
  customSystemInstruction?: string;
  contextData: {
    packages: Array<{ name: string; eventType: string; pricePerPerson: string; minGuests: number }>;
    categories: string[];
    activeCoupons: Array<{ code: string; description: string }>;
    userBookings?: Array<{ bookingCode: string; eventName: string; status: string; paymentStatus: string; totalAmount: string }>;
  };
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to chat with CaterEase AI.'
    );
  }

  const mode: ChatModelTier = input.mode || 'general';
  const modelId = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
  const enableSearch = Boolean(input.useSearchGrounding) && mode !== 'fast';

  const roleDirective = input.customSystemInstruction?.trim()
    ? `\nAdditional Persona Guidance: ${input.customSystemInstruction.trim()}\n`
    : '';

  const systemInstruction = `You are "CaterEase AI — Your Smart Catering Assistant".${roleDirective}
Answer questions about CaterEase's catering services, packages, food items, booking workflow (Pending -> Confirmed -> Preparing -> Ready for Delivery -> Event in Progress -> Completed), payment procedures (UPI, Card, Cash, Razorpay / Demo Payment Mode), dietary options (Veg, Non-Veg, Vegan, Jain, Gluten-Free), and event planning.
CRITICAL GROUNDING RULE: Only cite package prices, coupons, and booking statuses provided in the verified application context below. NEVER invent package prices, fake booking statuses, or payment confirmations. If web search grounding is active for seasonal ingredients, regional etiquette, or external hospitality trends, cite verifiable facts concisely.

Verified Application Context:
- Categories: ${input.contextData.categories.join(', ')}
- Catering Packages: ${JSON.stringify(input.contextData.packages)}
- Active Coupons: ${JSON.stringify(input.contextData.activeCoupons)}
${input.contextData.userBookings ? `- Signed-in User Bookings: ${JSON.stringify(input.contextData.userBookings)}` : '- User is browsing as guest.'}`;

  try {
    const thinkingConfig =
      mode === 'fast'
        ? { thinkingLevel: ThinkingLevel.MINIMAL }
        : mode === 'deep'
          ? { thinkingLevel: ThinkingLevel.HIGH }
          : { thinkingLevel: ThinkingLevel.LOW };

    const chat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction,
        thinkingConfig,
        ...(enableSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
      history: input.history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
    });
    const response = await withTimeout(chat.sendMessage({ message: input.message }), mode === 'deep' ? 25000 : 18000);
    return {
      reply: response.text ?? 'I am ready to help plan your catering event.',
      modelUsed: modelId,
      sources: extractGroundingSources(response),
    };
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function searchCulinaryInsightsWithAI(input: {
  query: string;
  region?: string;
  eventType?: string;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to use Google Search Grounding.'
    );
  }

  const prompt = `Research current, accurate real-world information for a catering & hospitality planner.
Topic / Query: ${input.query}
${input.region ? `Target City / Region: ${input.region}` : ''}
${input.eventType ? `Event Context: ${input.eventType}` : ''}

Provide a structured, practical hospitality brief with clear bullet points covering seasonal produce availability, regional dining expectations, food safety/weather considerations, or cultural calendar notes grounded in verified web sources.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      }),
      22000
    );

    return {
      answer: response.text ?? 'No grounded insights returned for this query.',
      modelUsed: 'gemini-4-hydrogen',
      sources: extractGroundingSources(response),
    };
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function analyzeReviewsWithAI(
  reviewList: Array<{ rating: number; title: string; comment: string }>
) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to run AI review analysis.'
    );
  }

  const prompt = `Analyze these real CaterEase customer reviews and summarize strengths, pain points, satisfaction rate, and concrete operational improvements:
${JSON.stringify(reviewList)}`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              satisfactionSummary: { type: Type.STRING },
              overallSentiment: { type: Type.STRING },
              positiveHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              negativeFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
              commonComplaints: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      })
    );
    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function generateEventPlanWithAI(input: {
  eventType: string;
  guests: number;
  venueType: string;
  mealSlot: string;
  notes?: string;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to generate AI event plans.'
    );
  }

  const prompt = `Create a structured end-to-end catering execution blueprint for:
- Event Type: ${input.eventType}
- Guest Count: ${input.guests}
- Venue Setting: ${input.venueType}
- Meal Slot: ${input.mealSlot}
- Special Notes: ${input.notes || 'Standard premium hospitality'}`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planTitle: { type: Type.STRING },
              serviceStyle: { type: Type.STRING },
              recommendedStaffCount: { type: Type.INTEGER },
              runOfShow: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeOffset: { type: Type.STRING },
                    milestone: { type: Type.STRING },
                    owner: { type: Type.STRING },
                  },
                },
              },
              stationLayout: { type: Type.ARRAY, items: { type: Type.STRING } },
              checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      })
    );
    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    handleGeminiError(err);
  }
}
