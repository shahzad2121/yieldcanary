import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Take-Home Return and Cash Return Calculations
export function calcTakeHomeReturn1Y({ latest_adj_close, price_1y_ago, dividends_last_12mo, taxRate }: { latest_adj_close?: number, price_1y_ago?: number, dividends_last_12mo?: number, taxRate: number }): number | null {
  if (!price_1y_ago || price_1y_ago === 0) return null;
  const afterTax = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((afterTax(latest_adj_close) + afterTax(dividends_last_12mo)) / price_1y_ago) - 1;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcTakeHomeReturnYTD({ latest_adj_close, price_ytd_start, dividends_ytd, taxRate }: { latest_adj_close?: number, price_ytd_start?: number, dividends_ytd?: number, taxRate: number }): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTax = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((afterTax(latest_adj_close) + afterTax(dividends_ytd)) / price_ytd_start) - 1;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcTakeHomeReturnInception({ latest_adj_close, price_at_inception, dividends_since_inception, taxRate }: { latest_adj_close?: number, price_at_inception?: number, dividends_since_inception?: number, taxRate: number }): number | null {
  if (!price_at_inception || price_at_inception === 0) return null;
  const afterTax = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((afterTax(latest_adj_close) + afterTax(dividends_since_inception)) / price_at_inception) - 1;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcTakeHomeCashReturn1Y({ latest_adj_close, price_1y_ago, dividends_last_12mo, taxRate }: { latest_adj_close?: number, price_1y_ago?: number, dividends_last_12mo?: number, taxRate: number }): number | null {
  if (!price_1y_ago || price_1y_ago === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_1y_ago ?? 0) + afterTaxDiv(dividends_last_12mo)) / price_1y_ago;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcTakeHomeCashReturnYTD({ latest_adj_close, price_ytd_start, dividends_ytd, taxRate }: { latest_adj_close?: number, price_ytd_start?: number, dividends_ytd?: number, taxRate: number }): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_ytd_start ?? 0) + afterTaxDiv(dividends_ytd)) / price_ytd_start;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcTakeHomeCashReturnInception({ latest_adj_close, price_at_inception, dividends_since_inception, taxRate }: { latest_adj_close?: number, price_at_inception?: number, dividends_since_inception?: number, taxRate: number }): number | null {
  if (!price_at_inception || price_at_inception === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_at_inception ?? 0) + afterTaxDiv(dividends_since_inception)) / price_at_inception;
  // Multiply by 100 to return as percentage (e.g., 13.0 for 13%)
  return round4(result * 100);
}

export function calcMonthlySpendableCashYield({ lastMonthDistribution, currentPrice, taxRate }: { lastMonthDistribution: number | null, currentPrice: number | null, taxRate: number }): number | null {
  if (!lastMonthDistribution || !currentPrice || currentPrice <= 0) {
    return null;
  }
  
  // After-tax distribution
  const afterTaxDistribution = lastMonthDistribution * (1 - taxRate / 100);
  
  // Calculate yield: (after-tax distribution / price) × 100
  return round4((afterTaxDistribution / currentPrice) * 100);
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

// Format currency in billions (e.g., 11000000000 -> "$11.0 B")
export function formatCurrencyInBillions(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '$0.0 B';
  const billions = value / 1e9;
  return `$${billions.toFixed(1)} B`;
}
