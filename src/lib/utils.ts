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
  return round4(result);
}

export function calcTakeHomeReturnYTD({ latest_adj_close, price_ytd_start, dividends_ytd, taxRate }: { latest_adj_close?: number, price_ytd_start?: number, dividends_ytd?: number, taxRate: number }): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTax = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((afterTax(latest_adj_close) + afterTax(dividends_ytd)) / price_ytd_start) - 1;
  return round4(result);
}

export function calcTakeHomeReturnInception({ latest_adj_close, price_at_inception, dividends_since_inception, taxRate }: { latest_adj_close?: number, price_at_inception?: number, dividends_since_inception?: number, taxRate: number }): number | null {
  if (!price_at_inception || price_at_inception === 0) return null;
  const afterTax = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((afterTax(latest_adj_close) + afterTax(dividends_since_inception)) / price_at_inception) - 1;
  return round4(result);
}

export function calcTakeHomeCashReturn1Y({ latest_adj_close, price_1y_ago, dividends_last_12mo, taxRate }: { latest_adj_close?: number, price_1y_ago?: number, dividends_last_12mo?: number, taxRate: number }): number | null {
  if (!price_1y_ago || price_1y_ago === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_1y_ago ?? 0) + afterTaxDiv(dividends_last_12mo)) / price_1y_ago;
  return round4(result);
}

export function calcTakeHomeCashReturnYTD({ latest_adj_close, price_ytd_start, dividends_ytd, taxRate }: { latest_adj_close?: number, price_ytd_start?: number, dividends_ytd?: number, taxRate: number }): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_ytd_start ?? 0) + afterTaxDiv(dividends_ytd)) / price_ytd_start;
  return round4(result);
}

export function calcTakeHomeCashReturnInception({ latest_adj_close, price_at_inception, dividends_since_inception, taxRate }: { latest_adj_close?: number, price_at_inception?: number, dividends_since_inception?: number, taxRate: number }): number | null {
  if (!price_at_inception || price_at_inception === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result = ((latest_adj_close ?? 0) - (price_at_inception ?? 0) + afterTaxDiv(dividends_since_inception)) / price_at_inception;
  return round4(result);
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
