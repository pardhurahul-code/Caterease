import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  ChefHat,
  ChevronDown,
  Search,
  ShieldCheck,
  Star,
  Utensils,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, formatINR } from '../services/api';
import { SafeImage } from '../components/SafeImage';
import { useCart } from '../context/CartContext';

const EVENT_CATEGORIES = [
  { name: 'Wedding', desc: 'Multi-course banquets & live stations' },
  { name: 'Corporate', desc: 'Punctual summits, retreats & townhalls' },
  { name: 'Birthday', desc: 'Milestone parties & curated finger foods' },
  { name: 'Engagement', desc: 'Passed hors d’oeuvres & dessert bars' },
  { name: 'Housewarming', desc: 'Traditional sattvic & Jain feasts' },
  { name: 'Festival', desc: 'Diwali, Eid & festive spreads' },
  { name: 'Family Function', desc: 'Anniversaries & warm gatherings' },
  { name: 'Custom', desc: 'Bespoke menus with AI quantity planning' },
];

const FAQS = [
  {
    q: 'How far in advance should I book CaterEase for a wedding or corporate event?',
    a: 'We recommend booking at least 7 days ahead for corporate buffets or birthday parties, and 3–6 weeks ahead for weddings above 150 guests. Our booking engine automatically prevents venue slot conflicts.',
  },
  {
    q: 'Do you support strict Jain, Vegan, and Gluten-Free preparation?',
    a: 'Yes. Every dish in our catalog lists exact ingredients and allergens, and we maintain dedicated Jain (no onion, no garlic) and gluten-free preparation stations upon request.',
  },
  {
    q: 'How does the AI Food Quantity Estimator work?',
    a: 'CaterEase AI uses Google Gemini to evaluate your guest count, meal slot, event duration, and dietary mix to recommend rice, starter, main course, dessert, and beverage quantities with a zero-shortage buffer.',
  },
  {
    q: 'Can I pay an advance deposit first and settle the balance later?',
    a: 'Yes. You can confirm any booking with a 30% advance payment and pay the remaining balance from your Customer Dashboard with downloadable PDF tax invoices.',
  },
];

