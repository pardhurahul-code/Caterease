import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionBookingStatus,
  canCustomerReviewBooking,
  derivePaymentStatus,
  computeRemainingBalance,
} from './bookingWorkflow';

test('enforces valid role-based booking workflow transitions', () => {
  assert.equal(canTransitionBookingStatus('Pending', 'Confirmed', 'ADMIN').allowed, true);
  assert.equal(canTransitionBookingStatus('Pending', 'Confirmed', 'CUSTOMER').allowed, false);
  assert.equal(canTransitionBookingStatus('Pending', 'Cancelled', 'CUSTOMER').allowed, true);
  assert.equal(canTransitionBookingStatus('Confirmed', 'Preparing', 'STAFF').allowed, true);
  assert.equal(canTransitionBookingStatus('Confirmed', 'Cancelled', 'STAFF').allowed, false);
  assert.equal(canTransitionBookingStatus('Completed', 'Cancelled', 'ADMIN').allowed, false);
});

test('checks review eligibility and payment status derivation', () => {
  assert.equal(canCustomerReviewBooking('Completed', false), true);
  assert.equal(canCustomerReviewBooking('Completed', true), false);
  assert.equal(canCustomerReviewBooking('Confirmed', false), false);

  assert.equal(derivePaymentStatus(10000, 0), 'Unpaid');
  assert.equal(derivePaymentStatus(10000, 3000), 'Partial');
  assert.equal(derivePaymentStatus(10000, 10000), 'Paid');
  assert.equal(computeRemainingBalance(10000, 3500), 6500);
});
