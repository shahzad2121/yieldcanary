/**
 * Derived health status for market snapshot cards (indices, commodities, VIX).
 * Uses daily change %; VIX is inverted (down = good, up = bad).
 */

export type MarketSnapshotStatus = 'Healthy' | 'Dying' | 'Dead';

/** changePercentage is in decimal form (e.g. 0.03 = 3%) */
const THRESHOLD_DYING = -0.01; // -1%: between 0 and -1% = Dying, below = Dead

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
