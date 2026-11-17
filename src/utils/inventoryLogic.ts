export type StockTransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export function computeStockUpdate(
  currentQuantity: number,
  transactionType: StockTransactionType,
  amount: number
): { valid: boolean; newQuantity: number; quantityChange: number; error?: string } {
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      valid: false,
      newQuantity: currentQuantity,
      quantityChange: 0,
      error: 'Quantity must be a valid non-negative number.',
    };
  }

  if (transactionType === 'STOCK_IN') {
    const next = Math.round((currentQuantity + amount) * 100) / 100;
    return { valid: true, newQuantity: next, quantityChange: amount };
  }

  if (transactionType === 'STOCK_OUT') {
    if (amount > currentQuantity) {
      return {
        valid: false,
        newQuantity: currentQuantity,
        quantityChange: 0,
        error: `Insufficient stock. Available: ${currentQuantity}`,
      };
    }
    const next = Math.round((currentQuantity - amount) * 100) / 100;
    return { valid: true, newQuantity: next, quantityChange: -amount };
  }

  // ADJUSTMENT sets exact audited quantity
  const next = Math.round(amount * 100) / 100;
  return {
    valid: true,
    newQuantity: next,
    quantityChange: Math.round((next - currentQuantity) * 100) / 100,
  };
}

export function isLowStock(quantity: number, minStockLevel: number): boolean {
  return quantity <= minStockLevel;
}

export function getExpiryStatus(
  expiryDate: string | null | undefined,
  referenceDate = new Date()
): 'OK' | 'EXPIRING_SOON' | 'EXPIRED' {
  if (!expiryDate) return 'OK';
  const expiry = new Date(`${expiryDate}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) return 'OK';
  const diffDays = (expiry.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 7) return 'EXPIRING_SOON';
  return 'OK';
}
