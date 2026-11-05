import { parseUnits, formatUnits } from "viem";
export interface BuyCalculation {
  totalPayment: number;
  fee: number;
  netSpend: number;
  stockQuantity: number;
  pricePerShare: number;
}
export interface SellCalculation {
  stockQuantity: number;
  grossPayout: number;
  fee: number;
  netPayout: number;
  pricePerShare: number;
}
const human = (v: bigint, d: number) => Number(formatUnits(v, d));
// Exact integer arithmetic matching StockMarket.sol. Fee and price are fetched from the chain.
export function calculateBuy(
  spend: number,
  price: number,
  feeBps: number,
): BuyCalculation {
  const empty = {
    totalPayment: 0,
    fee: 0,
    netSpend: 0,
    stockQuantity: 0,
    pricePerShare: price,
  };
  if (
    ![spend, price, feeBps].every(Number.isFinite) ||
    spend <= 0 ||
    price <= 0 ||
    feeBps < 0 ||
    !Number.isInteger(feeBps)
  )
    return empty;
  const payment = parseUnits(spend.toFixed(6), 6),
    p = parseUnits(price.toFixed(6), 6);
  const gross = (payment * 10000n) / (10000n + BigInt(feeBps));
  const quantity = (gross * 10n ** 18n) / p;
  return {
    totalPayment: human(payment, 6),
    fee: human(payment - gross, 6),
    netSpend: human(gross, 6),
    stockQuantity: human(quantity, 18),
    pricePerShare: price,
  };
}
export function calculateSell(
  amount: number,
  price: number,
  feeBps: number,
): SellCalculation {
  const empty = {
    stockQuantity: 0,
    grossPayout: 0,
    fee: 0,
    netPayout: 0,
    pricePerShare: price,
  };
  if (
    ![amount, price, feeBps].every(Number.isFinite) ||
    amount <= 0 ||
    price <= 0 ||
    feeBps < 0 ||
    !Number.isInteger(feeBps)
  )
    return empty;
  const quantity = parseUnits(amount.toFixed(6), 18),
    gross = (quantity * parseUnits(price.toFixed(6), 6)) / 10n ** 18n;
  const fee = (gross * BigInt(feeBps)) / 10000n;
  return {
    stockQuantity: human(quantity, 18),
    grossPayout: human(gross, 6),
    fee: human(fee, 6),
    netPayout: human(gross - fee, 6),
    pricePerShare: price,
  };
}

// A live-market comparison only. Transaction quotes and signed amounts stay on-chain.
export function liveTradeEstimate(
  mode: "Buy" | "Sell",
  input: string,
  price: number | undefined,
  feeBps: number | undefined,
  legacy = false,
): number | undefined {
  if (!price || !Number.isFinite(price) || price <= 0 || feeBps === undefined ||
      !Number.isInteger(feeBps) || feeBps < 0 ||
      !(mode === "Buy" ? /^\d*\.?\d{0,6}$/ : /^\d*\.?\d{0,18}$/).test(input) ||
      !(Number(input) > 0)) return undefined;
  const p = parseUnits(price.toFixed(6), 6);
  if (p <= 0n) return undefined;
  const amount = parseUnits(input, mode === "Buy" ? 6 : 18);
  if (mode === "Sell") {
    const gross = amount * p / 10n ** 18n;
    return human(gross - gross * BigInt(feeBps) / 10000n, 6);
  }
  const net = legacy
    ? amount - amount * BigInt(feeBps) / 10000n
    : amount * 10000n / (10000n + BigInt(feeBps));
  return human(net * 10n ** 18n / p, 18);
}
