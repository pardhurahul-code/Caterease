export interface StaffScheduleEntry {
  bookingId: number;
  bookingCode: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  status: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: StaffScheduleEntry;
}

export function detectStaffScheduleConflict(
  existingAssignments: StaffScheduleEntry[],
  targetBookingId: number,
  targetEventDate: string
): ConflictResult {
  const clash = existingAssignments.find(
    (a) =>
      a.bookingId !== targetBookingId &&
      a.eventDate === targetEventDate &&
      a.status !== 'Cancelled' &&
      a.status !== 'Completed'
  );

  if (clash) {
    return { hasConflict: true, conflict: clash };
  }
  return { hasConflict: false };
}

export function groupEventsByDate<T extends { eventDate: string }>(eventsList: T[]): Array<{ date: string; events: T[] }> {
  const grouped = new Map<string, T[]>();
  for (const ev of eventsList) {
    const list = grouped.get(ev.eventDate) || [];
    list.push(ev);
    grouped.set(ev.eventDate, list);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events }));
}
