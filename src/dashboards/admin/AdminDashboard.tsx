import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  CalendarCheck,
  ChefHat,
  CreditCard,
  LifeBuoy,
  Package,
  Plus,
  Settings,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../DashboardLayout';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SafeImage } from '../../components/SafeImage';
import { ShiftCalendarGrid, type ShiftItem } from '../../components/ShiftCalendarGrid';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { api, formatINR } from '../../services/api';
import { BOOKING_STATUSES } from '../../utils/bookingWorkflow';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingFilter, setBookingFilter] = useState('All');
  const [categories, setCategories] = useState<any[]>([]);
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<{ items: any[]; transactions: any[] }>({ items: [], transactions: [] });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [staffSchedule, setStaffSchedule] = useState<ShiftItem[]>([]);
  const [tastings, setTastings] = useState<any[]>([]);
  const [bookingSubView, setBookingSubView] = useState<'list' | 'calendar' | 'tastings'>('list');
  const [tastingNotesDraft, setTastingNotesDraft] = useState<Record<number, string>>({});

  // Confirm Dialog State
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Assign Staff Modal
  const [assignModal, setAssignModal] = useState<any | null>(null);
  const [assignForm, setAssignForm] = useState({
    staffId: '',
    assignedRole: 'Head Chef & Event Lead',
    taskSummary: '',
    forceOverride: false,
  });
  const [assignConflictMsg, setAssignConflictMsg] = useState<string | null>(null);

  // Food Item Form
  const [foodForm, setFoodForm] = useState({
    categoryId: '',
    name: '',
    description: '',
    price: '280',
    unit: 'per plate',
    dietaryType: 'Veg',
    isGlutenFree: false,
    ingredients: '',
    allergens: 'None',
    isFeatured: false,
  });

  // Category Form
  const [catName, setCatName] = useState('');

  // Package Form
  const [pkgForm, setPkgForm] = useState({
    name: '',
    eventType: 'Wedding',
    description: '',
    pricePerPerson: '1150',
    minGuests: '50',
    includedItemsText: 'Welcome Drink, 2 Starters, 3 Mains, Assorted Breads, 2 Desserts',
  });

  // Stock Transaction Modal
  const [stockModal, setStockModal] = useState<any | null>(null);
  const [stockTxForm, setStockTxForm] = useState({
    transactionType: 'STOCK_IN' as 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT',
    amount: '10',
    reason: 'Routine kitchen restock',
  });

  // New Inventory Form
  const [invForm, setInvForm] = useState({
    ingredientName: '',
    category: 'Grains & Staples',
    quantity: '25',
    unit: 'kg',
    minStockLevel: '10',
    purchasePrice: '180',
    supplierId: '',
    expiryDate: '',
  });

  // Supplier Form
  const [supForm, setSupForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: 'Produce & Spices',
  });

  // Coupon Form
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: '15',
    minOrderValue: '10000',
    maxDiscount: '5000',
    expiryDate: '2027-12-31',
  });

  // Staff Create Form
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Staff@123',
    roleTitle: 'Sous Chef',
    specialization: 'Indian & Live Counters',
  });

  // AI Review Analysis
  const [aiReviewAnalysis, setAiReviewAnalysis] = useState<any | null>(null);
  const [analyzingReviews, setAnalyzingReviews] = useState(false);

  // Support Replies
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [replyStatuses, setReplyStatuses] = useState<Record<number, string>>({});

  // Broadcast Form
  const [broadcast, setBroadcast] = useState({ title: '', message: '', targetRole: 'ALL' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        anRes,
        bkRes,
        catRes,
        foodRes,
        pkgRes,
        invRes,
        supRes,
        payRes,
        cpRes,
        custRes,
        stfRes,
        revRes,
        tktRes,
        setRes,
        schedRes,
        tastRes,
      ] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/bookings'),
        api.get('/categories'),
        api.get('/catalog?includeUnavailable=true'),
        api.get('/packages'),
        api.get('/inventory'),
        api.get('/suppliers'),
        api.get('/payments'),
        api.get('/coupons'),
        api.get('/customers'),
        api.get('/staff'),
        api.get('/reviews?all=true'),
        api.get('/support'),
        api.get('/settings'),
        api.get('/ops/staff-schedule'),
        api.get('/tastings'),
      ]);

      setAnalytics(anRes.data.data);
      setBookings(bkRes.data.data || []);
      const cats = catRes.data.data || [];
      setCategories(cats);
      if (cats.length > 0 && !foodForm.categoryId) {
        setFoodForm((prev) => ({ ...prev, categoryId: String(cats[0].id) }));
      }
      setFoodItems(foodRes.data.data || []);
      setPackages(pkgRes.data.data || []);
      setInventoryData(invRes.data.data || { items: [], transactions: [] });
      setSuppliers(supRes.data.data || []);
      setPayments(payRes.data.data || []);
      setCoupons(cpRes.data.data || []);
      setCustomers(custRes.data.data || []);
      const stfs = stfRes.data.data || [];
      setStaffList(stfs);
      if (stfs.length > 0 && !assignForm.staffId) {
        setAssignForm((prev) => ({ ...prev, staffId: String(stfs[0].id) }));
      }
      setReviews(revRes.data.data || []);
      setTickets(tktRes.data.data || []);
      setSettings(setRes.data.data || {});
      setStaffSchedule(schedRes.data.data || []);
      setTastings(tastRes.data.data || []);
    } catch {
      toast.error('Failed to load some admin dashboard datasets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useRealtimeEvents(true, (eventName, payload) => {
    if (['booking:created', 'booking:status', 'assignment:updated', 'tasting:created'].includes(eventName)) {
      toast.info(
        eventName === 'tasting:created'
          ? 'New food tasting request received.'
          : `Live Ops: ${payload.bookingCode || 'Event'} updated`
      );
      loadAll();
    }
  });

  const handleBookingStatusChange = async (bookingId: number, status: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/status`, {
        status,
        note: `Admin updated booking status to ${status}.`,
      });
      toast.success(`Booking status updated to ${status}.`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Status update failed.');
    }
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || !assignForm.staffId) return;
    setAssignConflictMsg(null);
    try {
      await api.post('/ops/assign-staff', {
        bookingId: assignModal.id,
        staffId: Number(assignForm.staffId),
        assignedRole: assignForm.assignedRole,
        taskSummary: assignForm.taskSummary || `Lead kitchen & service setup for ${assignModal.eventName}.`,
        forceOverride: assignForm.forceOverride,
      });
      toast.success('Staff member assigned and notified.');
      setAssignModal(null);
      setAssignConflictMsg(null);
      setAssignForm((p) => ({ ...p, forceOverride: false }));
      await loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to assign staff.';
      if (err.response?.status === 409 && err.response?.data?.code === 'STAFF_CONFLICT') {
        setAssignConflictMsg(msg);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleDownloadPdf = async (bookingId: number, bookingCode: string) => {
    try {
      const res = await api.get(`/invoices/${bookingId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CaterEase-Invoice-${bookingCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice PDF.');
    }
  };

  const handleDownloadKitchenPdf = async (bookingId: number, bookingCode: string) => {
    try {
      const res = await api.get(`/bookings/${bookingId}/kitchen-sheet/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CaterEase-Kitchen-Prep-${bookingCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download kitchen prep sheet PDF.');
    }
  };

  const handleUpdateTastingStatus = async (tastingId: number, status: string) => {
    try {
      await api.patch(`/tastings/${tastingId}/status`, {
        status,
        adminNotes: tastingNotesDraft[tastingId] || undefined,
      });
      toast.success(`Tasting request marked as ${status}.`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update tasting request.');
    }
  };

  const handleCreateFood = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/catalog', {
        ...foodForm,
        categoryId: Number(foodForm.categoryId),
        price: Number(foodForm.price),
      });
      toast.success('Food item added to catalog.');
      setFoodForm((p) => ({ ...p, name: '', description: '', ingredients: '' }));
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add dish.');
    }
  };

  const handleToggleFoodAvailability = async (item: any) => {
    try {
      await api.put(`/catalog/${item.id}`, { isAvailable: !item.isAvailable });
      toast.success(`${item.name} marked ${!item.isAvailable ? 'Available' : 'Unavailable'}.`);
      await loadAll();
    } catch {
      toast.error('Failed to update availability.');
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/packages', {
        name: pkgForm.name,
        eventType: pkgForm.eventType,
        description: pkgForm.description,
        pricePerPerson: Number(pkgForm.pricePerPerson),
        minGuests: Number(pkgForm.minGuests),
        includedItemsJson: pkgForm.includedItemsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        customizationOptionsJson: ['Jain Counter', 'Live Chaat Station', 'Custom Dessert Bar'],
      });
      toast.success('Catering package created.');
      setPkgForm((p) => ({ ...p, name: '', description: '' }));
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create package.');
    }
  };

  const handleStockTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    try {
      await api.post(`/inventory/${stockModal.id}/transaction`, {
        transactionType: stockTxForm.transactionType,
        amount: Number(stockTxForm.amount),
        reason: stockTxForm.reason,
      });
      toast.success('Inventory stock updated.');
      setStockModal(null);
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Stock update failed.');
    }
  };

  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory', {
        ingredientName: invForm.ingredientName,
        category: invForm.category,
        quantity: Number(invForm.quantity),
        unit: invForm.unit,
        minStockLevel: Number(invForm.minStockLevel),
        purchasePrice: Number(invForm.purchasePrice),
        supplierId: invForm.supplierId ? Number(invForm.supplierId) : null,
        expiryDate: invForm.expiryDate || null,
      });
      toast.success('Inventory ingredient registered.');
      setInvForm((p) => ({ ...p, ingredientName: '' }));
      await loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add inventory.');
    }
  };

  const handleAnalyzeReviews = async () => {
    setAnalyzingReviews(true);
    try {
      const res = await api.post('/ai/review-analysis');
      setAiReviewAnalysis(res.data.data);
      toast.success('Gemini AI analyzed customer sentiment.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'AI review analysis unavailable.');
    } finally {
      setAnalyzingReviews(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const filteredBookings =
    bookingFilter === 'All' ? bookings : bookings.filter((b) => b.status === bookingFilter);

  const navItems = [
    { id: 'overview', label: 'Analytics & KPIs', icon: BarChart3 },
    {
      id: 'bookings',
      label: 'Bookings & Staff',
      icon: CalendarCheck,
      badge: bookings.filter((b) => b.status === 'Pending').length,
    },
    { id: 'catalog', label: 'Food & Categories', icon: ChefHat },
    { id: 'packages', label: 'Catering Packages', icon: Package },
    {
      id: 'inventory',
      label: 'Inventory & Suppliers',
      icon: Boxes,
      badge: inventoryData.items.filter((i) => i.isLowStock).length,
    },
    { id: 'finance', label: 'Payments & Coupons', icon: CreditCard },
    { id: 'people', label: 'Customers & Staff', icon: Users },
    { id: 'reviews', label: 'Reviews & AI Insights', icon: Star },
    {
      id: 'support',
      label: 'Support Tickets',
      icon: LifeBuoy,
      badge: tickets.filter((t) => t.status === 'Open').length,
    },
    { id: 'settings', label: 'Broadcast & Settings', icon: Settings },
  ];

  return (
    <DashboardLayout
      title="Admin Operations Console"
      subtitle="Manage bookings, staff rosters, inventory, Recharts telemetry, Gemini sentiment, and financial controls."
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {activeTab === 'overview' && (
        <AdminAnalyticsView
          analytics={analytics}
          loading={loading}
          onJumpInventory={() => setActiveTab('inventory')}
        />
      )}

      {/* BOOKINGS, SHIFT CALENDAR & TASTING REQUESTS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBookingSubView('list')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                  bookingSubView === 'list'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                Bookings ({bookings.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingSubView('calendar')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                  bookingSubView === 'calendar'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                Crew Shift Calendar ({staffSchedule.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingSubView('tastings')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                  bookingSubView === 'tastings'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                Tasting Requests ({tastings.filter((t) => t.status === 'Requested').length} pending)
              </button>
            </div>

            {bookingSubView === 'list' && (
              <select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                aria-label="Filter bookings by status"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium"
              >
                <option value="All">All Statuses</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          {bookingSubView === 'calendar' && (
            <ShiftCalendarGrid shifts={staffSchedule} title="Crew Shift Calendar & Availability Monitor" />
          )}

          {bookingSubView === 'tastings' && (
            <div className="space-y-3">
              {tastings.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm text-stone-500">
                  No pre-event food tasting requests submitted yet.
                </div>
              ) : (
                tastings.map((t) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                          {t.customerName} ({t.customerEmail}) · {t.eventType}
                        </div>
                        <div className="text-stone-500 mt-0.5 tabular-nums">
                          Requested Slot: {t.preferredDate} at {t.preferredTime} · {t.tastingGuests} tasters · Est. Event: {t.estimatedGuests} guests
                        </div>
                        <div className="mt-1">
                          <strong>Selected Dishes:</strong> {(t.selectedDishNamesJson || []).join(', ')}
                        </div>
                        {t.dietaryNotes && (
                          <div className="text-stone-500 mt-0.5">Dietary Notes: {t.dietaryNotes}</div>
                        )}
                      </div>
                      <span className="font-mono font-bold text-amber-800 dark:text-amber-400">{t.status}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <input
                        type="text"
                        placeholder="Add chef/concierge notes (e.g., Tasting kitchen Room B confirmed)"
                        value={tastingNotesDraft[t.id] ?? t.adminNotes ?? ''}
                        onChange={(e) => setTastingNotesDraft({ ...tastingNotesDraft, [t.id]: e.target.value })}
                        className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateTastingStatus(t.id, 'Scheduled')}
                        className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold"
                      >
                        Confirm Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateTastingStatus(t.id, 'Completed')}
                        className="px-3 py-1.5 rounded-lg bg-teal-700 text-white font-semibold"
                      >
                        Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateTastingStatus(t.id, 'Declined')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {bookingSubView === 'list' && (

          <div className="space-y-3">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-xs text-amber-800 dark:text-amber-400">
                      {b.bookingCode} · {b.eventDate} at {b.eventTime}
                    </div>
                    <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                      {b.eventName}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Client: {b.customerName} ({b.customerEmail}) · {b.guestCount} guests · {b.eventLocation}
                    </p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                      {formatINR(b.totalAmount)}
                    </div>
                    <div className="text-stone-500">
                      Paid: {formatINR(b.paidAmount)} · {b.paymentStatus}
                    </div>
                    <div className="font-semibold text-amber-800 dark:text-amber-400 mt-0.5">
                      Status: {b.status}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  {b.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => handleBookingStatusChange(b.id, 'Confirmed')}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                    >
                      Confirm Booking
                    </button>
                  )}
                  {b.status === 'Confirmed' && (
                    <button
                      type="button"
                      onClick={() => handleBookingStatusChange(b.id, 'Preparing')}
                      className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                    >
                      Move to Preparing
                    </button>
                  )}
                  {b.status === 'Preparing' && (
                    <button
                      type="button"
                      onClick={() => handleBookingStatusChange(b.id, 'Ready for Delivery')}
                      className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                    >
                      Mark Ready for Delivery
                    </button>
                  )}
                  {b.status === 'Ready for Delivery' && (
                    <button
                      type="button"
                      onClick={() => handleBookingStatusChange(b.id, 'Event in Progress')}
                      className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                    >
                      Start Event
                    </button>
                  )}
                  {b.status === 'Event in Progress' && (
                    <button
                      type="button"
                      onClick={() => handleBookingStatusChange(b.id, 'Completed')}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                    >
                      Mark Completed
                    </button>
                  )}

                  {b.status !== 'Completed' && b.status !== 'Cancelled' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignConflictMsg(null);
                          setAssignModal(b);
                          setAssignForm((p) => ({
                            ...p,
                            forceOverride: false,
                            taskSummary: `Coordinate culinary prep and live setup for ${b.eventName} (${b.guestCount} guests).`,
                          }));
                        }}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                      >
                        Assign Staff
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            open: true,
                            title: `Cancel Booking ${b.bookingCode}?`,
                            description:
                              'Cancelling will notify the customer immediately and close this event slot.',
                            confirmLabel: 'Cancel Booking',
                            destructive: true,
                            onConfirm: () => handleBookingStatusChange(b.id, 'Cancelled'),
                          })
                        }
                        className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadKitchenPdf(b.id, b.bookingCode)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                    >
                      Kitchen Sheet PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(b.id, b.bookingCode)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                    >
                      PDF Invoice
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* FOOD CATALOG & CATEGORIES */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Food Item */}
            <form
              onSubmit={handleCreateFood}
              className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4"
            >
              <h2 className="font-display text-lg font-bold">Add New Culinary Dish</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Dish Name</label>
                  <input
                    required
                    value={foodForm.name}
                    onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={foodForm.categoryId}
                    onChange={(e) => setFoodForm({ ...foodForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Price (INR)</label>
                  <input
                    type="number"
                    required
                    min="10"
                    value={foodForm.price}
                    onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Dietary Type</label>
                  <select
                    value={foodForm.dietaryType}
                    onChange={(e) => setFoodForm({ ...foodForm, dietaryType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Jain">Jain</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Ingredients</label>
                  <input
                    required
                    value={foodForm.ingredients}
                    onChange={(e) => setFoodForm({ ...foodForm, ingredients: e.target.value })}
                    placeholder="Saffron, Aged Basmati, Cardamom, Clarified Butter"
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Description</label>
                  <textarea
                    required
                    rows={2}
                    value={foodForm.description}
                    onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dish
              </button>
            </form>

            {/* Manage Categories */}
            <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
              <h2 className="font-display text-lg font-bold">Food Categories</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!catName.trim()) return;
                  try {
                    await api.post('/categories', { name: catName });
                    setCatName('');
                    toast.success('Category created.');
                    loadAll();
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to add category.');
                  }
                }}
                className="flex gap-2 text-xs"
              >
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="New category..."
                  className="flex-1 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <button type="submit" className="px-3 py-2 rounded-lg bg-amber-700 text-white font-semibold">
                  Add
                </button>
              </form>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
                {categories.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Delete Category "${c.name}"?`,
                          description: 'Only empty categories with no attached menu items can be removed.',
                          confirmLabel: 'Delete Category',
                          destructive: true,
                          onConfirm: async () => {
                            try {
                              await api.delete(`/categories/${c.id}`);
                              toast.success('Category deleted.');
                              await loadAll();
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || 'Category still has food items.');
                            }
                          },
                        })
                      }
                      className="text-red-500 hover:text-red-600 p-1"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Food Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <h3 className="font-display text-lg font-bold mb-4">Catalog Items ({foodItems.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="pb-2 font-medium">Dish</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Dietary</th>
                    <th className="pb-2 font-medium">Price</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {foodItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 flex items-center gap-3">
                        <SafeImage src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{item.name}</span>
                      </td>
                      <td className="py-3 text-stone-500">{item.categoryName}</td>
                      <td className="py-3">{item.dietaryType}</td>
                      <td className="py-3 font-semibold tabular-nums">{formatINR(item.price)}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleFoodAvailability(item)}
                          className={`font-semibold ${item.isAvailable ? 'text-teal-700 dark:text-teal-400' : 'text-stone-400'}`}
                        >
                          {item.isAvailable ? 'Available' : 'Paused'}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Delete "${item.name}"?`,
                              description: 'This removes the dish from the active food catalog.',
                              confirmLabel: 'Delete Dish',
                              destructive: true,
                              onConfirm: async () => {
                                await api.delete(`/catalog/${item.id}`);
                                toast.success('Food item deleted.');
                                await loadAll();
                              },
                            })
                          }
                          className="text-red-600 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PACKAGES CRUD */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreatePackage}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <h2 className="font-display text-lg font-bold">Create Catering Package</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Package Name</label>
                <input
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Event Type</label>
                <input
                  required
                  value={pkgForm.eventType}
                  onChange={(e) => setPkgForm({ ...pkgForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Price / Guest (INR)</label>
                <input
                  type="number"
                  required
                  value={pkgForm.pricePerPerson}
                  onChange={(e) => setPkgForm({ ...pkgForm, pricePerPerson: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Min Guests</label>
                <input
                  type="number"
                  required
                  value={pkgForm.minGuests}
                  onChange={(e) => setPkgForm({ ...pkgForm, minGuests: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-medium mb-1">Included Courses (comma-separated)</label>
                <input
                  required
                  value={pkgForm.includedItemsText}
                  onChange={(e) => setPkgForm({ ...pkgForm, includedItemsText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold">
              Publish Package
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-800 dark:text-amber-400">
                    {p.eventType} · Min {p.minGuests} guests
                  </div>
                  <h3 className="font-display text-lg font-bold">{p.name}</h3>
                  <p className="text-xs text-stone-500">{p.description}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col justify-between">
                  <div className="text-base font-bold tabular-nums">{formatINR(p.pricePerPerson)}/guest</div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        open: true,
                        title: `Delete "${p.name}"?`,
                        description: 'This permanently deletes the package listing.',
                        confirmLabel: 'Delete Package',
                        destructive: true,
                        onConfirm: async () => {
                          await api.delete(`/packages/${p.id}`);
                          toast.success('Package deleted.');
                          await loadAll();
                        },
                      })
                    }
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVENTORY & SUPPLIERS */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <h2 className="font-display text-xl font-bold mb-4">Kitchen Ingredient Inventory</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="pb-2 font-medium">Ingredient</th>
                    <th className="pb-2 font-medium">Supplier</th>
                    <th className="pb-2 font-medium">Stock</th>
                    <th className="pb-2 font-medium">Threshold</th>
                    <th className="pb-2 font-medium">Expiry</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {inventoryData.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">{item.ingredientName}</div>
                        <div className="text-stone-500">{item.category}</div>
                      </td>
                      <td className="py-3 text-stone-500">{item.supplierName}</td>
                      <td className="py-3 tabular-nums font-semibold">
                        <span className={item.isLowStock ? 'text-red-600 dark:text-red-400' : ''}>
                          {item.quantity} {item.unit}
                        </span>
                        {item.isLowStock && <div className="text-[10px] text-red-600">Low Stock</div>}
                      </td>
                      <td className="py-3 tabular-nums text-stone-500">
                        {item.minStockLevel} {item.unit}
                      </td>
                      <td className="py-3 tabular-nums">
                        <span>{item.expiryDate || 'N/A'}</span>
                        {item.expiryStatus !== 'OK' && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            {item.expiryStatus.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStockModal(item);
                            setStockTxForm({ transactionType: 'STOCK_IN', amount: '15', reason: 'Supplier restock' });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-700 text-white font-semibold"
                        >
                          Stock In/Out
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Remove "${item.ingredientName}"?`,
                              description: 'Deletes the ingredient record and associated stock history.',
                              confirmLabel: 'Remove Item',
                              destructive: true,
                              onConfirm: async () => {
                                await api.delete(`/inventory/${item.id}`);
                                toast.success('Ingredient deleted.');
                                await loadAll();
                              },
                            })
                          }
                          className="text-red-600 font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add Ingredient */}
            <form
              onSubmit={handleCreateInventory}
              className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 text-xs"
            >
              <h3 className="font-display text-lg font-bold">Register Ingredient</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Ingredient name"
                  value={invForm.ingredientName}
                  onChange={(e) => setInvForm({ ...invForm, ingredientName: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <input
                  required
                  type="number"
                  placeholder="Qty"
                  value={invForm.quantity}
                  onChange={(e) => setInvForm({ ...invForm, quantity: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <input
                  required
                  placeholder="Unit (kg, L, pcs)"
                  value={invForm.unit}
                  onChange={(e) => setInvForm({ ...invForm, unit: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <input
                  required
                  type="number"
                  placeholder="Min Stock Threshold"
                  value={invForm.minStockLevel}
                  onChange={(e) => setInvForm({ ...invForm, minStockLevel: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <select
                  value={invForm.supplierId}
                  onChange={(e) => setInvForm({ ...invForm, supplierId: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold">
                Add Ingredient
              </button>
            </form>

            {/* Recent Stock Transactions */}
            <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <h3 className="font-display text-lg font-bold mb-3">Recent Stock Transactions</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {inventoryData.transactions.slice(0, 12).map((tx) => (
                  <div key={tx.id} className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {tx.ingredientName} · {tx.transactionType}
                      </div>
                      <div className="text-stone-500">
                        {tx.reason} · by {tx.performedByName}
                      </div>
                    </div>
                    <div className="font-mono font-semibold tabular-nums text-right">
                      {Number(tx.quantityChange) >= 0 ? `+${tx.quantityChange}` : tx.quantityChange} {tx.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Suppliers */}
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <h3 className="font-display text-lg font-bold">Verified Vendors & Suppliers</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post('/suppliers', supForm);
                  toast.success('Supplier added.');
                  setSupForm({ name: '', contactPerson: '', email: '', phone: '', address: '', category: 'Produce & Spices' });
                  loadAll();
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to add supplier.');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
            >
              <input required placeholder="Vendor Name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required placeholder="Contact Person" value={supForm.contactPerson} onChange={(e) => setSupForm({ ...supForm, contactPerson: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required type="email" placeholder="Email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required placeholder="Phone" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required placeholder="Address" value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold">Add Supplier</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {suppliers.map((s) => (
                <div key={s.id} className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex justify-between gap-2">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-stone-500">{s.contactPerson} · {s.phone} · {s.category}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.delete(`/suppliers/${s.id}`);
                      toast.success('Supplier removed.');
                      loadAll();
                    }}
                    className="text-red-500 font-semibold shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS & COUPONS */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <h2 className="font-display text-xl font-bold mb-4">Payments & Refund Ledger</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="pb-2">Txn ID</th>
                    <th className="pb-2">Booking</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 font-mono">{p.transactionId}</td>
                      <td className="py-3">{p.bookingCode}</td>
                      <td className="py-3">{p.customerName || 'Guest'}</td>
                      <td className="py-3">{p.method}{p.isDemo ? ' (Demo)' : ''}</td>
                      <td className="py-3 font-semibold tabular-nums">{formatINR(p.amount)}</td>
                      <td className="py-3 font-semibold">{p.status}</td>
                      <td className="py-3 text-right">
                        {p.status === 'PAID' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: `Refund ${formatINR(p.amount)}?`,
                                description: `Marks transaction ${p.transactionId} as REFUNDED and updates booking paid balance.`,
                                confirmLabel: 'Issue Refund',
                                destructive: true,
                                onConfirm: async () => {
                                  await api.post(`/payments/${p.id}/refund`);
                                  toast.success('Payment marked as refunded.');
                                  await loadAll();
                                },
                              })
                            }
                            className="text-red-600 font-semibold hover:underline"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <h3 className="font-display text-lg font-bold">Promotional Coupons</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post('/coupons', {
                    code: couponForm.code,
                    description: couponForm.description,
                    discountType: couponForm.discountType,
                    discountValue: Number(couponForm.discountValue),
                    minOrderValue: Number(couponForm.minOrderValue),
                    maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : null,
                    startDate: new Date().toISOString(),
                    expiryDate: new Date(couponForm.expiryDate).toISOString(),
                  });
                  toast.success('Coupon created.');
                  setCouponForm((p) => ({ ...p, code: '', description: '' }));
                  loadAll();
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to create coupon.');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
            >
              <input required placeholder="Code (e.g. DIWALI20)" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 font-mono" />
              <input required placeholder="Description" value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as any })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (INR)</option>
              </select>
              <input required type="number" placeholder="Discount Value" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required type="number" placeholder="Min Order Value" value={couponForm.minOrderValue} onChange={(e) => setCouponForm({ ...couponForm, minOrderValue: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required type="date" value={couponForm.expiryDate} onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold">Create Coupon</button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {coupons.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-amber-800 dark:text-amber-400">{c.code}</div>
                    <div className="text-stone-500 mt-0.5">{c.description}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await api.patch(`/coupons/${c.id}/toggle`);
                        loadAll();
                      }}
                      className="font-semibold text-teal-700 dark:text-teal-400"
                    >
                      {c.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.delete(`/coupons/${c.id}`);
                        loadAll();
                      }}
                      className="text-red-500 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMERS & STAFF ROSTER */}
      {activeTab === 'people' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <h2 className="font-display text-xl font-bold">Staff Roster ({staffList.length})</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post('/staff', staffForm);
                  toast.success('Staff member created.');
                  setStaffForm((p) => ({ ...p, name: '', email: '', phone: '' }));
                  loadAll();
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to add staff.');
                }
              }}
              className="grid grid-cols-2 gap-2.5 text-xs pb-4 border-b border-stone-100 dark:border-stone-800"
            >
              <input required placeholder="Full Name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required type="email" placeholder="Staff Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required placeholder="Phone" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <input required placeholder="Role Title" value={staffForm.roleTitle} onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })} className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700" />
              <button type="submit" className="col-span-2 py-2 rounded-lg bg-amber-700 text-white font-semibold inline-flex items-center justify-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Add Kitchen / Service Staff
              </button>
            </form>
            <div className="space-y-2 text-xs">
              {staffList.map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex justify-between">
                  <div>
                    <div className="font-semibold">{s.name} ({s.staffCode})</div>
                    <div className="text-stone-500">{s.roleTitle} · {s.specialization}</div>
                  </div>
                  <div className="text-right text-stone-500">{s.email}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <h2 className="font-display text-xl font-bold">Registered Customers ({customers.length})</h2>
            <div className="space-y-2 text-xs">
              {customers.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex justify-between gap-2">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-stone-500">{c.email} · {c.city || 'Mumbai'}</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-semibold text-amber-800 dark:text-amber-400">{c.loyaltyPoints} pts</div>
                    <div className="text-stone-500">{c.phone || 'No phone'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REVIEWS & AI ANALYSIS */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">Customer Reviews & Gemini Sentiment Intelligence</h2>
                <p className="text-xs text-stone-500">Moderate client feedback or run Gemini AI across all event reviews.</p>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeReviews}
                disabled={analyzingReviews}
                className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzingReviews ? 'Analyzing with Gemini...' : 'Run AI Review Analysis'}
              </button>
            </div>

            {aiReviewAnalysis && (
              <div className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-amber-900 dark:text-amber-300">
                    Overall Sentiment: {aiReviewAnalysis.overallSentiment}
                  </div>
                </div>
                <p className="text-stone-700 dark:text-stone-300">{aiReviewAnalysis.satisfactionSummary}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <div className="font-semibold text-teal-800 dark:text-teal-400 mb-1">Strengths</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {(aiReviewAnalysis.positiveHighlights || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-red-700 dark:text-red-400 mb-1">Watchpoints</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {[...(aiReviewAnalysis.negativeFeedback || []), ...(aiReviewAnalysis.commonComplaints || [])].map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-amber-800 dark:text-amber-400 mb-1">Action Items</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {(aiReviewAnalysis.improvementSuggestions || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-wrap justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-stone-900 dark:text-stone-100">
                    {r.title} · {'★'.repeat(r.rating)}
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 mt-1">{r.comment}</p>
                  <div className="text-stone-400 mt-1">
                    {r.customerName} · {r.eventName} ({r.eventType})
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await api.patch(`/reviews/${r.id}/moderate`);
                      loadAll();
                    }}
                    className={`font-semibold ${r.isApproved ? 'text-teal-700 dark:text-teal-400' : 'text-stone-400'}`}
                  >
                    {r.isApproved ? 'Published' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.delete(`/reviews/${r.id}`);
                      toast.success('Review deleted.');
                      loadAll();
                    }}
                    className="text-red-500 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Customer Support Tickets</h2>
          {tickets.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-mono text-amber-800 dark:text-amber-400">
                    {t.ticketNumber} · {t.customerName} ({t.customerEmail})
                  </div>
                  <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">{t.subject}</h3>
                </div>
                <div className="font-semibold">Status: {t.status} · Priority: {t.priority}</div>
              </div>
              <div className="space-y-1.5 bg-stone-50 dark:bg-stone-950 p-3 rounded-xl">
                {(t.messages || []).map((m: any) => (
                  <div key={m.id}>
                    <span className="font-semibold">{m.senderRole}:</span> {m.message}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={replyTexts[t.id] || ''}
                  onChange={(e) => setReplyTexts({ ...replyTexts, [t.id]: e.target.value })}
                  placeholder="Write official support response..."
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                />
                <select
                  value={replyStatuses[t.id] || t.status}
                  onChange={(e) => setReplyStatuses({ ...replyStatuses, [t.id]: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!replyTexts[t.id]?.trim()) return;
                    await api.post(`/support/${t.id}/reply`, {
                      message: replyTexts[t.id],
                      status: replyStatuses[t.id] || 'Resolved',
                    });
                    toast.success('Reply sent to customer.');
                    setReplyTexts({ ...replyTexts, [t.id]: '' });
                    loadAll();
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold"
                >
                  Send Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BROADCAST & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await api.post('/notifications/broadcast', broadcast);
                toast.success(res.data.message);
                setBroadcast({ title: '', message: '', targetRole: 'ALL' });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Broadcast failed.');
              }
            }}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 text-xs"
          >
            <h2 className="font-display text-lg font-bold">Broadcast Notification</h2>
            <div>
              <label className="block font-medium mb-1">Target Audience</label>
              <select
                value={broadcast.targetRole}
                onChange={(e) => setBroadcast({ ...broadcast, targetRole: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              >
                <option value="ALL">All Users</option>
                <option value="CUSTOMER">Customers Only</option>
                <option value="STAFF">Staff Only</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Announcement Title</label>
              <input
                required
                value={broadcast.title}
                onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Message</label>
              <textarea
                required
                rows={3}
                value={broadcast.message}
                onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold">
              Send Broadcast
            </button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api.put('/settings', settings);
              toast.success('Business settings updated.');
            }}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 text-xs"
          >
            <h2 className="font-display text-lg font-bold">Business Configuration</h2>
            <div>
              <label className="block font-medium mb-1">Company Name</label>
              <input
                value={settings.company_name || 'CaterEase Culinary & Events Pvt. Ltd.'}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Concierge Support Email</label>
              <input
                value={settings.support_email || 'concierge@caterease.com'}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">GST / Tax Rate (%)</label>
              <input
                value={settings.tax_rate_percent || '18'}
                onChange={(e) => setSettings({ ...settings, tax_rate_percent: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-amber-700 text-white font-semibold">
              Save Business Settings
            </button>
          </form>
        </div>
      )}

      {/* ASSIGN STAFF MODAL */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleAssignStaff}
            className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 text-xs shadow-xl"
          >
            <h3 className="font-display text-lg font-bold">
              Assign Staff to {assignModal.bookingCode} ({assignModal.eventDate})
            </h3>
            {assignConflictMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 space-y-2">
                <p className="font-medium">{assignConflictMsg}</p>
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.forceOverride}
                    onChange={(e) => setAssignForm({ ...assignForm, forceOverride: e.target.checked })}
                  />
                  Override conflict and double-assign this crew member anyway
                </label>
              </div>
            )}
            <div>
              <label className="block font-medium mb-1">Select Staff Member</label>
              <select
                value={assignForm.staffId}
                onChange={(e) => {
                  setAssignConflictMsg(null);
                  setAssignForm({ ...assignForm, staffId: e.target.value, forceOverride: false });
                }}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.roleTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Assigned Event Role</label>
              <input
                required
                value={assignForm.assignedRole}
                onChange={(e) => setAssignForm({ ...assignForm, assignedRole: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Task Summary</label>
              <textarea
                required
                rows={3}
                value={assignForm.taskSummary}
                onChange={(e) => setAssignForm({ ...assignForm, taskSummary: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignModal(null);
                  setAssignConflictMsg(null);
                }}
                className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold">
                {assignForm.forceOverride ? 'Override & Assign Staff' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STOCK TRANSACTION MODAL */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleStockTransaction}
            className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 text-xs shadow-xl"
          >
            <h3 className="font-display text-lg font-bold">
              Update Stock: {stockModal.ingredientName}
            </h3>
            <p className="text-stone-500">
              Current Stock: {stockModal.quantity} {stockModal.unit}
            </p>
            <div>
              <label className="block font-medium mb-1">Transaction Type</label>
              <select
                value={stockTxForm.transactionType}
                onChange={(e) => setStockTxForm({ ...stockTxForm, transactionType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              >
                <option value="STOCK_IN">Stock In (+ Add)</option>
                <option value="STOCK_OUT">Stock Out (- Deduct)</option>
                <option value="ADJUSTMENT">Audit Adjustment (= Set Exact)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Quantity ({stockModal.unit})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={stockTxForm.amount}
                onChange={(e) => setStockTxForm({ ...stockTxForm, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Reason / Reference</label>
              <input
                required
                value={stockTxForm.reason}
                onChange={(e) => setStockTxForm({ ...stockTxForm, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStockModal(null)} className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold">
                Save Transaction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REUSABLE CONFIRMATION DIALOG */}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          destructive={confirmState.destructive}
          loading={confirmLoading}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </DashboardLayout>
  );
}
