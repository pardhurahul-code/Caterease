import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChefHat, ShoppingBag, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatINR } from '../services/api';
import { useCart } from '../context/CartContext';

interface CatalogDish {
  id: number;
  name: string;
  price: string;
  unit: string;
  dietaryType: string;
  isGlutenFree: boolean;
  allergens: string;
  categoryName?: string;
  imageUrl?: string | null;
}

const COURSE_BUCKETS = [
  { id: 'starters', label: '1. Starters & Chaat', match: ['starter', 'appetizer', 'chaat', 'snack', 'tikka', 'canape'] },
  { id: 'rice', label: '3. Biryani & Breads', match: ['biryani', 'rice', 'pulao', 'bread', 'roti', 'naan', 'kulcha'] },
  { id: 'desserts', label: '4. Desserts & Beverages', match: ['dessert', 'sweet', 'rasmalai', 'panna cotta', 'beverage', 'drink', 'cooler', 'tea', 'coffee'] },
  { id: 'mains', label: '2. Signature Mains', match: ['main', 'curry', 'gravy', 'course', 'dal', 'paneer'] },
];

const DISPLAY_ORDER = [
  { id: 'starters', label: '1. Starters & Chaat' },
  { id: 'mains', label: '2. Signature Mains' },
  { id: 'rice', label: '3. Biryani & Breads' },
  { id: 'desserts', label: '4. Desserts & Beverages' },
];

function classifyDish(categoryName = '', dishName = ''): string {
  const lower = `${categoryName} ${dishName}`.toLowerCase();
  for (const bucket of COURSE_BUCKETS) {
    if (bucket.match.some((m) => lower.includes(m))) {
      return bucket.id;
    }
  }
  return 'mains';
}

export function CustomMenuBuilder() {
  const [dishes, setDishes] = useState<CatalogDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(80);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dietFilter, setDietFilter] = useState<'All' | 'Veg' | 'Jain' | 'Vegan'>('All');

  const { addItem, clearCart, setGuestCount: setCartGuestCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api
      .get('/catalog')
      .then((res) => {
        if (active) setDishes(res.data.data || []);
      })
      .catch(() => {
        if (active) toast.error('Could not load dishes for custom menu builder.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredDishes = useMemo(() => {
    if (dietFilter === 'All') return dishes;
    return dishes.filter((d) => d.dietaryType === dietFilter);
  }, [dishes, dietFilter]);

  const groupedByCourse = useMemo(() => {
    const map: Record<string, CatalogDish[]> = {
      starters: [],
      mains: [],
      rice: [],
      desserts: [],
    };
    for (const d of filteredDishes) {
      map[classifyDish(d.categoryName, d.name)].push(d);
    }
    return map;
  }, [filteredDishes]);

  const selectedDishes = useMemo(
    () => dishes.filter((d) => selectedIds.includes(d.id)),
    [dishes, selectedIds]
  );

  const perPlateSum = selectedDishes.reduce((sum, d) => sum + Number(d.price), 0);
  const estimatedSubtotal = perPlateSum * guestCount;

  const toggleDish = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCheckoutCustomMenu = () => {
    if (selectedDishes.length < 2) {
      toast.error('Select at least 2 dishes across courses to build your custom menu.');
      return;
    }
    clearCart();
    setCartGuestCount(guestCount);
    for (const dish of selectedDishes) {
      addItem(
        {
          foodItemId: dish.id,
          name: dish.name,
          price: Number(dish.price),
          unit: dish.unit || 'per plate',
          dietaryType: dish.dietaryType,
          imageUrl: dish.imageUrl || undefined,
        },
        guestCount
      );
    }
    toast.success(`Custom ${selectedDishes.length}-dish menu (${guestCount} portions each) added to cart.`);
    navigate('/checkout');
  };

  return (
    <section
      id="custom-menu-builder"
      className="mt-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
            <ChefHat className="w-4 h-4" /> Interactive Multi-Course Planner
          </div>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Custom Menu Builder
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Curate your own multi-course spread across starters, mains, biryanis, and desserts with instant per-plate totals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="builder-guests" className="block text-[11px] font-medium text-stone-500 mb-1">
              Guest Count
            </label>
            <div className="relative">
              <Users className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="builder-guests"
                type="number"
                min={10}
                max={2000}
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(10, Number(e.target.value) || 10))}
                className="w-28 pl-8 pr-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-xs font-semibold tabular-nums"
              />
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-stone-500 mb-1">Dietary Filter</span>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              {(['All', 'Veg', 'Jain', 'Vegan'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDietFilter(opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                    dietFilter === opt
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-48 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {DISPLAY_ORDER.map((bucket) => {
            const list = groupedByCourse[bucket.id] || [];
            return (
              <div
                key={bucket.id}
                className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex flex-col"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 mb-3">
                  {bucket.label}
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
                  {list.length === 0 ? (
                    <p className="text-xs text-stone-500">No dishes match this filter.</p>
                  ) : (
                    list.map((dish) => {
                      const active = selectedIds.includes(dish.id);
                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => toggleDish(dish.id)}
                          aria-pressed={active}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-start justify-between gap-2 ${
                            active
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-600 text-stone-900 dark:text-stone-100'
                              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-400'
                          }`}
                        >
                          <div>
                            <div className="font-semibold leading-snug">{dish.name}</div>
                            <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                              {dish.dietaryType} · {formatINR(dish.price)}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                              active
                                ? 'bg-amber-700 text-white'
                                : 'border border-stone-300 dark:border-stone-700'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-stone-900 dark:text-stone-100">
            Selected: {selectedDishes.length} dishes · {formatINR(perPlateSum)} per guest
          </div>
          <div className="text-stone-600 dark:text-stone-400 tabular-nums">
            Estimated Food Subtotal ({guestCount} guests):{' '}
            <strong className="text-stone-900 dark:text-stone-100">{formatINR(estimatedSubtotal)}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCheckoutCustomMenu}
          disabled={selectedDishes.length < 2}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold disabled:opacity-50"
        >
          <ShoppingBag className="w-4 h-4" />
          Add Custom Menu to Cart & Checkout
        </button>
      </div>
    </section>
  );
}
