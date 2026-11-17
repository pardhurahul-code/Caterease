import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateBookingPricing, type CouponInput } from '../utils/pricing';

export interface CartFoodItem {
  foodItemId: number;
  name: string;
  price: number;
  unit: string;
  dietaryType: string;
  imageUrl?: string | null;
  quantity: number;
}

export interface SelectedPackage {
  id: number;
  name: string;
  eventType: string;
  pricePerPerson: number;
  minGuests: number;
  maxGuests: number;
  imageUrl?: string | null;
}

interface CartContextValue {
  items: CartFoodItem[];
  selectedPackage: SelectedPackage | null;
  guestCount: number;
  appliedCoupon: CouponInput | null;
  addItem: (item: Omit<CartFoodItem, 'quantity'>, qty?: number) => void;
  updateQuantity: (foodItemId: number, quantity: number) => void;
  removeItem: (foodItemId: number) => void;
  selectPackage: (pkg: SelectedPackage | null) => void;
  setGuestCount: (count: number) => void;
  setAppliedCoupon: (coupon: CouponInput | null) => void;
  clearCart: () => void;
  totalItemCount: number;
  pricing: ReturnType<typeof calculateBookingPricing>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartFoodItem[]>(() => {
    try {
      const saved = localStorage.getItem('caterease_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedPackage, setSelectedPackage] = useState<SelectedPackage | null>(() => {
    try {
      const saved = localStorage.getItem('caterease_cart_package');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [guestCount, setGuestCountState] = useState<number>(() => {
    const saved = Number(localStorage.getItem('caterease_guest_count'));
    return Number.isFinite(saved) && saved >= 10 ? saved : 50;
  });

  const [appliedCoupon, setAppliedCoupon] = useState<CouponInput | null>(null);

  useEffect(() => {
    localStorage.setItem('caterease_cart_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (selectedPackage) {
      localStorage.setItem('caterease_cart_package', JSON.stringify(selectedPackage));
    } else {
      localStorage.removeItem('caterease_cart_package');
    }
  }, [selectedPackage]);

  useEffect(() => {
    localStorage.setItem('caterease_guest_count', String(guestCount));
  }, [guestCount]);

  const addItem = (item: Omit<CartFoodItem, 'quantity'>, qty = 10) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.foodItemId === item.foodItemId);
      if (existing) {
        return prev.map((i) =>
          i.foodItemId === item.foodItemId ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const updateQuantity = (foodItemId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.foodItemId !== foodItemId));
      return;
    }
    setItems((prev) => prev.map((i) => (i.foodItemId === foodItemId ? { ...i, quantity } : i)));
  };

  const removeItem = (foodItemId: number) => {
    setItems((prev) => prev.filter((i) => i.foodItemId !== foodItemId));
  };

  const selectPackage = (pkg: SelectedPackage | null) => {
    setSelectedPackage(pkg);
    if (pkg && guestCount < pkg.minGuests) {
      setGuestCountState(pkg.minGuests);
    }
  };

  const setGuestCount = (count: number) => {
    setGuestCountState(Math.max(10, count));
  };

  const clearCart = () => {
    setItems([]);
    setSelectedPackage(null);
    setAppliedCoupon(null);
  };

  const totalItemCount = useMemo(
    () => items.length + (selectedPackage ? 1 : 0),
    [items.length, selectedPackage]
  );

  const pricing = useMemo(
    () =>
      calculateBookingPricing({
        items: items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })),
        packageInput: selectedPackage
          ? {
              pricePerPerson: selectedPackage.pricePerPerson,
              guestCount,
              minGuests: selectedPackage.minGuests,
            }
          : null,
        coupon: appliedCoupon,
      }),
    [items, selectedPackage, guestCount, appliedCoupon]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        selectedPackage,
        guestCount,
        appliedCoupon,
        addItem,
        updateQuantity,
        removeItem,
        selectPackage,
        setGuestCount,
        setAppliedCoupon,
        clearCart,
        totalItemCount,
        pricing,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
