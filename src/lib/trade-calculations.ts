/**
 * Trading fee rate: 0.10% (matching market-popup-confirmation.png where $300 has $0.30 fee)
 */
export const TRADING_FEE_RATE = 0.001;

export interface BuyCalculation {
  totalPayment: number;
  fee: number;
  netSpend: number;
  stockQuantity: number;
  pricePerShare: number;
}

export function calculateBuy(
  pUSDCSpend: number,
  pricePerShare: number,
): BuyCalculation {
  if (
    !Number.isFinite(pUSDCSpend) ||
    pUSDCSpend <= 0 ||
    !Number.isFinite(pricePerShare) ||
    pricePerShare <= 0
  ) {
    return {
      totalPayment: 0,
      fee: 0,
      netSpend: 0,
      stockQuantity: 0,
      pricePerShare,
    };
  }

  const totalPayment = Math.round(pUSDCSpend * 100) / 100;
  // In market-popup-confirmation.png: Total payment 300.00 pUSDC includes 0.30 fee, yielding 0.999 AAPL.
  // 300 * 0.001 = 0.30 fee; Net spend = 299.70; 299.70 / 300 = 0.999 stock
  const fee = Math.round(totalPayment * TRADING_FEE_RATE * 100) / 100;
  const netSpend = Math.max(0, Math.round((totalPayment - fee) * 100) / 100);
  const stockQuantity = Math.floor((netSpend / pricePerShare) * 1e6) / 1e6;

  return {
    totalPayment,
    fee,
    netSpend,
    stockQuantity,
    pricePerShare,
  };
}

export interface SellCalculation {
  stockQuantity: number;
  grossPayout: number;
  fee: number;
  netPayout: number;
  pricePerShare: number;
}

export function calculateSell(
  stockAmount: number,
  pricePerShare: number,
): SellCalculation {
  if (
    !Number.isFinite(stockAmount) ||
    stockAmount <= 0 ||
    !Number.isFinite(pricePerShare) ||
    pricePerShare <= 0
  ) {
    return {
      stockQuantity: 0,
      grossPayout: 0,
      fee: 0,
      netPayout: 0,
      pricePerShare,
    };
  }

  const stockQuantity = Math.floor(stockAmount * 1e6) / 1e6;
  const grossPayout = Math.round(stockQuantity * pricePerShare * 100) / 100;
  const fee = Math.round(grossPayout * TRADING_FEE_RATE * 100) / 100;
  const netPayout = Math.max(0, Math.round((grossPayout - fee) * 100) / 100);

  return {
    stockQuantity,
    grossPayout,
    fee,
    netPayout,
    pricePerShare,
  };
}
