import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStaffScheduleConflict, groupEventsByDate } from './staffSchedule';

test('detects overlapping active assignments on the same event date', () => {
  const existing = [
    { bookingId: 10, bookingCode: 'CE-2026-1001', eventName: 'Mehta Reception', eventDate: '2026-12-10', status: 'Confirmed' },
    { bookingId: 11, bookingCode: 'CE-2026-1002', eventName: 'Old Cancelled Gala', eventDate: '2026-12-15', status: 'Cancelled' },
  ];

  const clash = detectStaffScheduleConflict(existing, 20, '2026-12-10');
  assert.equal(clash.hasConflict, true);
  assert.equal(clash.conflict?.bookingCode, 'CE-2026-1001');

  const sameBookingReassign = detectStaffScheduleConflict(existing, 10, '2026-12-10');
  assert.equal(sameBookingReassign.hasConflict, false);

  const cancelledDate = detectStaffScheduleConflict(existing, 21, '2026-12-15');
  assert.equal(cancelledDate.hasConflict, false);
});

test('groups shift calendar events chronologically by date', () => {
  const grouped = groupEventsByDate([
    { eventDate: '2026-12-20', name: 'B' },
    { eventDate: '2026-12-05', name: 'A' },
    { eventDate: '2026-12-20', name: 'C' },
  ]);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].date, '2026-12-05');
  assert.equal(grouped[1].events.length, 2);
});
