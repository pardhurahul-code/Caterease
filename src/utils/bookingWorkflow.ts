export const BOOKING_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Delivery',
  'Event in Progress',
  'Completed',
  'Cancelled',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type UserRole = 'CUSTOMER' | 'ADMIN' | 'STAFF';

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready for Delivery', 'Cancelled'],
  'Ready for Delivery': ['Event in Progress', 'Completed'],
  'Event in Progress': ['Completed'],
  Completed: [],
  Cancelled: [],
};

export function canTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus,
  role: UserRole
): { allowed: boolean; reason?: string } {
  if (from === to) {
    return { allowed: false, reason: 'Booking is already in that status.' };
  }
  const nextOptions = VALID_TRANSITIONS[from] || [];
  if (!nextOptions.includes(to)) {
    return { allowed: false, reason: `Cannot transition booking from "${from}" to "${to}".` };
  }

  if (role === 'CUSTOMER') {
    if (to === 'Cancelled' && (from === 'Pending' || from === 'Confirmed')) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Customers can only cancel Pending or Confirmed bookings.' };
  }

  if (role === 'STAFF') {
    const staffAllowed: BookingStatus[] = ['Preparing', 'Ready for Delivery', 'Event in Progress', 'Completed'];
    if (staffAllowed.includes(to)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Staff can only advance preparation and delivery stages.' };
  }

  return { allowed: true };
}

export function canCustomerEditBooking(status: BookingStatus): boolean {
  return status === 'Pending' || status === 'Confirmed';
}

export function canCustomerCancelBooking(status: BookingStatus): boolean {
  return status === 'Pending' || status === 'Confirmed';
}

export function canCustomerReviewBooking(status: BookingStatus, hasExistingReview: boolean): boolean {
  return status === 'Completed' && !hasExistingReview;
}

export function computeRemainingBalance(totalAmount: number, paidAmount: number): number {
  return Math.max(0, Math.round((totalAmount - paidAmount + Number.EPSILON) * 100) / 100);
}

export function derivePaymentStatus(totalAmount: number, paidAmount: number): 'Unpaid' | 'Partial' | 'Paid' {
  if (paidAmount <= 0) return 'Unpaid';
  if (paidAmount + 0.01 >= totalAmount) return 'Paid';
  return 'Partial';
}
