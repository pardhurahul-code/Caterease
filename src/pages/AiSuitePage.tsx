import React, { useEffect, useState } from 'react';
import {
  Bot,
  Calculator,
  CalendarClock,
  ExternalLink,
  Globe,
  IndianRupee,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, formatINR } from '../services/api';
import { useCart } from '../context/CartContext';
import {
  appendChatMessageToFirestore,
  auth,
  type ChatSessionRecord,
  listChatSessions,
  loadChatSessionMessages,
  upsertChatSession,
} from '../lib/firebase';

type AiTab = 'quantity' | 'menu' | 'budget' | 'event' | 'chat' | 'search';
type ChatMode = 'fast' | 'general' | 'deep';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  sources?: Array<{ title: string; uri: string }>;
}

const PERSONA_PRESETS: Array<{ id: string; label: string; instruction: string }> = [
  {
    id: 'concierge',
    label: 'Hospitality Concierge',
    instruction: 'Provide warm, crisp booking, package, and dietary guidance.',
  },
  {
    id: 'dietary',
    label: 'Jain & Allergen Chef',
    instruction: 'Focus strictly on zero-cross-contamination Jain (no onion/garlic), Vegan, and Gluten-Free kitchen workflows.',
  },
  {
    id: 'corporate',
    label: 'Corporate Logistics Lead',
    instruction: 'Prioritize punctuality, buffet throughput per minute, chafing setup footprint, and GST invoicing clarity.',
  },
];