export function HomePage() {
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [popularPackages, setPopularPackages] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEventType, setSearchEventType] = useState('All');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const { addItem, selectPackage } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/catalog?featured=true'),
      api.get('/packages'),
      api.get('/reviews'),
    ])
      .then(([catRes, pkgRes, revRes]) => {
        if (!active) return;
        setFeaturedItems((catRes.data.data || []).slice(0, 6));
        setPopularPackages((pkgRes.data.data || []).slice(0, 3));
        setReviews((revRes.data.data || []).slice(0, 3));
      })
      .catch(() => {
        // Non-blocking
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEventType !== 'All' && !searchQuery.trim()) {
      navigate(`/packages?eventType=${encodeURIComponent(searchEventType)}`);
    } else {
      navigate(`/menu?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    try {
      const res = await api.post('/newsletter', { email: newsletterEmail.trim() });
      toast.success(res.data.message || 'Subscribed to seasonal updates!');
      setNewsletterEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not subscribe.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium tracking-wide text-amber-800 dark:text-amber-400 mb-3">
              ISO 22000 Culinary Operations · Mumbai & Bengaluru
            </p>
            <h1
              className="font-display font-bold tracking-tight text-stone-900 dark:text-stone-50 text-balance leading-[1.1]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}
            >
              Smart Catering. Seamless Celebrations.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
              Curated menus, transparent per-guest pricing, real-time kitchen tracking, and Gemini AI quantity estimation built for unforgettable weddings, corporate summits, and private gatherings.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Book Catering
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Explore Menu
              </Link>
              <Link
                to="/packages"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                View Packages
              </Link>
              <Link
                to="/ai"
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-400 hover:underline whitespace-nowrap"
              >
                <Brain className="w-4 h-4" />
                Get AI Recommendations
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-72 sm:h-96 lg:h-full min-h-[360px] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800">
              <SafeImage
                src="/src/assets/images/hero_catering_banquet_1794926254985.jpg"
                alt="Luxury CaterEase banquet spread with brass chafing dishes and gourmet cuisine"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Search Catering Services Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="mt-10 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
        >
          <div className="md:col-span-6 flex items-center gap-3 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <label htmlFor="hero-search" className="sr-only">Search dishes, ingredients, or cuisines</label>
            <input
              id="hero-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, saffron biryani, Jain starters, desserts..."
              className="w-full bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="hero-event-select" className="sr-only">Select event category</label>
            <select
              id="hero-event-select"
              value={searchEventType}
              onChange={(e) => setSearchEventType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <option value="All">All Event Types</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors whitespace-nowrap"
            >
              Find Catering
            </button>
          </div>
        </form>
      </section>

      {/* 2. Featured Food Items */}
      <section className="border-t border-stone-200 dark:border-stone-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
                Featured Culinary Creations
              </h2>
              <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm">
                Crafted fresh in small batches with full ingredient and allergen transparency.
              </p>
            </div>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400 hover:underline whitespace-nowrap"
            >
              View Full Menu <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-80 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
                      <span>{item.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.dietaryType}</span>
                      {item.isGlutenFree && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Gluten-Free</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-lg font-semibold text-stone-900 dark:text-stone-100">
                      {item.name}
                    </h3>
                    <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 line-clamp-2 flex-1">
                      {item.description}
                    </p>
                    <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                          {formatINR(item.price)}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
                          {item.unit}
                        </span>
                      </div>
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
                          toast.success(`Added 10 portions of ${item.name} to cart.`);
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Popular Catering Packages */}
      <section className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
                Popular Catering Packages
              </h2>
              <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm">
                End-to-end culinary packages with customizable dietary counters and hospitality staff.
              </p>
            </div>
            <Link
              to="/packages"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400 hover:underline whitespace-nowrap"
            >
              Explore All 8 Packages <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularPackages.map((pkg) => (
              <article
                key={pkg.id}
                className="rounded-2xl bg-[#FAF9F6] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <SafeImage src={pkg.imageUrl} alt={pkg.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {pkg.eventType} · Min {pkg.minGuests} guests
                  </div>
                  <h3 className="mt-1.5 text-xl font-semibold text-stone-900 dark:text-stone-100">
                    {pkg.name}
                  </h3>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{pkg.description}</p>
                  <ul className="mt-4 space-y-1.5 text-xs text-stone-600 dark:text-stone-300 flex-1">
                    {(pkg.includedItemsJson || []).slice(0, 4).map((line: string) => (
                      <li key={line} className="flex items-center gap-2">
                        <span className="text-amber-700 dark:text-amber-400">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-lg font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                        {formatINR(pkg.pricePerPerson)}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">/ guest</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selectPackage({
                          id: pkg.id,
                          name: pkg.name,
                          eventType: pkg.eventType,
                          pricePerPerson: Number(pkg.pricePerPerson),
                          minGuests: pkg.minGuests,
                          maxGuests: pkg.maxGuests,
                          imageUrl: pkg.imageUrl,
                        });
                        toast.success(`Selected "${pkg.name}" package.`);
                        navigate('/checkout');
                      }}
                      className="px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors whitespace-nowrap"
                    >
                      Select & Book
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Event Categories & How CaterEase Works */}
      <section className="border-t border-stone-200 dark:border-stone-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-6">
            <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
              Tailored for Every Occasion
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Browse curated culinary blueprints designed around your celebration format.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EVENT_CATEGORIES.map((cat) => (
                <Link
                  key={cat.name}
                  to={`/packages?eventType=${encodeURIComponent(cat.name)}`}
                  className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-600 dark:hover:border-amber-500 transition-colors"
                >
                  <div className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                    {cat.name}
                  </div>
                  <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{cat.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
              How CaterEase Works
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              From smart portion estimation to QR-verified venue service.
            </p>
            <div className="mt-6 space-y-4">
              {[
                {
                  num: '01.',
                  title: 'Plan Portions & Menus with CaterEase AI',
                  desc: 'Calculate exact rice, starter, main, dessert, and beverage quantities in seconds and tailor dishes to dietary needs.',
                },
                {
                  num: '02.',
                  title: 'Lock Your Event Slot & Transparent Invoice',
                  desc: 'Real-time conflict checks prevent double bookings while server-verified pricing applies eligible coupons and GST.',
                },
                {
                  num: '03.',
                  title: 'Chef Assignment & Kitchen Prep Tracking',
                  desc: 'Dedicated culinary leads manage ingredient stock, prep status, and dispatch schedules in real time.',
                },
                {
                  num: '04.',
                  title: 'QR-Verified Service & Post-Event Review',
                  desc: 'Verify your catering order at the venue via unique QR code and download itemized PDF invoices anytime.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-start gap-4"
                >
                  <span className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. AI-Powered Catering Introduction & Why Choose CaterEase */}
      <section className="border-t border-stone-200 dark:border-stone-800 bg-stone-900 text-stone-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium text-amber-400">Powered by Google Gemini</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white text-balance">
              Meet CaterEase AI — Your Smart Catering Assistant
            </h2>
            <p className="mt-4 text-stone-300 text-sm sm:text-base leading-relaxed max-w-2xl">
              Eliminate guesswork and food waste. Estimate exact dish quantities for 25 to 2,000 guests, generate dietary-compliant menus from our live kitchen catalog, optimize your budget, and chat with an assistant grounded in real package pricing.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-stone-800/80 border border-stone-700">
                <Utensils className="w-4 h-4 text-amber-400 mb-2" />
                <div className="font-semibold text-white">Quantity Estimator</div>
                <div className="text-xs text-stone-400 mt-1">Course-by-course weights with smart buffer.</div>
              </div>
              <div className="p-4 rounded-xl bg-stone-800/80 border border-stone-700">
                <ChefHat className="w-4 h-4 text-amber-400 mb-2" />
                <div className="font-semibold text-white">Menu & Event Planner</div>
                <div className="text-xs text-stone-400 mt-1">Custom timelines & dietary station splits.</div>
              </div>
              <div className="p-4 rounded-xl bg-stone-800/80 border border-stone-700">
                <ShieldCheck className="w-4 h-4 text-amber-400 mb-2" />
                <div className="font-semibold text-white">Budget Precision</div>
                <div className="text-xs text-stone-400 mt-1">Authoritative backend pricing + saving tips.</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/ai"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
              >
                Launch CaterEase AI Suite <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/studio-3d"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-100 text-sm font-semibold transition-colors"
              >
                Open 3D Banquet Studio
              </Link>
              <Link
                to="/venue-map"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-100 text-sm font-semibold transition-colors"
              >
                Venue Dispatch Map
              </Link>
              <Link
                to="/game"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-300 text-sm font-semibold transition-colors"
              >
                Play Banquet Rush 3D
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-800 border border-stone-700">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">99.4%</div>
              <div className="text-xs text-stone-400 mt-1">On-Time Venue Setup Rate Across 400+ Events</div>
            </div>
            <div className="p-5 rounded-2xl bg-stone-800 border border-stone-700">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">4.9 / 5</div>
              <div className="text-xs text-stone-400 mt-1">Verified Post-Event Host Satisfaction</div>
            </div>
            <div className="p-5 rounded-2xl bg-stone-800 border border-stone-700">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">100%</div>
              <div className="text-xs text-stone-400 mt-1">Allergen & Dietary Station Labeling</div>
            </div>
            <div className="p-5 rounded-2xl bg-stone-800 border border-stone-700">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">24/7</div>
              <div className="text-xs text-stone-400 mt-1">Live Booking Timeline & QR Verification</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Customer Reviews & Testimonials */}
      <section className="border-t border-stone-200 dark:border-stone-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
              Verified Celebration Reviews
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Submitted exclusively by hosts with completed CaterEase bookings.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((rev) => (
              <blockquote
                key={rev.id}
                className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-600">
                    {Array.from({ length: rev.rating }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <h3 className="mt-3 font-semibold text-stone-900 dark:text-stone-100">{rev.title}</h3>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
                <footer className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-semibold text-stone-900 dark:text-stone-200">{rev.customerName}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{rev.eventName} ({rev.eventType})</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ & Newsletter */}
      <section className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {FAQS.map((faq, idx) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF9F6] dark:bg-stone-900 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    aria-expanded={openFaq === idx}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-medium text-sm text-stone-900 dark:text-stone-100"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-4 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="p-8 rounded-2xl bg-[#FAF9F6] dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <CalendarCheck className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              <h3 className="mt-3 font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                Seasonal Menus & Tasting Invites
              </h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Receive curated festive catering brochures, coupon codes, and chef tasting dates.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="mt-6 space-y-3">
                <div>
                  <label htmlFor="newsletter-email" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {subscribing ? 'Subscribing...' : 'Subscribe to Updates'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
