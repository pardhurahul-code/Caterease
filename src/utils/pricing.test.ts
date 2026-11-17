import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBookingPricing, validateCoupon, type CouponInput } from './pricing';

const activeCoupon: CouponInput = {
  code: 'CELEBRATE15',
  discountType: 'PERCENTAGE',
  discountValue: 15,
  minOrderValue: 5000,
  maxDiscount: 3000,
  startDate: '2026-01-01T00:00:00Z',
  expiryDate: '2027-12-31T23:59:59Z',
  usageLimit: 100,
  usedCount: 10,
  isActive: true,
};

test('calculates package and cart items pricing with free delivery above threshold', () => {
  const result = calculateBookingPricing({
    items: [
      { unitPrice: 450, quantity: 20 }, // 9000
      { unitPrice: 250, quantity: 10 }, // 2500
    ],
    packageInput: { pricePerPerson: 850, guestCount: 50, minGuests: 25 }, // 42500
    coupon: activeCoupon,
    now: new Date('2026-06-01T00:00:00Z'),
  });

  assert.equal(result.itemsSubtotal, 11500);
  assert.equal(result.packageSubtotal, 42500);
  assert.equal(result.subtotal, 54000);
  assert.equal(result.discountAmount, 3000); // capped at maxDiscount
  assert.equal(result.taxableAmount, 51000);
  assert.equal(result.taxAmount, 2550); // 5% of 51000
  assert.equal(result.deliveryCharge, 0); // >= 15000
  assert.equal(result.totalAmount, 53550);
  assert.equal(result.recommendedAdvance, 16065);
});

test('adds delivery charge below free delivery threshold', () => {
  const result = calculateBookingPricing({
    items: [{ unitPrice: 400, quantity: 10 }],
    now: new Date('2026-06-01T00:00:00Z'),
  });
  assert.equal(result.subtotal, 4000);
  assert.equal(result.deliveryCharge, 1200);
  assert.equal(result.taxAmount, 200);
  assert.equal(result.totalAmount, 5400);
});

test('rejects expired or under-minimum coupons', () => {
  const underMin = validateCoupon(activeCoupon, 2000, 0, 1, new Date('2026-06-01T00:00:00Z'));
  assert.equal(underMin.valid, false);
  assert.equal(underMin.discountAmount, 0);

  const expired = validateCoupon(activeCoupon, 10000, 0, 1, new Date('2028-02-01T00:00:00Z'));
  assert.equal(expired.valid, false);
});
