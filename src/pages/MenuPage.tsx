import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatINR } from '../services/api';
import { SafeImage } from '../components/SafeImage';
import { useCart } from '../context/CartContext';

const DIETARY_OPTIONS = ['All', 'Veg', 'Non-Veg', 'Vegan', 'Jain'];

export function MenuPage() {
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dietary, setDietary] = useState('All');
  const [glutenFreeOnly, setGlutenFreeOnly] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const { items: cartItems, addItem, updateQuantity, removeItem, totalItemCount } = useCart();

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (activeCategory !== 'All') params.set('category', activeCategory);
    if (dietary !== 'All') params.set('dietary', dietary);
    if (glutenFreeOnly) params.set('glutenFree', 'true');

    api
      .get(`/catalog?${params.toString()}`)
      .then((res) => {
        if (active) setItems(res.data.data || []);
      })
      .catch(() => {
        if (active) toast.error('Failed to load food catalog.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, activeCategory, dietary, glutenFreeOnly]);

  const getCartQty = (id: number) => cartItems.find((i) => i.foodItemId === id)?.quantity || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            Catering Food Catalog
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Filter by meal course, dietary preference, or allergens and build your custom catering menu.
          </p>
        </div>
        <Link
          to="/checkout"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold whitespace-nowrap self-start md:self-auto"
        >
          <ShoppingBag className="w-4 h-4" />
          Review Cart & Checkout ({totalItemCount})
        </Link>
      </div>

      {/* Filters Toolbar */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <label htmlFor="menu-search" className="sr-only">Search food items</label>
            <input
              id="menu-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients, or spices..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
              {DIETARY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDietary(opt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    dietary === opt
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={glutenFreeOnly}
                onChange={(e) => setGlutenFreeOnly(e.target.checked)}
                className="rounded border-stone-300 text-amber-700 focus:ring-amber-600"
              />
              Gluten-Free Only
            </label>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === 'All'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
            }`}
          >
            All Courses
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.slug)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat.slug
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-12 p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <p className="text-base font-semibold text-stone-900 dark:text-stone-100">No matching dishes found</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Try clearing your dietary or category filters to view the complete menu.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActiveCategory('All');
              setDietary('All');
              setGlutenFreeOnly(false);
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const qty = getCartQty(item.id);
            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                      {item.categoryName} · {item.dietaryType}
                      {item.isGlutenFree ? ' · Gluten-Free' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      aria-label={`View ingredients and allergens for ${item.name}`}
                      className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>

                  <h2 className="mt-1.5 text-lg font-semibold text-stone-900 dark:text-stone-100">{item.name}</h2>
                  <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 line-clamp-2 flex-1">
                    {item.description}
                  </p>
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    Allergens: {item.allergens} · {item.calories} kcal
                  </p>

                  <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                        {formatINR(item.price)}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">{item.unit}</span>
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          addItem(
                            {
                              foodItemId: item.id,
                              name: item.name,
                              price: Number(item.price),
                              unit: item.unit,
                              dietaryType: item.dietaryType,
                              imageUrl: item.imageUrl,
                            },
                            10
                          );
                          toast.success(`Added 10 portions of ${item.name}`);
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Add to Cart
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => (qty <= 5 ? removeItem(item.id) : updateQuantity(item.id, qty - 5))}
                          aria-label={`Decrease quantity for ${item.name}`}
                          className="w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-semibold tabular-nums w-8 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, qty + 5)}
                          aria-label={`Increase quantity for ${item.name}`}
                          className="w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Dish Detail Modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-detail-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xl">
            <div className="aspect-[16/9] relative">
              <SafeImage src={detailItem.imageUrl} alt={detailItem.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                aria-label="Close dish details"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-xs text-stone-500 dark:text-stone-400">
                {detailItem.categoryName} · {detailItem.dietaryType} · Prep {detailItem.prepTimeMins} mins
              </div>
              <h3 id="dish-detail-title" className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                {detailItem.name}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">{detailItem.description}</p>
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 text-xs space-y-1.5 text-stone-600 dark:text-stone-300">
                <p><strong className="text-stone-900 dark:text-stone-100">Ingredients:</strong> {detailItem.ingredients}</p>
                <p><strong className="text-stone-900 dark:text-stone-100">Allergens:</strong> {detailItem.allergens}</p>
                <p><strong className="text-stone-900 dark:text-stone-100">Nutrition:</strong> {detailItem.calories} kcal {detailItem.unit}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
