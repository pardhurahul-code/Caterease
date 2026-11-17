import { useMemo } from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { groupEventsByDate } from '../utils/staffSchedule';

export interface ShiftItem {
  assignmentId: number;
  assignedRole: string;
  taskSummary: string;
  prepStatus: string;
  deliveryStatus: string;
  staffId: number;
  staffCode: string;
  roleTitle: string;
  shiftSchedule: string;
  staffName: string;
  bookingId: number;
  bookingCode: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  guestCount: number;
  bookingStatus: string;
}

export function ShiftCalendarGrid({
  shifts,
  title = 'Crew Shift Calendar',
}: {
  shifts: ShiftItem[];
  title?: string;
}) {
  const grouped = useMemo(() => groupEventsByDate(shifts), [shifts]);

  if (shifts.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm text-stone-500">
        No shifts scheduled yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h2>
        <span className="text-xs text-stone-500 tabular-nums">{grouped.length} active event dates</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grouped.map((day) => {
          const staffIdsSeen = new Set<number>();
          const doubleBookedStaffIds = new Set<number>();
          for (const ev of day.events) {
            if (ev.bookingStatus !== 'Cancelled' && ev.bookingStatus !== 'Completed') {
              if (staffIdsSeen.has(ev.staffId)) doubleBookedStaffIds.add(ev.staffId);
              staffIdsSeen.add(ev.staffId);
            }
          }

          return (
            <div
              key={day.date}
              className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="inline-flex items-center gap-2 font-mono text-sm font-bold text-amber-800 dark:text-amber-400">
                  <Calendar className="w-4 h-4" />
                  {day.date}
                </div>
                <span className="text-xs text-stone-500 tabular-nums">
                  {day.events.length} shift{day.events.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2.5">
                {day.events.map((ev) => {
                  const hasConflict = doubleBookedStaffIds.has(ev.staffId);
                  return (
                    <div
                      key={ev.assignmentId}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        hasConflict
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-900'
                          : 'bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {ev.staffName} ({ev.staffCode})
                        </span>
                        <span className="font-mono text-[11px] text-amber-800 dark:text-amber-400">
                          {ev.bookingCode}
                        </span>
                      </div>
                      <div className="text-stone-700 dark:text-stone-300 font-medium">
                        {ev.eventName} · {ev.assignedRole}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" /> {ev.eventTime}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Users className="w-3 h-3" /> {ev.guestCount} guests
                        </span>
                        <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-3 h-3 shrink-0" /> {ev.eventLocation}
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span>Prep: <strong>{ev.prepStatus}</strong> · Delivery: <strong>{ev.deliveryStatus}</strong></span>
                        {hasConflict && (
                          <span className="text-red-700 dark:text-red-400 font-semibold">Overlapping shift</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
