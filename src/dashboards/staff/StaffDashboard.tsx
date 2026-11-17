import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarCheck, ChefHat, ClipboardList, Download, LayoutDashboard, Radio, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../DashboardLayout';
import { ShiftCalendarGrid, type ShiftItem } from '../../components/ShiftCalendarGrid';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { api } from '../../services/api';

export function StaffDashboard() {
  const [activeTab, setActiveTab] = useState('assignments');
  const [assignedEvents, setAssignedEvents] = useState<any[]>([]);
  const [scheduleShifts, setScheduleShifts] = useState<ShiftItem[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bkRes, notifRes, schedRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/notifications'),
        api.get('/ops/staff-schedule'),
      ]);
      setAssignedEvents(bkRes.data.data || []);
      setNotifications(notifRes.data.data?.items || []);
      setUnreadCount(notifRes.data.data?.unreadCount || 0);
      setScheduleShifts(schedRes.data.data || []);
    } catch {
      toast.error('Failed to load staff assignments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { connected: liveConnected } = useRealtimeEvents(true, (eventName, payload) => {
    if (eventName === 'staff:assigned' || eventName === 'booking:status') {
      toast.info(`Live Update: ${payload.bookingCode || 'Event'} ${payload.status ? `-> ${payload.status}` : 'assignment updated'}`);
      loadData();
    }
  });

  const handleUpdatePrep = async (assignmentId: number, updates: Record<string, string>) => {
    try {
      await api.patch(`/ops/assignments/${assignmentId}`, updates);
      toast.success('Assignment progress updated & broadcast live.');
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleAdvanceBookingStatus = async (bookingId: number, status: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/status`, {
        status,
        note: `Updated by assigned culinary staff to ${status}.`,
      });
      toast.success(`Event status updated to ${status}`);
      await loadData();
      if (selectedDetail?.id === bookingId) {
        const res = await api.get(`/bookings/${bookingId}`);
        setSelectedDetail(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not update booking status.');
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
      toast.error('Could not download kitchen prep sheet PDF.');
    }
  };

  const completedCount = assignedEvents.filter((e) => e.assignment?.prepStatus === 'COMPLETED' || e.status === 'Completed').length;
  const pendingCount = assignedEvents.length - completedCount;

  const navItems = [
    { id: 'assignments', label: 'Assigned Events', icon: ClipboardList, badge: pendingCount },
    { id: 'schedule', label: 'Shift Calendar', icon: CalendarCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
  ];

  return (
    <DashboardLayout
      title="Staff Kitchen & Service Portal"
      subtitle="Manage food prep checklists, allergen compliance sheets, delivery dispatch, and live event execution."
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Bookings', value: assignedEvents.length, icon: LayoutDashboard },
          { label: 'Active Tasks', value: pendingCount, icon: ChefHat },
          { label: 'Completed Assignments', value: completedCount, icon: CalendarCheck },
          { label: 'Live Kitchen Stream', value: liveConnected ? 'Connected' : 'Syncing', icon: Radio },
        ].map((kpi) => (
          <div key={kpi.label} className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            <div className="text-xs text-stone-500 dark:text-stone-400">{kpi.label}</div>
            <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">{kpi.value}</div>
          </div>
        ))}
      </div>

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-40 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
          ) : assignedEvents.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm text-stone-500">
              No catering events assigned to you right now.
            </div>
          ) : (
            assignedEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-xs text-amber-800 dark:text-amber-400">
                      {ev.bookingCode} · {ev.eventDate} at {ev.eventTime}
                    </div>
                    <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                      {ev.eventName}
                    </h2>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                      {ev.guestCount} guests · {ev.eventLocation} · Package: {ev.packageName || 'Custom A La Carte'}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold text-stone-900 dark:text-stone-100">Booking: {ev.status}</div>
                    <div className="text-stone-500 mt-0.5">Role: {ev.assignment?.assignedRole}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-xs space-y-1.5">
                  <p><strong>Task Summary:</strong> {ev.assignment?.taskSummary}</p>
                  <p><strong>Dietary Requirements:</strong> {ev.dietaryRequirements || 'Standard menu'}</p>
                  <p><strong>Special Instructions:</strong> {ev.specialInstructions || 'None'}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Prep Status</label>
                      <select
                        value={ev.assignment?.prepStatus || 'PENDING'}
                        onChange={(e) => handleUpdatePrep(ev.assignment.id, { prepStatus: e.target.value })}
                        className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-medium"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PREPARING">Preparing</option>
                        <option value="READY">Ready</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">Delivery Status</label>
                      <select
                        value={ev.assignment?.deliveryStatus || 'PENDING'}
                        onChange={(e) => handleUpdatePrep(ev.assignment.id, { deliveryStatus: e.target.value })}
                        className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-medium"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="DISPATCHED">Dispatched</option>
                        <option value="DELIVERED">Delivered</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {ev.status === 'Confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceBookingStatus(ev.id, 'Preparing')}
                        className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                      >
                        Start Preparing
                      </button>
                    )}
                    {ev.status === 'Preparing' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceBookingStatus(ev.id, 'Ready for Delivery')}
                        className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                      >
                        Mark Ready for Delivery
                      </button>
                    )}
                    {ev.status === 'Ready for Delivery' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceBookingStatus(ev.id, 'Event in Progress')}
                        className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                      >
                        Event in Progress
                      </button>
                    )}
                    {ev.status === 'Event in Progress' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceBookingStatus(ev.id, 'Completed')}
                        className="px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold"
                      >
                        Mark Event Completed
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadKitchenPdf(ev.id, ev.bookingCode)}
                      className="px-3.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Prep Sheet PDF
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await api.get(`/bookings/${ev.id}`);
                        setSelectedDetail(res.data.data);
                      }}
                      className="px-3.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold"
                    >
                      Prep & Allergens
                    </button>
                  </div>
                </div>

                {selectedDetail?.id === ev.id && (
                  <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-4 text-xs">
                    {selectedDetail.kitchenMatrix && (
                      <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-stone-900 dark:text-stone-100">
                          <span className="inline-flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-amber-700" />
                            Dietary & Allergen Compliance Matrix
                          </span>
                          <span className="font-mono tabular-nums text-[11px]">
                            Max Prep Window: {selectedDetail.kitchenMatrix.maxPrepTimeMins} mins
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            Veg Dishes: <strong>{selectedDetail.kitchenMatrix.dietaryBreakdown.Veg}</strong>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            Non-Veg Dishes: <strong>{selectedDetail.kitchenMatrix.dietaryBreakdown['Non-Veg']}</strong>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            Vegan Dishes: <strong>{selectedDetail.kitchenMatrix.dietaryBreakdown.Vegan}</strong>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            Jain Dishes: <strong>{selectedDetail.kitchenMatrix.dietaryBreakdown.Jain}</strong>
                          </div>
                        </div>
                        <p className="text-[11px]">
                          <strong>Detected Allergens:</strong>{' '}
                          {selectedDetail.kitchenMatrix.detectedAllergens.length
                            ? selectedDetail.kitchenMatrix.detectedAllergens.join(', ')
                            : 'None declared'}{' '}
                          · <strong>Jain Isolation:</strong>{' '}
                          {selectedDetail.kitchenMatrix.requiresJainIsolation ? 'Required (Green Dedicated Line)' : 'Standard'}
                        </p>
                      </div>
                    )}

                    <div>
                      <div className="font-semibold mb-2">Food Preparation List</div>
                      {selectedDetail.items?.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedDetail.items.map((item: any) => (
                            <li key={item.id} className="flex flex-wrap justify-between gap-2 p-2 rounded-lg bg-stone-50 dark:bg-stone-950">
                              <span>
                                <strong>{item.itemName}</strong> · {item.dietaryType} (Allergens: {item.allergens})
                              </span>
                              <span className="font-mono font-semibold tabular-nums">{item.quantity} portions</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-stone-500">
                          Standard package items for {selectedDetail.packageInfo?.name || 'event'}:{' '}
                          {(selectedDetail.packageInfo?.includedItemsJson || []).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <ShiftCalendarGrid shifts={scheduleShifts} title="My Culinary & Event Shift Calendar" />
      )}

      {activeTab === 'notifications' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
          <h2 className="font-display text-xl font-bold">Staff Notifications</h2>
          {notifications.map((n) => (
            <div key={n.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex justify-between gap-4 text-xs">
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="text-stone-500 mt-0.5">{n.message}</div>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={async () => {
                    await api.patch(`/notifications/${n.id}/read`);
                    loadData();
                  }}
                  className="text-amber-700 font-semibold shrink-0"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
