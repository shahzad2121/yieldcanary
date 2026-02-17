/**
 * Derived health status for market snapshot cards (indices, commodities, VIX).
 *
 * `changePercentage` is now the raw percentage value from FMP
 * (e.g. +0.35 means +0.35%, -1.2 means -1.20%).
 *
 * For VIX, we invert the sign so that a falling VIX is treated as "good"
 * (lower volatility / less fear), and a rising VIX as "bad".
 */

export type MarketSnapshotStatus = 'Healthy' | 'Dying' | 'Dead';

/** Threshold between "Dying" and "Dead" in percent (e.g. -1 means -1.0%) */
const THRESHOLD_DYING = -1; // -1%: between 0 and -1% = Dying, below = Dead

export function getMarketSnapshotStatus(
  symbol: string,
  changePercentage: number | null
): MarketSnapshotStatus | null {
  if (changePercentage === null || changePercentage === undefined) return null;

  const isVix = symbol === '^VIX';
  const effective = isVix ? -changePercentage : changePercentage;

  if (effective > 0) return 'Healthy';
  if (effective > THRESHOLD_DYING) return 'Dying';
  return 'Dead';
}
