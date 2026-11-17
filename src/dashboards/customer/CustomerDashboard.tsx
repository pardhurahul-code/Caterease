import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bell,
  Calendar,
  CreditCard,
  Download,
  HelpCircle,
  LayoutDashboard,
  QrCode,
  Radio,
  Star,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { api, formatINR } from '../../services/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SafeImage } from '../../components/SafeImage';
import {
  canCustomerCancelBooking,
  canCustomerEditBooking,
  canCustomerReviewBooking,
  computeRemainingBalance,
} from '../../utils/bookingWorkflow';

export function CustomerDashboard({ initialTab = 'overview' }: { initialTab?: string }) {
  const { bookingId: paramBookingId } = useParams();
  const { user, customerProfile, refreshProfile } = useAuth();
  const { addItem } = useCart();

  const [activeTab, setActiveTab] = useState(paramBookingId ? 'bookings' : initialTab);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tastings, setTastings] = useState<any[]>([]);
  const [catalogDishes, setCatalogDishes] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<{ rationale: string; items: any[] }>({ rationale: '', items: [] });
  const [loading, setLoading] = useState(true);

  const [tastingForm, setTastingForm] = useState({
    eventType: 'Wedding',
    estimatedGuests: 150,
    preferredDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    preferredTime: '16:00',
    tastingGuests: 2,
    selectedDishIds: [] as number[],
    dietaryNotes: '',
  });
  const [tastingSubmitting, setTastingSubmitting] = useState(false);

  // Modals
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [payModalBooking, setPayModalBooking] = useState<any | null>(null);
  const [payType, setPayType] = useState<'ADVANCE' | 'FULL' | 'BALANCE'>('ADVANCE');
  const [payMethod, setPayMethod] = useState<'UPI' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CASH' | 'RAZORPAY' | 'DEMO'>('UPI');
  const [simulateFail, setSimulateFail] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const [qrModal, setQrModal] = useState<{ qrDataUrl: string; verifyUrl: string; code: string } | null>(null);
  const [editModal, setEditModal] = useState<any | null>(null);

  // Review form
  const [reviewForm, setReviewForm] = useState({ bookingId: 0, rating: 5, title: '', comment: '' });
  // Support form
  const [ticketForm, setTicketForm] = useState({ bookingId: '', category: 'Menu Customization', subject: '', description: '', priority: 'Medium' });
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  // Profile & Prefs
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: customerProfile?.address || '',
    city: customerProfile?.city || '',
    state: customerProfile?.state || '',
    postalCode: customerProfile?.postalCode || '',
    dietaryNotes: customerProfile?.dietaryNotes || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [prefForm, setPrefForm] = useState({
    preferredCuisine: customerProfile?.preferences?.preferredCuisine || 'North & South Indian Fusion',
    dietaryRestrictions: customerProfile?.preferences?.dietaryRestrictions || 'None',
    spiceLevel: customerProfile?.preferences?.spiceLevel || 'Medium',
    budgetTier: customerProfile?.preferences?.budgetTier || 'Premium',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bkRes, payRes, notifRes, tktRes, recRes, tastRes, catRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/payments'),
        api.get('/notifications'),
        api.get('/support'),
        api.get('/ai/personalized-food'),
        api.get('/tastings'),
        api.get('/catalog'),
      ]);
      const bkList = bkRes.data.data || [];
      setBookings(bkList);
      setPayments(payRes.data.data || []);
      setNotifications(notifRes.data.data?.items || []);
      setUnreadCount(notifRes.data.data?.unreadCount || 0);
      setTickets(tktRes.data.data || []);
      setRecommended(recRes.data.data || { rationale: '', items: [] });
      setTastings(tastRes.data.data || []);
      setCatalogDishes(catRes.data.data || []);

      if (paramBookingId) {
        const detail = await api.get(`/bookings/${paramBookingId}`);
        setSelectedBooking(detail.data.data);
      }
    } catch {
      toast.error('Failed to load customer dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [paramBookingId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const { connected: liveConnected } = useRealtimeEvents(true, (eventName, payload) => {
    if (eventName === 'booking:status') {
      toast.info(`Live Update: ${payload.bookingCode} is now ${payload.status}`);
      loadAll();
      if (selectedBooking?.id === payload.bookingId) {
        api.get(`/bookings/${payload.bookingId}`).then((r) => setSelectedBooking(r.data.data)).catch(() => {});
      }
    } else if (eventName === 'assignment:updated') {
      toast.info(`Kitchen Update (${payload.bookingCode}): Prep ${payload.prepStatus} · Delivery ${payload.deliveryStatus}`);
      loadAll();
    } else if (eventName === 'tasting:updated') {
      toast.info(`Food Tasting Update: Status changed to ${payload.status}`);
      loadAll();
    }
  });

  useEffect(() => {
    if (user) {
      setProfileForm((prev) => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || '',
        address: customerProfile?.address || '',
        city: customerProfile?.city || '',
        state: customerProfile?.state || '',
        postalCode: customerProfile?.postalCode || '',
        dietaryNotes: customerProfile?.dietaryNotes || '',
      }));
    }
  }, [user, customerProfile]);

  const openBookingDetail = async (id: number) => {
    try {
      const res = await api.get(`/bookings/${id}`);
      setSelectedBooking(res.data.data);
      setActiveTab('bookings');
    } catch {
      toast.error('Could not load booking details.');
    }
  };

  const handleDownloadPdf = async (bookingId: number, bookingCode: string) => {
    try {
      const res = await api.get(`/invoices/${bookingId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CaterEase-Invoice-${bookingCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded.');
    } catch {
      toast.error('Failed to download invoice PDF.');
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;
    try {
      await api.patch(`/bookings/${cancelTarget.id}/status`, {
        status: 'Cancelled',
        note: 'Cancelled by customer from dashboard.',
      });
      toast.success(`Booking ${cancelTarget.bookingCode} cancelled.`);
      setCancelTarget(null);
      await loadAll();
      if (selectedBooking?.id === cancelTarget.id) openBookingDetail(cancelTarget.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to cancel booking.');
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalBooking) return;
    setPayLoading(true);
    try {
      const orderRes = await api.post('/payments/create-order', {
        bookingId: payModalBooking.id,
        paymentType: payType,
      });
      const order = orderRes.data.data;

      const verifyRes = await api.post('/payments/verify', {
        bookingId: payModalBooking.id,
        paymentType: payType,
        method: payMethod,
        orderId: order.orderId,
        simulateFailure: simulateFail,
      });

      toast.success(
        `${order.isDemo ? '[DEMO MODE] ' : ''}Payment ${verifyRes.data.data.paymentRow.transactionId} verified!`
      );
      setPayModalBooking(null);
      setSimulateFail(false);
      await loadAll();
      if (selectedBooking?.id === payModalBooking.id) openBookingDetail(payModalBooking.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payment failed.');
      await loadAll();
    } finally {
      setPayLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    try {
      await api.put(`/bookings/${editModal.id}`, {
        eventName: editModal.eventName,
        eventDate: editModal.eventDate,
        eventTime: editModal.eventTime,
        eventLocation: editModal.eventLocation,
        dietaryRequirements: editModal.dietaryRequirements,
        specialInstructions: editModal.specialInstructions,
      });
      toast.success('Booking updated.');
      const id = editModal.id;
      setEditModal(null);
      await loadAll();
      openBookingDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not update booking.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.bookingId) {
      toast.error('Select a completed booking to review.');
      return;
    }
    try {
      await api.post('/reviews', reviewForm);
      toast.success('Thank you! Your review has been published.');
      setReviewForm({ bookingId: 0, rating: 5, title: '', comment: '' });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit review.');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/support', {
        ...ticketForm,
        bookingId: ticketForm.bookingId ? Number(ticketForm.bookingId) : null,
      });
      toast.success('Support ticket created.');
      setTicketForm({ bookingId: '', category: 'Menu Customization', subject: '', description: '', priority: 'Medium' });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create ticket.');
    }
  };

  const totalBookings = bookings.length;
  const upcomingCount = bookings.filter((b) => !['Completed', 'Cancelled'].includes(b.status)).length;
  const completedCount = bookings.filter((b) => b.status === 'Completed').length;
  const pendingBalance = bookings
    .filter((b) => b.status !== 'Cancelled')
    .reduce((sum, b) => sum + computeRemainingBalance(Number(b.totalAmount), Number(b.paidAmount)), 0);

  const eligibleReviewBookings = bookings.filter((b) => canCustomerReviewBooking(b.status, false));

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'My Bookings', icon: Calendar, badge: upcomingCount },
    { id: 'tastings', label: 'Food Tastings', icon: UtensilsCrossed, badge: tastings.filter((t) => t.status === 'Scheduled').length },
    { id: 'payments', label: 'Payments & Invoices', icon: CreditCard },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'support', label: 'Support Tickets', icon: HelpCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'Profile & Preferences', icon: User },
  ];

  return (
    <DashboardLayout
      title={`Welcome, ${user?.name || 'Guest'}`}
      subtitle="Track celebrations, verify QR passes, manage payments, and download PDF invoices."
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => {
        setActiveTab(id);
        if (id !== 'bookings') setSelectedBooking(null);
      }}
    >
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Bookings', value: totalBookings },
              { label: 'Upcoming Events', value: upcomingCount },
              { label: 'Completed Events', value: completedCount },
              { label: 'Pending Balance', value: formatINR(pendingBalance) },
            ].map((kpi) => (
              <div key={kpi.label} className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <div className="text-xs text-stone-500 dark:text-stone-400">{kpi.label}</div>
                <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Recommended Food */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold">Recommended For You</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{recommended.rationale}</p>
              </div>
              <Link to="/menu" className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline">
                Browse Full Menu →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommended.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col">
                  <div className="aspect-[4/3]">
                    <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-stone-500">{item.categoryName} · {item.dietaryType}</div>
                      <div className="font-semibold text-xs text-stone-900 dark:text-stone-100 mt-0.5">{item.name}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-bold tabular-nums">{formatINR(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          addItem(
                            {
                              foodItemId: item.id,
                              name: item.name,
                              price: Number(item.price),
                              unit: 'per plate',
                              dietaryType: item.dietaryType,
                              imageUrl: item.imageUrl,
                            },
                            10
                          );
                          toast.success(`Added ${item.name} to cart.`);
                        }}
                        className="px-2.5 py-1 rounded-md bg-amber-700 text-white text-[11px] font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <h2 className="font-display text-xl font-bold mb-4">Recent Bookings & Activity</h2>
            {loading ? (
              <div className="h-28 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
            ) : bookings.length === 0 ? (
              <div className="text-sm text-stone-500">
                No bookings yet. <Link to="/packages" className="text-amber-700 underline">Explore packages</Link>.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {bookings.slice(0, 4).map((b) => (
                  <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-mono text-xs text-amber-800 dark:text-amber-400 mr-2">{b.bookingCode}</span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">{b.eventName}</span>
                      <div className="text-xs text-stone-500 mt-0.5 tabular-nums">
                        {b.eventDate} · {b.guestCount} guests · {b.status} · {b.paymentStatus}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBookingDetail(b.id)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKINGS & DETAIL */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {selectedBooking ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="text-xs text-amber-800 dark:text-amber-400 hover:underline mb-2"
                  >
                    ← Back to All Bookings
                  </button>
                  <div className="font-mono text-xs text-stone-500">{selectedBooking.bookingCode}</div>
                  <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {selectedBooking.eventName}
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    {selectedBooking.eventType} · {selectedBooking.eventDate} at {selectedBooking.eventTime} · {selectedBooking.guestCount} guests
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {computeRemainingBalance(Number(selectedBooking.totalAmount), Number(selectedBooking.paidAmount)) > 0 &&
                    selectedBooking.status !== 'Cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayType(Number(selectedBooking.paidAmount) === 0 ? 'ADVANCE' : 'BALANCE');
                          setPayModalBooking(selectedBooking);
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                      >
                        Pay {Number(selectedBooking.paidAmount) === 0 ? 'Advance / Full' : 'Remaining Balance'}
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedBooking.id, selectedBooking.bookingCode)}
                    className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Invoice PDF
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setQrModal({
                        qrDataUrl: selectedBooking.qrDataUrl,
                        verifyUrl: selectedBooking.verifyUrl,
                        code: selectedBooking.bookingCode,
                      })
                    }
                    className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR Pass
                  </button>

                  {canCustomerEditBooking(selectedBooking.status) && (
                    <button
                      type="button"
                      onClick={() => setEditModal({ ...selectedBooking })}
                      className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  )}

                  {canCustomerCancelBooking(selectedBooking.status) && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(selectedBooking)}
                      className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                  <div className="text-xs text-stone-500">Booking Status</div>
                  <div className="font-semibold mt-1">{selectedBooking.status}</div>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                  <div className="text-xs text-stone-500">Payment Summary</div>
                  <div className="font-semibold mt-1 tabular-nums">
                    {formatINR(selectedBooking.paidAmount)} / {formatINR(selectedBooking.totalAmount)} ({selectedBooking.paymentStatus})
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                  <div className="text-xs text-stone-500">Venue</div>
                  <div className="font-medium text-xs mt-1">{selectedBooking.eventLocation}</div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-sm">Live Kitchen & Booking Timeline</h3>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                    <Radio className="w-3.5 h-3.5" />
                    {liveConnected ? 'Live Stream Connected' : 'Connecting Live Stream'}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {(selectedBooking.timeline || []).map((t: any) => (
                    <div key={t.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-semibold text-amber-800 dark:text-amber-400 mr-2">{t.status}</span>
                        <span className="text-stone-700 dark:text-stone-300">{t.note}</span>
                      </div>
                      <span className="font-mono text-stone-400 shrink-0">
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                  <tr>
                    <th className="px-5 py-3.5">Booking ID</th>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Guests</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Total</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold">{b.bookingCode}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-stone-900 dark:text-stone-100">{b.eventName}</div>
                        <div className="text-xs text-stone-500">{b.eventType}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs tabular-nums">{b.eventDate}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{b.guestCount}</td>
                      <td className="px-5 py-3.5 text-xs font-medium">{b.status} · {b.paymentStatus}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatINR(b.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openBookingDetail(b.id)}
                          className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PRE-EVENT FOOD TASTINGS */}
      {activeTab === 'tastings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (tastingForm.selectedDishIds.length === 0) {
                toast.error('Select 1 to 4 dishes to sample during your tasting.');
                return;
              }
              setTastingSubmitting(true);
              try {
                await api.post('/tastings', tastingForm);
                toast.success('Food tasting request submitted! Our culinary concierge will confirm your slot.');
                setTastingForm((p) => ({ ...p, selectedDishIds: [], dietaryNotes: '' }));
                await loadAll();
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Could not submit tasting request.');
              } finally {
                setTastingSubmitting(false);
              }
            }}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 text-xs"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Schedule Pre-Event Food Tasting
              </h2>
              <p className="text-stone-500 mt-0.5">
                Sample up to 4 signature dishes with our head chef before finalizing your wedding or corporate menu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Event Type</label>
                <select
                  value={tastingForm.eventType}
                  onChange={(e) => setTastingForm({ ...tastingForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                >
                  <option value="Wedding">Wedding</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Engagement">Engagement</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Festival">Festival</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Estimated Event Guests</label>
                <input
                  type="number"
                  min={20}
                  max={5000}
                  required
                  value={tastingForm.estimatedGuests}
                  onChange={(e) => setTastingForm({ ...tastingForm, estimatedGuests: Number(e.target.value) || 50 })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Preferred Tasting Date</label>
                <input
                  type="date"
                  required
                  value={tastingForm.preferredDate}
                  onChange={(e) => setTastingForm({ ...tastingForm, preferredDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Time Slot</label>
                  <input
                    type="time"
                    required
                    value={tastingForm.preferredTime}
                    onChange={(e) => setTastingForm({ ...tastingForm, preferredTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Tasters (1–6)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={tastingForm.tastingGuests}
                    onChange={(e) => setTastingForm({ ...tastingForm, tastingGuests: Math.min(6, Math.max(1, Number(e.target.value) || 2)) })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1.5">
                Select Dishes to Taste ({tastingForm.selectedDishIds.length}/4 selected)
              </label>
              <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                {catalogDishes.map((dish) => {
                  const checked = tastingForm.selectedDishIds.includes(dish.id);
                  return (
                    <label
                      key={dish.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                        checked
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-600'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setTastingForm((prev) => {
                            if (checked) {
                              return { ...prev, selectedDishIds: prev.selectedDishIds.filter((id) => id !== dish.id) };
                            }
                            if (prev.selectedDishIds.length >= 4) {
                              toast.error('Maximum 4 dishes per tasting session.');
                              return prev;
                            }
                            return { ...prev, selectedDishIds: [...prev.selectedDishIds, dish.id] };
                          });
                        }}
                      />
                      <span className="truncate font-medium">{dish.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Dietary or Spice Notes</label>
              <input
                type="text"
                placeholder="e.g., No onion/garlic for Jain dishes, mild spice preference"
                value={tastingForm.dietaryNotes}
                onChange={(e) => setTastingForm({ ...tastingForm, dietaryNotes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>

            <button
              type="submit"
              disabled={tastingSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold disabled:opacity-50"
            >
              {tastingSubmitting ? 'Submitting Request...' : 'Request Tasting Session'}
            </button>
          </form>

          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              My Tasting Appointments
            </h2>
            {tastings.length === 0 ? (
              <p className="text-xs text-stone-500">No tasting sessions requested yet.</p>
            ) : (
              <div className="space-y-3">
                {tastings.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {t.eventType} Tasting ({t.tastingGuests} tasters)
                      </span>
                      <span className="font-mono font-semibold text-amber-800 dark:text-amber-400">{t.status}</span>
                    </div>
                    <div className="text-stone-500 tabular-nums">
                      Date: {t.preferredDate} at {t.preferredTime} · Est. Event: {t.estimatedGuests} guests
                    </div>
                    <div>
                      <strong>Dishes:</strong> {(t.selectedDishNamesJson || []).join(', ')}
                    </div>
                    {t.adminNotes && (
                      <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300">
                        <strong>Chef / Concierge Note:</strong> {t.adminNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Booking</th>
                <th className="px-5 py-3.5">Type / Method</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3.5 font-mono text-xs">{p.transactionId}</td>
                  <td className="px-5 py-3.5 text-xs">
                    <div className="font-semibold">{p.bookingCode}</div>
                    <div className="text-stone-500">{p.eventName}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {p.paymentType} · {p.method} {p.isDemo ? '(Demo Mode)' : ''}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold">{p.status}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatINR(p.amount)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(p.bookingId, p.bookingCode)}
                      className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline"
                    >
                      PDF Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 max-w-2xl space-y-4">
          <h2 className="font-display text-xl font-bold">Rate a Completed Catering Service</h2>
          <p className="text-xs text-stone-500">
            Only completed bookings are eligible for verified host reviews.
          </p>
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1">Select Completed Booking</label>
              <select
                value={reviewForm.bookingId}
                onChange={(e) => setReviewForm({ ...reviewForm, bookingId: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              >
                <option value={0}>-- Choose Completed Event --</option>
                {eligibleReviewBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bookingCode} — {b.eventName} ({b.eventDate})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Star Rating (1 to 5)</label>
                <select
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>{r} Stars</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Review Title</label>
                <input
                  type="text"
                  required
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  placeholder="Headline for your review"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Your Feedback</label>
              <textarea
                rows={3}
                required
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-semibold">
              Submit Verified Review
            </button>
          </form>
        </div>
      )}

      {/* SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateTicket}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 h-fit"
          >
            <h2 className="font-display text-lg font-bold">Open Support Ticket</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              >
                <option>Menu Customization</option>
                <option>Payment & Invoice</option>
                <option>Schedule Change</option>
                <option>Dietary Request</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Related Booking (Optional)</label>
              <select
                value={ticketForm.bookingId}
                onChange={(e) => setTicketForm({ ...ticketForm, bookingId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              >
                <option value="">General Inquiry</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>{b.bookingCode} — {b.eventName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Subject</label>
              <input
                type="text"
                required
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                rows={3}
                required
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-amber-700 text-white text-xs font-semibold">
              Submit Ticket
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {tickets.map((t) => (
              <div key={t.id} className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-amber-800 dark:text-amber-400 mr-2">{t.ticketNumber}</span>
                    <span className="font-semibold text-sm">{t.subject}</span>
                  </div>
                  <span className="text-xs font-semibold">{t.status}</span>
                </div>
                <div className="space-y-2">
                  {(t.messages || []).map((m: any) => (
                    <div key={m.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 text-xs">
                      <span className="font-semibold">{m.senderRole}: </span>
                      <span>{m.message}</span>
                    </div>
                  ))}
                </div>
                {t.status !== 'Closed' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText[t.id] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [t.id]: e.target.value })}
                      placeholder="Write a reply..."
                      className="flex-1 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!replyText[t.id]?.trim()) return;
                        await api.post(`/support/${t.id}/reply`, { message: replyText[t.id] });
                        setReplyText({ ...replyText, [t.id]: '' });
                        toast.success('Reply sent.');
                        loadAll();
                      }}
                      className="px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Notifications</h2>
            <button
              type="button"
              onClick={async () => {
                await api.patch('/notifications/read-all');
                loadAll();
              }}
              className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {notifications.map((n) => (
              <div key={n.id} className={`py-3.5 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-70' : ''}`}>
                <div>
                  <div className="text-sm font-semibold">{n.title}</div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">{n.message}</p>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.patch(`/notifications/${n.id}/read`);
                      loadAll();
                    }}
                    className="text-xs text-amber-800 dark:text-amber-400 whitespace-nowrap"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE & PREFERENCES */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api.put('/auth/profile', profileForm);
              await refreshProfile();
              toast.success('Profile updated.');
            }}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
          >
            <h2 className="font-display text-lg font-bold">Personal & Delivery Profile</h2>
            <input
              type="text"
              placeholder="Name"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <input
              type="text"
              placeholder="Phone"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <input
              type="text"
              placeholder="Address"
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="City"
                value={profileForm.city}
                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <input
                type="text"
                placeholder="State"
                value={profileForm.state}
                onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Dietary notes"
              value={profileForm.dietaryNotes}
              onChange={(e) => setProfileForm({ ...profileForm, dietaryNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold">
              Save Profile
            </button>
          </form>

          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await api.put('/customers/preferences', prefForm);
                toast.success('AI culinary preferences saved.');
              }}
              className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
            >
              <h2 className="font-display text-lg font-bold">Culinary Preferences</h2>
              <input
                type="text"
                value={prefForm.preferredCuisine}
                onChange={(e) => setPrefForm({ ...prefForm, preferredCuisine: e.target.value })}
                placeholder="Preferred Cuisine"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <input
                type="text"
                value={prefForm.dietaryRestrictions}
                onChange={(e) => setPrefForm({ ...prefForm, dietaryRestrictions: e.target.value })}
                placeholder="Dietary Restrictions (e.g., Jain, Vegan)"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold">
                Save Preferences
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post('/auth/change-password', pwForm);
                  setPwForm({ currentPassword: '', newPassword: '' });
                  toast.success('Password updated.');
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Could not change password.');
                }
              }}
              className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
            >
              <h2 className="font-display text-lg font-bold">Change Password</h2>
              <input
                type="password"
                required
                placeholder="Current password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="New password (6+ chars)"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold">
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {payModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl font-bold">Checkout Payment</h3>
              <button type="button" onClick={() => setPayModalBooking(null)} aria-label="Close payment modal">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 mb-4">
              <strong>DEMO PAYMENT MODE:</strong> Simulated gateway flow when live Razorpay credentials are not configured. No real money is charged.
            </div>
            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Payment Type</label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  {Number(payModalBooking.paidAmount) === 0 && (
                    <option value="ADVANCE">
                      30% Advance ({formatINR(Math.round(Number(payModalBooking.totalAmount) * 0.3))})
                    </option>
                  )}
                  <option value={Number(payModalBooking.paidAmount) === 0 ? 'FULL' : 'BALANCE'}>
                    {Number(payModalBooking.paidAmount) === 0 ? 'Full Payment' : 'Remaining Balance'} (
                    {formatINR(computeRemainingBalance(Number(payModalBooking.totalAmount), Number(payModalBooking.paidAmount)))})
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
                >
                  <option value="UPI">UPI</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="RAZORPAY">Razorpay Gateway</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                <input
                  type="checkbox"
                  checked={simulateFail}
                  onChange={(e) => setSimulateFail(e.target.checked)}
                />
                Simulate payment decline (for testing failure alerts)
              </label>
              <button
                type="submit"
                disabled={payLoading}
                className="w-full py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
              >
                {payLoading ? 'Verifying on Backend...' : 'Verify & Complete Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 text-center shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm">Booking QR Pass · {qrModal.code}</h3>
              <button type="button" onClick={() => setQrModal(null)} aria-label="Close QR modal">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={qrModal.qrDataUrl} alt={`QR verification code for ${qrModal.code}`} className="mx-auto w-52 h-52 rounded-xl border border-stone-200" />
            <p className="mt-3 text-xs text-stone-500">
              Venue coordinators can scan this code to confirm event schedule and status without exposing personal details.
            </p>
            <Link
              to={new URL(qrModal.verifyUrl).pathname}
              className="inline-block mt-4 text-xs font-semibold text-amber-800 dark:text-amber-400 underline"
            >
              Open Verification Page →
            </Link>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 space-y-3 shadow-xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-display text-lg font-bold">Edit Booking ({editModal.bookingCode})</h3>
              <button type="button" onClick={() => setEditModal(null)} aria-label="Close edit modal">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={editModal.eventName}
              onChange={(e) => setEditModal({ ...editModal, eventName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                required
                value={editModal.eventDate}
                onChange={(e) => setEditModal({ ...editModal, eventDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <input
                type="time"
                required
                value={editModal.eventTime}
                onChange={(e) => setEditModal({ ...editModal, eventTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <input
              type="text"
              required
              value={editModal.eventLocation}
              onChange={(e) => setEditModal({ ...editModal, eventLocation: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <textarea
              rows={2}
              value={editModal.dietaryRequirements || ''}
              onChange={(e) => setEditModal({ ...editModal, dietaryRequirements: e.target.value })}
              placeholder="Dietary notes"
              className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-amber-700 text-white text-xs font-semibold">
              Save Booking Changes
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Catering Booking?"
        description={`Are you sure you want to cancel ${cancelTarget?.bookingCode} (${cancelTarget?.eventName})?`}
        confirmLabel="Yes, Cancel Booking"
        onConfirm={handleCancelBooking}
        onCancel={() => setCancelTarget(null)}
      />
    </DashboardLayout>
  );
}
