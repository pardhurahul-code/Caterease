import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatINR } from '../services/api';
import { SafeImage } from '../components/SafeImage';
import { useCart } from '../context/CartContext';
import { CustomMenuBuilder } from '../components/CustomMenuBuilder';

const EVENT_TYPES = [
  'All',
  'Wedding',
  'Corporate',
  'Birthday',
  'Engagement',
  'Housewarming',
  'Festival',
  'Family Function',
  'Custom',
];

export function PackagesPage() {
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState(searchParams.get('eventType') || 'All');

  const { selectedPackage, selectPackage } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    const q = eventType !== 'All' ? `?eventType=${encodeURIComponent(eventType)}` : '';
    api
      .get(`/packages${q}`)
      .then((res) => {
        if (active) setPackages(res.data.data || []);
      })
      .catch(() => {
        if (active) toast.error('Failed to load catering packages.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventType]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-8 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            Curated Catering Packages
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            All-inclusive per-person menus for weddings, corporate summits, birthdays, and festive celebrations.
          </p>
        </div>
        <a
          href="#custom-menu-builder"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-amber-700/40 text-amber-800 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 whitespace-nowrap self-start sm:self-auto"
        >
          Build Custom Multi-Course Menu ↓
        </a>
      </div>
      <div className="pb-2">

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setEventType(type)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                eventType === type
                  ? 'bg-amber-700 text-white'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-96 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="mt-10 p-10 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <p className="font-semibold text-stone-900 dark:text-stone-100">No packages found for "{eventType}"</p>
          <button
            type="button"
            onClick={() => setEventType('All')}
            className="mt-3 px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
          >
            Show All Packages
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.id === pkg.id;
            return (
              <article
                key={pkg.id}
                className={`rounded-2xl bg-white dark:bg-stone-900 border overflow-hidden flex flex-col ${
                  isSelected
                    ? 'border-amber-600 ring-2 ring-amber-600/20'
                    : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <SafeImage src={pkg.imageUrl} alt={pkg.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>{pkg.eventType} · {pkg.isAvailable ? 'Available' : 'Unavailable'}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users className="w-3.5 h-3.5" /> {pkg.minGuests}–{pkg.maxGuests} guests
                    </span>
                  </div>

                  <h2 className="mt-2 font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {pkg.name}
                  </h2>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{pkg.description}</p>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex-1">
                    <div>
                      <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">
                        Included Courses
                      </h3>
                      <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                        {(pkg.includedItemsJson || []).map((item: string) => (
                          <li key={item} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-200 mb-2">
                        Customizations
                      </h3>
                      <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                        {(pkg.customizationOptionsJson || []).map((opt: string) => (
                          <li key={opt}>• {opt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                        {formatINR(pkg.pricePerPerson)}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">per person</span>
                    </div>
                    <button
                      type="button"
                      disabled={!pkg.isAvailable}
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
                        toast.success(`"${pkg.name}" added to your booking.`);
                        navigate('/checkout');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSelected ? 'Selected — Proceed to Book' : 'Select Package & Book'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CustomMenuBuilder />
    </div>
  );
}
