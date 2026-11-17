import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  bookings,
  cateringPackages,
  coupons,
  customerPreferences,
  foodCategories,
  foodItems,
  reviews,
} from '../../db/schema.ts';
import { optionalAuth, requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { calculateBookingPricing } from '../../utils/pricing.ts';
import {
  analyzeReviewsWithAI,
  chatWithCaterEaseAI,
  estimateFoodQuantities,
  GeminiUnavailableError,
  generateBudgetTipsWithAI,
  generateEventPlanWithAI,
  recommendMenuWithAI,
  searchCulinaryInsightsWithAI,
} from '../services/geminiService.ts';

const router = Router();

function sendAiError(res: any, err: unknown) {
  if (err instanceof GeminiUnavailableError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, aiUnavailable: true });
  }
  console.error('AI route error:', err);
  return res.status(500).json({ success: false, message: 'CaterEase AI encountered an unexpected error.' });
}

// Feature 1: Food Quantity Estimator
router.post('/quantity-estimator', async (req, res) => {
  try {
    const schema = z.object({
      guests: z.number().int().min(10).max(5000),
      eventType: z.string().min(2).max(60),
      mealType: z.string().min(2).max(40),
      ageGroupDistribution: z.string().max(150).optional(),
      durationHours: z.number().min(1).max(16).default(4),
      foodPreferences: z.string().min(2).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const result = await estimateFoodQuantities(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 2: AI Menu Recommendation
router.post('/menu-recommendation', async (req, res) => {
  try {
    const schema = z.object({
      guests: z.number().int().min(10).max(5000),
      budget: z.number().positive(),
      eventType: z.string().min(2).max(60),
      preferences: z.string().min(2).max(200),
      dietaryRestrictions: z.string().max(200).default('None'),
      cuisine: z.string().max(100).default('Indian & Fusion'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const items = await db
      .select({
        id: foodItems.id,
        name: foodItems.name,
        category: foodCategories.name,
        price: foodItems.price,
        dietaryType: foodItems.dietaryType,
      })
      .from(foodItems)
      .innerJoin(foodCategories, eq(foodItems.categoryId, foodCategories.id))
      .where(eq(foodItems.isAvailable, true));

    const aiPlan = await recommendMenuWithAI({ ...parsed.data, catalogItems: items });
    res.json({ success: true, data: aiPlan });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 3: AI Budget Planner (Backend authoritative pricing + Gemini budget-saving tips)
router.post('/budget-planner', async (req, res) => {
  try {
    const schema = z.object({
      guests: z.number().int().min(10).max(5000),
      eventType: z.string().min(2).max(60),
      tier: z.enum(['Essential', 'Signature', 'Royal']).default('Signature'),
      includeLiveCounters: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const tierPerPlate = parsed.data.tier === 'Essential' ? 650 : parsed.data.tier === 'Signature' ? 950 : 1450;
    const serviceCharge = parsed.data.includeLiveCounters ? 7500 : 3500;

    const pricing = calculateBookingPricing({
      items: [{ unitPrice: serviceCharge, quantity: 1 }],
      packageInput: { pricePerPerson: tierPerPlate, guestCount: parsed.data.guests, minGuests: 10 },
    });

    const foodCost = pricing.packageSubtotal;
    let aiAdvice: { summary: string; savingSuggestions: string[] } | null = null;
    let aiWarning: string | undefined;

    try {
      aiAdvice = await generateBudgetTipsWithAI({
        guests: parsed.data.guests,
        eventType: parsed.data.eventType,
        tier: parsed.data.tier,
        estimatedFoodCost: foodCost,
        serviceCharge,
        deliveryCharge: pricing.deliveryCharge,
        taxAmount: pricing.taxAmount,
        estimatedTotal: pricing.totalAmount,
      });
    } catch (aiErr) {
      aiWarning = aiErr instanceof Error ? aiErr.message : 'AI tips unavailable.';
    }

    res.json({
      success: true,
      data: {
        breakdown: {
          foodCost,
          serviceCharges: serviceCharge,
          deliveryCharges: pricing.deliveryCharge,
          taxes: pricing.taxAmount,
          estimatedTotal: pricing.totalAmount,
          perGuestEffective: Math.round(pricing.totalAmount / parsed.data.guests),
        },
        aiAdvice,
        ...(aiWarning ? { aiWarning } : {}),
      },
    });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 4: AI Catering Chatbot (Multi-turn, Multi-model, Optional Search Grounding)
router.post('/chat', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      message: z.string().min(1).max(2000),
      mode: z.enum(['fast', 'general', 'deep']).default('general'),
      useSearchGrounding: z.boolean().default(false),
      customSystemInstruction: z.string().max(600).optional(),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'model']),
            text: z.string(),
          })
        )
        .max(40)
        .default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

    const [pkgRows, catRows, couponRows] = await Promise.all([
      db
        .select({
          name: cateringPackages.name,
          eventType: cateringPackages.eventType,
          pricePerPerson: cateringPackages.pricePerPerson,
          minGuests: cateringPackages.minGuests,
        })
        .from(cateringPackages)
        .where(eq(cateringPackages.isAvailable, true)),
      db.select({ name: foodCategories.name }).from(foodCategories),
      db.select({ code: coupons.code, description: coupons.description }).from(coupons).where(eq(coupons.isActive, true)),
    ]);

    let userBookings;
    if (req.authUser?.customerId) {
      userBookings = await db
        .select({
          bookingCode: bookings.bookingCode,
          eventName: bookings.eventName,
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
          totalAmount: bookings.totalAmount,
        })
        .from(bookings)
        .where(eq(bookings.customerId, req.authUser.customerId))
        .orderBy(desc(bookings.createdAt))
        .limit(5);
    }

    const result = await chatWithCaterEaseAI({
      message: parsed.data.message,
      history: parsed.data.history,
      mode: parsed.data.mode,
      useSearchGrounding: parsed.data.useSearchGrounding,
      customSystemInstruction: parsed.data.customSystemInstruction,
      contextData: {
        packages: pkgRows,
        categories: catRows.map((c) => c.name),
        activeCoupons: couponRows,
        userBookings,
      },
    });

    res.json({ success: true, data: result });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 4B: Live Google Search Grounded Culinary & Event Insights
router.post('/search-insights', async (req, res) => {
  try {
    const schema = z.object({
      query: z.string().min(3).max(400),
      region: z.string().max(100).optional(),
      eventType: z.string().max(60).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Please enter a valid research query (min 3 chars).' });
    }

    const insights = await searchCulinaryInsightsWithAI(parsed.data);
    res.json({ success: true, data: insights });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 5: AI Review Analysis (Admin)
router.post('/review-analysis', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const reviewRows = await db
      .select({
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
      })
      .from(reviews)
      .orderBy(desc(reviews.createdAt))
      .limit(40);

    if (reviewRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No customer reviews available to analyze yet.' });
    }

    const analysis = await analyzeReviewsWithAI(reviewRows);
    res.json({ success: true, data: analysis });
  } catch (err) {
    sendAiError(res, err);
  }
});

// Feature 6: Personalized Food Recommendations (Privacy-respecting customer profile lookup)
router.get('/personalized-food', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select({
        id: foodItems.id,
        name: foodItems.name,
        description: foodItems.description,
        price: foodItems.price,
        dietaryType: foodItems.dietaryType,
        isGlutenFree: foodItems.isGlutenFree,
        imageUrl: foodItems.imageUrl,
        categoryName: foodCategories.name,
      })
      .from(foodItems)
      .innerJoin(foodCategories, eq(foodItems.categoryId, foodCategories.id))
      .where(eq(foodItems.isAvailable, true));

    let prefNote = 'Featured culinary favorites across categories';
    let filtered = items;

    if (req.authUser?.customerId) {
      const [prefs] = await db
        .select()
        .from(customerPreferences)
        .where(eq(customerPreferences.customerId, req.authUser.customerId))
        .limit(1);

      if (prefs) {
        prefNote = `Tailored for your ${prefs.preferredCuisine || 'curated'} & ${prefs.dietaryRestrictions || 'balanced'} preferences`;
        const restriction = (prefs.dietaryRestrictions || '').toLowerCase();
        if (restriction.includes('jain')) {
          const jainMatches = items.filter((i) => i.dietaryType === 'Jain' || i.dietaryType === 'Veg');
          if (jainMatches.length > 0) filtered = jainMatches;
        } else if (restriction.includes('vegan')) {
          const veganMatches = items.filter((i) => i.dietaryType === 'Vegan');
          if (veganMatches.length > 0) filtered = veganMatches;
        }
      }
    }

    res.json({
      success: true,
      data: {
        rationale: prefNote,
        items: filtered.slice(0, 4),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load recommendations.' });
  }
});

// Feature 7: AI Event Planner
router.post('/event-planner', async (req, res) => {
  try {
    const schema = z.object({
      eventType: z.string().min(2).max(60),
      guests: z.number().int().min(10).max(5000),
      venueType: z.string().min(2).max(80),
      mealSlot: z.string().min(2).max(60),
      notes: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const plan = await generateEventPlanWithAI(parsed.data);
    res.json({ success: true, data: plan });
  } catch (err) {
    sendAiError(res, err);
  }
});

export default router;
