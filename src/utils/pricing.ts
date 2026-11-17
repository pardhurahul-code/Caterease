export interface PricingItemInput {
  unitPrice: number;
  quantity: number;
}

export interface PackagePricingInput {
  pricePerPerson: number;
  guestCount: number;
  minGuests: number;
}

export interface CouponInput {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  startDate: Date | string;
  expiryDate: Date | string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

export interface PricingSummary {
  itemsSubtotal: number;
  packageSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  recommendedAdvance: number;
}

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function validateCoupon(
  coupon: CouponInput,
  subtotal: number,
  customerUsageCount = 0,
  perCustomerLimit = 1,
  now = new Date()
): { valid: boolean; reason?: string; discountAmount: number } {
  if (!coupon.isActive) {
    return { valid: false, reason: 'Coupon is currently inactive.', discountAmount: 0 };
  }
  const start = new Date(coupon.startDate);
  const expiry = new Date(coupon.expiryDate);
  if (now < start) {
    return { valid: false, reason: 'Coupon promotion has not started yet.', discountAmount: 0 };
  }
  if (now > expiry) {
    return { valid: false, reason: 'Coupon has expired.', discountAmount: 0 };
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, reason: 'Coupon usage limit reached.', discountAmount: 0 };
  }
  if (customerUsageCount >= perCustomerLimit) {
    return { valid: false, reason: 'You have already reached the usage limit for this coupon.', discountAmount: 0 };
  }
  if (subtotal < coupon.minOrderValue) {
    return {
      valid: false,
      reason: `Minimum order value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required.`,
      discountAmount: 0,
    };
  }

  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(roundMoney(discount), roundMoney(subtotal));
  return { valid: true, discountAmount: discount };
}

export function calculateBookingPricing(params: {
  items: PricingItemInput[];
  packageInput?: PackagePricingInput | null;
  coupon?: CouponInput | null;
  customerCouponUsageCount?: number;
  perCustomerLimit?: number;
  taxRate?: number; // default 0.05 (5% GST on catering)
  deliveryFee?: number;
  freeDeliveryThreshold?: number;
  now?: Date;
}): PricingSummary & { couponError?: string } {
  const taxRate = params.taxRate ?? 0.05;
  const freeThreshold = params.freeDeliveryThreshold ?? 15000;
  const baseDeliveryFee = params.deliveryFee ?? 1200;

  const itemsSubtotal = roundMoney(
    params.items.reduce((sum, item) => sum + Math.max(0, item.unitPrice) * Math.max(0, item.quantity), 0)
  );

  let packageSubtotal = 0;
  if (params.packageInput) {
    const guests = Math.max(params.packageInput.guestCount, params.packageInput.minGuests);
    packageSubtotal = roundMoney(Math.max(0, params.packageInput.pricePerPerson) * guests);
  }

  const subtotal = roundMoney(itemsSubtotal + packageSubtotal);
  let discountAmount = 0;
  let couponError: string | undefined;

  if (params.coupon) {
    const check = validateCoupon(
      params.coupon,
      subtotal,
      params.customerCouponUsageCount ?? 0,
      params.perCustomerLimit ?? 1,
      params.now ?? new Date()
    );
    if (check.valid) {
      discountAmount = check.discountAmount;
    } else {
      couponError = check.reason;
    }
  }

  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const deliveryCharge = subtotal === 0 || subtotal >= freeThreshold ? 0 : roundMoney(baseDeliveryFee);
  const totalAmount = roundMoney(taxableAmount + taxAmount + deliveryCharge);
  const recommendedAdvance = roundMoney(totalAmount * 0.3);

  return {
    itemsSubtotal,
    packageSubtotal,
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    deliveryCharge,
    totalAmount,
    recommendedAdvance,
    ...(couponError ? { couponError } : {}),
  };
}
