import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, formatINR } from '../services/api';
import { SafeImage } from '../components/SafeImage';

export function CheckoutPage() {
  const {
    items,
    selectedPackage,
    guestCount,
    appliedCoupon,
    updateQuantity,
    removeItem,
    selectPackage,
    setGuestCount,
    setAppliedCoupon,
    clearCart,
    pricing,
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [packagesList, setPackagesList] = useState<any[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    eventName: '',
    eventType: selectedPackage?.eventType || 'Wedding',
    eventDate: defaultDate,
    eventTime: '19:00',
    eventLocation: '',
    dietaryRequirements: '',
    specialInstructions: '',
    contactName: user?.name || '',
    contactPhone: user?.phone || '+91 98201 33001',
    contactEmail: user?.email || '',
    budget: '',
    deliveryRequirements: 'Full Service Setup',
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        contactName: prev.contactName || user.name,
        contactEmail: prev.contactEmail || user.email,
        contactPhone: prev.contactPhone || user.phone || '+91 98201 33001',
      }));
    }
  }, [user]);

  useEffect(() => {
    const pickedVenue = sessionStorage.getItem('caterease_selected_venue');
    if (pickedVenue) {
      setForm((prev) => ({ ...prev, eventLocation: prev.eventLocation || pickedVenue }));
      sessionStorage.removeItem('caterease_selected_venue');
    }
  }, []);

  useEffect(() => {
    api.get('/packages').then((r) => setPackagesList(r.data.data || [])).catch(() => {});
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    if (!user) {
      toast.error('Please sign in to validate and apply a coupon code.');
      return;
    }
    setCouponLoading(true);
    try {
      const res = await api.post('/coupons/validate', {
        code: couponInput.trim().toUpperCase(),
        subtotal: pricing.subtotal,
      });
      const activeRes = await api.get('/coupons/active');
      const fullCoupon = (activeRes.data.data || []).find(
        (c: any) => c.code === res.data.data.code
      );
      if (fullCoupon) {
        setAppliedCoupon({
          code: fullCoupon.code,
          discountType: fullCoupon.discountType,
          discountValue: Number(fullCoupon.discountValue),
          minOrderValue: Number(fullCoupon.minOrderValue),
          maxDiscount: fullCoupon.maxDiscount ? Number(fullCoupon.maxDiscount) : null,
          startDate: fullCoupon.startDate,
          expiryDate: fullCoupon.expiryDate,
          usageLimit: fullCoupon.usageLimit,
          usedCount: fullCoupon.usedCount,
          isActive: fullCoupon.isActive,
        });
      }
      toast.success(`Coupon ${res.data.data.code} applied (-${formatINR(res.data.data.discountAmount)})`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in first to confirm your catering booking.');
      navigate('/login');
      return;
    }
    if (!selectedPackage && items.length === 0) {
      toast.error('Please select a catering package or add food items first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/bookings', {
        packageId: selectedPackage?.id || null,
        items: items.map((i) => ({ foodItemId: i.foodItemId, quantity: i.quantity })),
        eventName: form.eventName,
        eventType: form.eventType,
        eventDate: form.eventDate,
        eventTime: form.eventTime,
        eventLocation: form.eventLocation,
        guestCount,
        dietaryRequirements: form.dietaryRequirements,
        specialInstructions: form.specialInstructions,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        budget: form.budget ? Number(form.budget) : null,
        deliveryRequirements: form.deliveryRequirements,
        couponCode: appliedCoupon?.code || null,
      });

      clearCart();
      toast.success(`Booking ${res.data.data.bookingCode} confirmed!`);
      navigate(`/dashboard/customer/bookings/${res.data.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not submit booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
            Catering Cart & Event Booking
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Customize quantities, apply promo codes (try CELEBRATE15 or WELCOME500), and lock your event slot.
          </p>
        </div>
        <Link to="/menu" className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline">
          + Add More Dishes from Menu
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Cart Items, Package Selector & Booking Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Package Selection */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Catering Package</h2>
              {selectedPackage && (
                <button
                  type="button"
                  onClick={() => selectPackage(null)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove Package
                </button>
              )}
            </div>

            {selectedPackage ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div>
                  <div className="text-xs text-stone-500">{selectedPackage.eventType}</div>
                  <div className="font-semibold text-stone-900 dark:text-stone-100">{selectedPackage.name}</div>
                  <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 tabular-nums">
                    {formatINR(selectedPackage.pricePerPerson)} / guest · Min {selectedPackage.minGuests} guests
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="checkout-guests" className="text-xs font-medium">Guests:</label>
                  <input
                    id="checkout-guests"
                    type="number"
                    min={selectedPackage.minGuests}
                    max={selectedPackage.maxGuests}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="pkg-dropdown" className="block text-xs text-stone-500">
                  Optionally choose an all-inclusive catering package:
                </label>
                <select
                  id="pkg-dropdown"
                  value=""
                  onChange={(e) => {
                    const found = packagesList.find((p) => p.id === Number(e.target.value));
                    if (found) {
                      selectPackage({
                        id: found.id,
                        name: found.name,
                        eventType: found.eventType,
                        pricePerPerson: Number(found.pricePerPerson),
                        minGuests: found.minGuests,
                        maxGuests: found.maxGuests,
                        imageUrl: found.imageUrl,
                      });
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  <option value="">-- Select a Catering Package (Optional) --</option>
                  {packagesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.eventType}) — {formatINR(p.pricePerPerson)}/guest
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* A la carte Cart Items */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">
              Selected Menu Dishes ({items.length})
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No individual dishes in cart.{' '}
                <Link to="/menu" className="text-amber-800 dark:text-amber-400 underline">
                  Browse Menu
                </Link>
              </p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {items.map((item) => (
                  <div key={item.foodItemId} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-stone-500 tabular-nums">
                          {formatINR(item.price)} {item.unit} · {item.dietaryType}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.foodItemId, item.quantity - 5)}
                        aria-label={`Decrease ${item.name}`}
                        className="w-7 h-7 rounded-md border border-stone-200 dark:border-stone-700 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-semibold tabular-nums w-8 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.foodItemId, item.quantity + 5)}
                        aria-label={`Increase ${item.name}`}
                        className="w-7 h-7 rounded-md border border-stone-200 dark:border-stone-700 flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.foodItemId)}
                        aria-label={`Remove ${item.name}`}
                        className="p-1.5 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Booking Form */}
          <form
            id="booking-checkout-form"
            onSubmit={handleConfirmBooking}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Event & Contact Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bk-event-name" className="block text-xs font-medium mb-1">Event Name</label>
                <input
                  id="bk-event-name"
                  type="text"
                  required
                  value={form.eventName}
                  onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                  placeholder="e.g., Kapoor Silver Jubilee Dinner"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bk-event-type" className="block text-xs font-medium mb-1">Event Type</label>
                <select
                  id="bk-event-type"
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  {['Wedding', 'Corporate', 'Birthday', 'Engagement', 'Housewarming', 'Festival', 'Family Function', 'Custom'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="bk-date" className="block text-xs font-medium mb-1">Event Date</label>
                <input
                  id="bk-date"
                  type="date"
                  required
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bk-time" className="block text-xs font-medium mb-1">Event Time</label>
                <input
                  id="bk-time"
                  type="time"
                  required
                  value={form.eventTime}
                  onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bk-guests" className="block text-xs font-medium mb-1">Number of Guests</label>
                <input
                  id="bk-guests"
                  type="number"
                  min={selectedPackage?.minGuests || 10}
                  required
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="bk-location" className="block text-xs font-medium">Event Venue / Delivery Location</label>
                <Link to="/venue-map" className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline">
                  Pick Venue &amp; Dispatch Route on Map →
                </Link>
              </div>
              <input
                id="bk-location"
                type="text"
                required
                value={form.eventLocation}
                onChange={(e) => setForm({ ...form, eventLocation: e.target.value })}
                placeholder="Full banquet hall or street address"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="bk-contact-name" className="block text-xs font-medium mb-1">Contact Name</label>
                <input
                  id="bk-contact-name"
                  type="text"
                  required
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bk-contact-phone" className="block text-xs font-medium mb-1">Contact Phone</label>
                <input
                  id="bk-contact-phone"
                  type="tel"
                  required
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bk-contact-email" className="block text-xs font-medium mb-1">Contact Email</label>
                <input
                  id="bk-contact-email"
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bk-delivery" className="block text-xs font-medium mb-1">Delivery & Setup Style</label>
                <select
                  id="bk-delivery"
                  value={form.deliveryRequirements}
                  onChange={(e) => setForm({ ...form, deliveryRequirements: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  <option>Full Service Setup</option>
                  <option>Buffet Chafing Delivery</option>
                  <option>Live Counters + Service Staff</option>
                  <option>Drop-Off Packed Trays</option>
                </select>
              </div>
              <div>
                <label htmlFor="bk-budget" className="block text-xs font-medium mb-1">Target Budget (Optional, ₹)</label>
                <input
                  id="bk-budget"
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="e.g., 120000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bk-dietary" className="block text-xs font-medium mb-1">Dietary Requirements</label>
              <input
                id="bk-dietary"
                type="text"
                value={form.dietaryRequirements}
                onChange={(e) => setForm({ ...form, dietaryRequirements: e.target.value })}
                placeholder="e.g., 30 Jain plates, nut-free dessert table"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>

            <div>
              <label htmlFor="bk-notes" className="block text-xs font-medium mb-1">Special Instructions</label>
              <textarea
                id="bk-notes"
                rows={2}
                value={form.specialInstructions}
                onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
                placeholder="Service arrival window, elevator access, or plating preferences"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
          </form>
        </div>

        {/* Right: Order & Price Summary */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-5">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Pricing Summary
            </h2>

            {/* Coupon Box */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <label htmlFor="coupon-input" className="sr-only">Coupon code</label>
                <input
                  id="coupon-input"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Promo code (e.g., CELEBRATE15)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-mono uppercase"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponLoading}
                className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold whitespace-nowrap"
              >
                {couponLoading ? '...' : 'Apply'}
              </button>
            </div>

            {appliedCoupon && (
              <div className="flex items-center justify-between text-xs text-teal-700 dark:text-teal-400">
                <span>Applied coupon: <strong className="font-mono">{appliedCoupon.code}</strong></span>
                <button type="button" onClick={() => setAppliedCoupon(null)} className="underline">
                  Remove
                </button>
              </div>
            )}

            <div className="space-y-2.5 text-sm border-t border-stone-200 dark:border-stone-800 pt-4">
              {selectedPackage && (
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">
                    Package ({guestCount} guests)
                  </span>
                  <span className="font-medium tabular-nums">{formatINR(pricing.packageSubtotal)}</span>
                </div>
              )}
              {items.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Menu Items</span>
                  <span className="font-medium tabular-nums">{formatINR(pricing.itemsSubtotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Subtotal</span>
                <span className="font-medium tabular-nums">{formatINR(pricing.subtotal)}</span>
              </div>
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between text-teal-700 dark:text-teal-400">
                  <span>Coupon Discount</span>
                  <span className="font-medium tabular-nums">-{formatINR(pricing.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">GST (5%)</span>
                <span className="font-medium tabular-nums">{formatINR(pricing.taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">
                  Delivery & Setup {pricing.deliveryCharge === 0 && pricing.subtotal > 0 ? '(Free ≥ ₹15k)' : ''}
                </span>
                <span className="font-medium tabular-nums">{formatINR(pricing.deliveryCharge)}</span>
              </div>
            </div>

            <div className="border-t border-stone-200 dark:border-stone-800 pt-4 flex items-baseline justify-between">
              <span className="font-semibold text-stone-900 dark:text-stone-100">Total Payable</span>
              <span className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {formatINR(pricing.totalAmount)}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Recommended 30% Advance Deposit: <strong className="tabular-nums">{formatINR(pricing.recommendedAdvance)}</strong>. Final pricing is verified server-side.
            </p>

            <button
              type="submit"
              form="booking-checkout-form"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Confirming Booking...' : user ? 'Confirm Booking' : 'Sign In to Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