export function AiSuitePage() {
  const [activeTab, setActiveTab] = useState<AiTab>('quantity');
  const { addItem } = useCart();

  // 1. Quantity Estimator state
  const [qtyForm, setQtyForm] = useState({
    guests: 150,
    eventType: 'Wedding',
    mealType: 'Dinner',
    ageGroupDistribution: '80% Adults, 20% Children & Elders',
    durationHours: 4,
    foodPreferences: '60% Vegetarian, 30% Non-Veg, 10% Jain',
  });
  const [qtyResult, setQtyResult] = useState<any | null>(null);
  const [qtyLoading, setQtyLoading] = useState(false);

  // 2. Menu Recommender state
  const [menuForm, setMenuForm] = useState({
    guests: 100,
    budget: 95000,
    eventType: 'Engagement',
    preferences: 'Signature starters, saffron biryani, rich desserts',
    dietaryRestrictions: 'Include Vegan & Jain friendly dishes',
    cuisine: 'North & South Indian Fusion',
  });
  const [menuResult, setMenuResult] = useState<any | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);

  // 3. Budget Planner state
  const [budgetForm, setBudgetForm] = useState({
    guests: 120,
    eventType: 'Corporate',
    tier: 'Signature' as 'Essential' | 'Signature' | 'Royal',
    includeLiveCounters: true,
  });
  const [budgetResult, setBudgetResult] = useState<any | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // 4. Event Planner state
  const [eventForm, setEventForm] = useState({
    eventType: 'Wedding',
    guests: 200,
    venueType: 'Hotel Ballroom & Lawn',
    mealSlot: 'Evening Gala Dinner',
    notes: 'Live chaat counter and welcome drinks at 7 PM',
  });
  const [eventResult, setEventResult] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  // 5. Multi-Turn Chatbot state
  const [chatSessionId, setChatSessionId] = useState<string>(() => `session_${Date.now()}`);
  const [savedSessions, setSavedSessions] = useState<ChatSessionRecord[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>('general');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(true);
  const [personaId, setPersonaId] = useState<string>('concierge');
  const [customInstruction, setCustomInstruction] = useState<string>(PERSONA_PRESETS[0].instruction);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: 'Hello! I am CaterEase AI — Your Smart Catering Assistant. Choose a reasoning mode, toggle Google Search Grounding for seasonal/event trends, or ask about packages, Jain menus, coupons, and bookings.',
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 6. Live Google Search Grounding Insights state
  const [searchForm, setSearchForm] = useState({
    query: 'Trending seasonal Indian wedding desserts and monsoon banquet precautions',
    region: 'Mumbai & Bengaluru, India',
    eventType: 'Wedding',
  });
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    modelUsed: string;
    sources: Array<{ title: string; uri: string }>;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) return;
    listChatSessions(fbUser.uid)
      .then((sessions) => setSavedSessions(sessions))
      .catch(() => {
        // Non-blocking if user has no sessions yet or not Google signed in
      });
  }, []);

  const handleQuantitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQtyLoading(true);
    try {
      const res = await api.post('/ai/quantity-estimator', qtyForm);
      setQtyResult(res.data.data);
      toast.success('AI food quantity estimate generated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not generate quantity estimate.');
    } finally {
      setQtyLoading(false);
    }
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuLoading(true);
    try {
      const res = await api.post('/ai/menu-recommendation', menuForm);
      setMenuResult(res.data.data);
      toast.success('Menu recommendation ready.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not generate menu recommendations.');
    } finally {
      setMenuLoading(false);
    }
  };

  const handleAddRecommendedDishes = async () => {
    if (!menuResult?.recommendedItemIds?.length) return;
    try {
      const catRes = await api.get('/catalog');
      const catalog: any[] = catRes.data.data || [];
      let addedCount = 0;
      for (const id of menuResult.recommendedItemIds) {
        const dish = catalog.find((c) => c.id === id);
        if (dish) {
          addItem(
            {
              foodItemId: dish.id,
              name: dish.name,
              price: Number(dish.price),
              unit: dish.unit,
              dietaryType: dish.dietaryType,
              imageUrl: dish.imageUrl,
            },
            Math.max(10, Math.round(menuForm.guests * 0.5))
          );
          addedCount += 1;
        }
      }
      toast.success(`Added ${addedCount} AI-recommended dishes to your cart.`);
    } catch {
      toast.error('Failed to add recommended dishes to cart.');
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetLoading(true);
    try {
      const res = await api.post('/ai/budget-planner', budgetForm);
      setBudgetResult(res.data.data);
      if (res.data.data.aiWarning) {
        toast.warning(res.data.data.aiWarning);
      } else {
        toast.success('Budget estimate & AI saving advice ready.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Budget calculation failed.');
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventLoading(true);
    try {
      const res = await api.post('/ai/event-planner', eventForm);
      setEventResult(res.data.data);
      toast.success('Event catering blueprint created.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not generate event plan.');
    } finally {
      setEventLoading(false);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const nextHistory: ChatTurn[] = [...chatHistory, { role: 'user', text: msg }];
    setChatHistory(nextHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: msg,
        mode: chatMode,
        useSearchGrounding: chatMode !== 'fast' && useSearchGrounding,
        customSystemInstruction: customInstruction,
        history: chatHistory.slice(-16).map((h) => ({ role: h.role, text: h.text })),
      });
      const replyData = res.data.data;
      const modelTurn: ChatTurn = {
        role: 'model',
        text: replyData.reply,
        modelUsed: replyData.modelUsed,
        sources: replyData.sources || [],
      };
      setChatHistory([...nextHistory, modelTurn]);

      // Persist multi-turn conversation to Firestore for verified Google-authenticated users
      const fbUser = auth.currentUser;
      if (fbUser && fbUser.emailVerified) {
        await upsertChatSession(fbUser.uid, {
          sessionId: chatSessionId,
          title: msg.slice(0, 60),
          modelTier: chatMode,
          searchEnabled: chatMode !== 'fast' && useSearchGrounding,
          systemInstruction: customInstruction,
        });
        await appendChatMessageToFirestore(fbUser.uid, chatSessionId, {
          messageId: `u_${Date.now()}`,
          role: 'user',
          text: msg,
        });
        await appendChatMessageToFirestore(fbUser.uid, chatSessionId, {
          messageId: `m_${Date.now() + 1}`,
          role: 'model',
          text: modelTurn.text,
          modelUsed: modelTurn.modelUsed,
          groundingUrls: (modelTurn.sources || []).map((s) => s.uri),
        });
        listChatSessions(fbUser.uid).then(setSavedSessions).catch(() => {});
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'CaterEase AI could not respond right now.';
      setChatHistory([...nextHistory, { role: 'model', text: errMsg }]);
      toast.error(errMsg);
    } finally {
      setChatLoading(false);
    }
  };

  const handleLoadSavedSession = async (session: ChatSessionRecord) => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) return;
    try {
      const msgs = await loadChatSessionMessages(fbUser.uid, session.sessionId);
      setChatSessionId(session.sessionId);
      setChatMode(session.modelTier);
      setUseSearchGrounding(session.searchEnabled);
      if (session.systemInstruction) setCustomInstruction(session.systemInstruction);
      setChatHistory(
        msgs.length > 0
          ? msgs.map((m) => ({
              role: m.role,
              text: m.text,
              modelUsed: m.modelUsed,
              sources: (m.groundingUrls || []).map((uri) => ({ title: uri, uri })),
            }))
          : [
              {
                role: 'model',
                text: `Resumed session "${session.title}". Ask your next question below.`,
              },
            ]
      );
      toast.success('Loaded conversation from Firestore.');
    } catch {
      toast.error('Failed to load conversation history.');
    }
  };

  const handleNewChatSession = () => {
    setChatSessionId(`session_${Date.now()}`);
    setChatHistory([
      {
        role: 'model',
        text: 'Started a fresh CaterEase AI conversation. Choose your model mode and ask away!',
        modelUsed: chatMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
      },
    ]);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchForm.query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.post('/ai/search-insights', searchForm);
      setSearchResult(res.data.data);
      toast.success('Live Google Search grounded insights ready.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not fetch Google Search insights.');
    } finally {
      setSearchLoading(false);
    }
  };

  const tabs: Array<{ id: AiTab; label: string; icon: any }> = [
    { id: 'quantity', label: 'Quantity Estimator', icon: Calculator },
    { id: 'menu', label: 'AI Menu Recommender', icon: UtensilsCrossed },
    { id: 'budget', label: 'Budget Planner', icon: IndianRupee },
    { id: 'event', label: 'AI Event Planner', icon: CalendarClock },
    { id: 'search', label: 'Web Search Trends', icon: Globe },
    { id: 'chat', label: 'AI Catering Chatbot', icon: Bot },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-8 border-b border-stone-200 dark:border-stone-800">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
          CaterEase AI — Your Smart Catering Assistant
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
          AI Event & Culinary Planning Suite
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          Powered by Google Gemini on the backend with real CaterEase catalog, pricing, and booking context.
        </p>

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'bg-amber-700 text-white'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Food Quantity Estimator */}
      {activeTab === 'quantity' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleQuantitySubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 h-fit"
          >
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Food Quantity Estimator
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="qty-guests" className="block text-xs font-medium mb-1">Guest Count</label>
                <input
                  id="qty-guests"
                  type="number"
                  min={10}
                  max={5000}
                  value={qtyForm.guests}
                  onChange={(e) => setQtyForm({ ...qtyForm, guests: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="qty-duration" className="block text-xs font-medium mb-1">Duration (hours)</label>
                <input
                  id="qty-duration"
                  type="number"
                  min={1}
                  max={16}
                  value={qtyForm.durationHours}
                  onChange={(e) => setQtyForm({ ...qtyForm, durationHours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="qty-event" className="block text-xs font-medium mb-1">Event Type</label>
                <select
                  id="qty-event"
                  value={qtyForm.eventType}
                  onChange={(e) => setQtyForm({ ...qtyForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  {['Wedding', 'Corporate', 'Birthday', 'Engagement', 'Housewarming', 'Festival', 'Family Function'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qty-meal" className="block text-xs font-medium mb-1">Meal Type</label>
                <select
                  id="qty-meal"
                  value={qtyForm.mealType}
                  onChange={(e) => setQtyForm({ ...qtyForm, mealType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  {['Breakfast', 'Lunch', 'Dinner', 'High Tea & Snacks'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="qty-age" className="block text-xs font-medium mb-1">Age Group Distribution</label>
              <input
                id="qty-age"
                type="text"
                value={qtyForm.ageGroupDistribution}
                onChange={(e) => setQtyForm({ ...qtyForm, ageGroupDistribution: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label htmlFor="qty-prefs" className="block text-xs font-medium mb-1">Dietary & Food Preferences</label>
              <textarea
                id="qty-prefs"
                rows={2}
                value={qtyForm.foodPreferences}
                onChange={(e) => setQtyForm({ ...qtyForm, foodPreferences: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={qtyLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {qtyLoading ? 'Calculating Quantities...' : 'Estimate Food Quantities'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {!qtyResult ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-stone-500 dark:text-stone-400">
                <Calculator className="w-8 h-8 mb-3 text-amber-700/60" />
                <p className="font-medium text-stone-900 dark:text-stone-200">No estimate calculated yet</p>
                <p className="text-xs mt-1 max-w-sm">
                  Enter your guest count and preferences to generate editable dish weights, servings, and buffer quantities.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <h3 className="font-semibold text-stone-900 dark:text-stone-100">Recommended Culinary Quantities</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      You can directly edit any quantity field below to customize your prep sheet.
                    </p>
                  </div>
                  <div className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-400 tabular-nums">
                    ~{qtyResult.approximateServings} servings · +{qtyResult.suggestedBufferPercent}% buffer
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['riceQuantity', 'Rice / Biryani Quantity'],
                    ['startersQuantity', 'Starters & Appetizers'],
                    ['mainCourseQuantity', 'Main Course & Breads'],
                    ['dessertsQuantity', 'Desserts & Mithai'],
                    ['beverageQuantity', 'Beverages & Coolers'],
                  ].map(([field, label]) => (
                    <div key={field} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">{label}</label>
                      <input
                        type="text"
                        value={qtyResult[field] || ''}
                        onChange={(e) => setQtyResult({ ...qtyResult, [field]: e.target.value })}
                        className="w-full bg-transparent text-sm font-semibold text-stone-900 dark:text-stone-100 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">Planning Assumptions</h4>
                    <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                      {(qtyResult.assumptions || []).map((a: string) => (
                        <li key={a}>• {a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">Chef Execution Tips</h4>
                    <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                      {(qtyResult.chefTips || []).map((tip: string) => (
                        <li key={tip}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. AI Menu Recommender */}
      {activeTab === 'menu' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleMenuSubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 h-fit"
          >
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">AI Menu Recommender</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Guest Count</label>
                <input
                  type="number"
                  min={10}
                  value={menuForm.guests}
                  onChange={(e) => setMenuForm({ ...menuForm, guests: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Target Budget (₹)</label>
                <input
                  type="number"
                  min={2000}
                  value={menuForm.budget}
                  onChange={(e) => setMenuForm({ ...menuForm, budget: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Event Type</label>
              <input
                type="text"
                value={menuForm.eventType}
                onChange={(e) => setMenuForm({ ...menuForm, eventType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cuisine Preference</label>
              <input
                type="text"
                value={menuForm.cuisine}
                onChange={(e) => setMenuForm({ ...menuForm, cuisine: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Dietary Restrictions</label>
              <input
                type="text"
                value={menuForm.dietaryRestrictions}
                onChange={(e) => setMenuForm({ ...menuForm, dietaryRestrictions: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Flavor & Course Preferences</label>
              <textarea
                rows={2}
                value={menuForm.preferences}
                onChange={(e) => setMenuForm({ ...menuForm, preferences: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={menuLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {menuLoading ? 'Curating Menu...' : 'Generate AI Menu'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {!menuResult ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-stone-500 dark:text-stone-400">
                <UtensilsCrossed className="w-8 h-8 mb-3 text-amber-700/60" />
                <p className="font-medium text-stone-900 dark:text-stone-200">Curate a menu from live dishes</p>
                <p className="text-xs mt-1 max-w-sm">
                  CaterEase AI selects real dishes from our PostgreSQL catalog tailored to your budget and restrictions.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                      {menuResult.menuTitle}
                    </h3>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{menuResult.summary}</p>
                  </div>
                  {menuResult.recommendedItemIds?.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddRecommendedDishes}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Add Dishes to Cart
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {(menuResult.coursePlan || []).map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                    >
                      <div className="text-xs font-medium text-amber-800 dark:text-amber-400">{c.course}</div>
                      <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 mt-0.5">{c.dishName}</div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{c.rationale}</p>
                    </div>
                  ))}
                </div>
                {menuResult.dietaryNotes && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 pt-2">
                    <strong>Dietary Strategy:</strong> {menuResult.dietaryNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. AI Budget Planner */}
      {activeTab === 'budget' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleBudgetSubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 h-fit"
          >
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">AI Budget Planner</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Guest Count</label>
              <input
                type="number"
                min={10}
                value={budgetForm.guests}
                onChange={(e) => setBudgetForm({ ...budgetForm, guests: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Event Type</label>
              <input
                type="text"
                value={budgetForm.eventType}
                onChange={(e) => setBudgetForm({ ...budgetForm, eventType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Hospitality Tier</label>
              <select
                value={budgetForm.tier}
                onChange={(e) => setBudgetForm({ ...budgetForm, tier: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              >
                <option value="Essential">Essential (₹650 / guest)</option>
                <option value="Signature">Signature (₹950 / guest)</option>
                <option value="Royal">Royal (₹1,450 / guest)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={budgetForm.includeLiveCounters}
                onChange={(e) => setBudgetForm({ ...budgetForm, includeLiveCounters: e.target.checked })}
                className="rounded border-stone-300 text-amber-700"
              />
              Include Live Culinary Counters (+₹7,500 service setup)
            </label>
            <button
              type="submit"
              disabled={budgetLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {budgetLoading ? 'Calculating Budget...' : 'Estimate Budget & Savings'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {!budgetResult ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-stone-500 dark:text-stone-400">
                <IndianRupee className="w-8 h-8 mb-3 text-amber-700/60" />
                <p className="font-medium text-stone-900 dark:text-stone-200">Authoritative Cost Breakdown</p>
                <p className="text-xs mt-1 max-w-sm">
                  Backend pricing calculates exact food, service, delivery, and 5% GST while Gemini suggests practical optimizations.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-500">Food Cost</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{formatINR(budgetResult.breakdown.foodCost)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-500">Service & Setup</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{formatINR(budgetResult.breakdown.serviceCharges)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-500">Delivery</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{formatINR(budgetResult.breakdown.deliveryCharges)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-500">Taxes (5% GST)</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{formatINR(budgetResult.breakdown.taxes)}</div>
                  </div>
                  <div className="col-span-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <div className="text-xs text-amber-800 dark:text-amber-300">Estimated Total ({formatINR(budgetResult.breakdown.perGuestEffective)}/guest)</div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 tabular-nums mt-1">
                      {formatINR(budgetResult.breakdown.estimatedTotal)}
                    </div>
                  </div>
                </div>

                {budgetResult.aiAdvice && (
                  <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
                    <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">AI Budget-Saving Suggestions</h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{budgetResult.aiAdvice.summary}</p>
                    <ul className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
                      {(budgetResult.aiAdvice.savingSuggestions || []).map((tip: string) => (
                        <li key={tip} className="p-3 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. AI Event Planner */}
      {activeTab === 'event' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleEventSubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 h-fit"
          >
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">AI Event Planner</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Event Type</label>
              <select
                value={eventForm.eventType}
                onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {['Wedding', 'Birthday', 'Corporate Meeting', 'Family Function', 'Festival'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Guests</label>
              <input
                type="number"
                min={10}
                value={eventForm.guests}
                onChange={(e) => setEventForm({ ...eventForm, guests: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Venue Setting</label>
              <input
                type="text"
                value={eventForm.venueType}
                onChange={(e) => setEventForm({ ...eventForm, venueType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Meal Slot</label>
              <input
                type="text"
                value={eventForm.mealSlot}
                onChange={(e) => setEventForm({ ...eventForm, mealSlot: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Special Notes</label>
              <textarea
                rows={2}
                value={eventForm.notes}
                onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={eventLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {eventLoading ? 'Generating Blueprint...' : 'Create Event Catering Plan'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {!eventResult ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-stone-500 dark:text-stone-400">
                <CalendarClock className="w-8 h-8 mb-3 text-amber-700/60" />
                <p className="font-medium text-stone-900 dark:text-stone-200">End-to-End Run of Show</p>
                <p className="text-xs mt-1 max-w-sm">
                  Get recommended staff headcount, buffet station layout, and timeline milestones.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="pb-4 border-b border-stone-200 dark:border-stone-800">
                  <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                    {eventResult.planTitle}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    {eventResult.serviceStyle} · Recommended Staff: {eventResult.recommendedStaffCount}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">Run of Show</h4>
                  <div className="space-y-2">
                    {(eventResult.runOfShow || []).map((step: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-start gap-3 text-xs">
                        <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 shrink-0">{step.timeOffset}</span>
                        <div className="flex-1">
                          <div className="font-medium text-stone-900 dark:text-stone-100">{step.milestone}</div>
                          <div className="text-stone-500 mt-0.5">Owner: {step.owner}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Station Layout</h4>
                    <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
                      {(eventResult.stationLayout || []).map((s: string) => <li key={s}>• {s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Execution Checklist</h4>
                    <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
                      {(eventResult.checklist || []).map((c: string) => <li key={c}>• {c}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Live Google Search Grounded Culinary & Event Insights */}
      {activeTab === 'search' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSearchSubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 h-fit"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Google Search Grounding
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                gemini-4-hydrogen
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Research real-time seasonal ingredients, festival dates, outdoor catering weather tips, and regional dining trends with verified web citations.
            </p>
            <div>
              <label htmlFor="search-query" className="block text-xs font-medium mb-1">Research Question</label>
              <textarea
                id="search-query"
                rows={3}
                required
                value={searchForm.query}
                onChange={(e) => setSearchForm({ ...searchForm, query: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="search-region" className="block text-xs font-medium mb-1">Region / City</label>
                <input
                  id="search-region"
                  type="text"
                  value={searchForm.region}
                  onChange={(e) => setSearchForm({ ...searchForm, region: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="search-event" className="block text-xs font-medium mb-1">Event Type</label>
                <input
                  id="search-event"
                  type="text"
                  value={searchForm.eventType}
                  onChange={(e) => setSearchForm({ ...searchForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={searchLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {searchLoading ? 'Searching Live Web Sources...' : 'Research with Google Search'}
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {!searchResult ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center text-stone-500 dark:text-stone-400">
                <Globe className="w-8 h-8 mb-3 text-amber-700/60" />
                <p className="font-medium text-stone-900 dark:text-stone-200">Real-Time Grounded Research</p>
                <p className="text-xs mt-1 max-w-sm">
                  Responses include live web source links returned directly from Gemini Google Search grounding metadata.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">Grounded Hospitality Brief</h3>
                  <span className="text-xs font-mono text-stone-500">{searchResult.modelUsed}</span>
                </div>
                <div className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                  {searchResult.answer}
                </div>
                {searchResult.sources.length > 0 && (
                  <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">
                      Verified Web Sources ({searchResult.sources.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.sources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-xs text-amber-800 dark:text-amber-400 hover:underline max-w-full truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[240px]">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Multi-Turn AI Catering Chatbot */}
      {activeTab === 'chat' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Configuration & Firestore Sessions */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700" /> Model & Behavior
                </h2>
                <button
                  type="button"
                  onClick={handleNewChatSession}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> New Thread
                </button>
              </div>

              <div>
                <label htmlFor="chat-model-select" className="block text-xs font-medium mb-1">Gemini Model Mode</label>
                <select
                  id="chat-model-select"
                  value={chatMode}
                  onChange={(e) => setChatMode(e.target.value as ChatMode)}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-medium"
                >
                  <option value="fast">Fast Q&amp;A (gemini-3.1-flash-lite)</option>
                  <option value="general">Balanced + Search (gemini-4-hydrogen)</option>
                  <option value="deep">Deep Event Planner (gemini-4-hydrogen HIGH)</option>
                </select>
              </div>

              <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer p-2.5 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <span>Enable Google Search Grounding</span>
                <input
                  type="checkbox"
                  disabled={chatMode === 'fast'}
                  checked={chatMode !== 'fast' && useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded border-stone-300 text-amber-700"
                />
              </label>

              <div>
                <label htmlFor="chat-persona-select" className="block text-xs font-medium mb-1">System Instruction Persona</label>
                <select
                  id="chat-persona-select"
                  value={personaId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPersonaId(nextId);
                    const found = PERSONA_PRESETS.find((p) => p.id === nextId);
                    if (found) setCustomInstruction(found.instruction);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs"
                >
                  {PERSONA_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  aria-label="Custom system instruction"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
              <h3 className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                Saved Cloud Conversations (Firestore)
              </h3>
              {!auth.currentUser?.emailVerified ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Sign in with Google on the Login page to automatically sync multi-turn chat history across devices.
                </p>
              ) : savedSessions.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Send a message to archive this conversation to your Cloud Firestore history.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {savedSessions.map((s) => (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => handleLoadSavedSession(s)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                        s.sessionId === chatSessionId
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Scrollable Multi-Turn Conversation */}
          <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col h-[580px]">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                  CaterEase AI — Multi-Turn Catering Concierge
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Full conversation history preserved · Grounded in PostgreSQL packages, coupons &amp; live web search.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 shrink-0">
                {chatMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatHistory.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-amber-700 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === 'model' && m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
                      {m.sources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-[11px] text-amber-800 dark:text-amber-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[180px]">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-500">
                    CaterEase AI is thinking...
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={handleChatSend}
              className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center gap-3"
            >
              <label htmlFor="ai-chat-input" className="sr-only">Ask CaterEase AI</label>
              <input
                id="ai-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about wedding packages, Jain menus, CELEBRATE15 coupon, or seasonal trends..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                aria-label="Send message to CaterEase AI"
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
