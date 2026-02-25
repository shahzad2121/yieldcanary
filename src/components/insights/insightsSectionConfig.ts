/** Section ID for the fixed-at-top section (not draggable). */
export const FIXED_INSIGHTS_SECTION_ID = 'market_snapshot' as const;

/** Default section order for Insights page (reorderable only). Market Snapshot is fixed at top and excluded. Pairs (largest_aum_lowest_expense, weekly_movers) are one draggable item each. */
export const DEFAULT_INSIGHTS_SECTION_ORDER = [
  'highest_yielding',       // Highest Yielding ETFs with No/Low NAV Erosion
  'best_after_tax',         // Best After-Tax Cash Flow
  'best_weekly',            // Best Weekly Payers
  'best_monthly',           // Best Monthly Payers
  'highest_advertised',     // Highest Advertised Yield (with True Income Warning)
  'buy_zone',               // Buy Zone Picks - Undervalued Healthy ETFs
  'yield_traps',            // Yield Traps to Avoid
  'weekly_movers',          // Biggest Movers of the Week (2 boxes side by side)
  'largest_aum_lowest_expense', // Largest Healthy AUM & Lowest Expense (2 boxes side by side)
] as const;

export type InsightsSectionId = (typeof DEFAULT_INSIGHTS_SECTION_ORDER)[number];

export const INSIGHTS_SECTION_TITLES: Record<InsightsSectionId, string> = {
  highest_yielding: 'Highest Yielding (Low ROC)',
  highest_advertised: 'Highest Advertised Yield',
  best_after_tax: 'Best After-Tax Cash Flow',
  best_weekly: 'Best Weekly Payers',
  best_monthly: 'Best Monthly Payers',
  largest_aum_lowest_expense: 'Largest Healthy AUM & Lowest Expense',
  weekly_movers: 'Biggest Movers',
  buy_zone: 'Buy Zone Picks',
  yield_traps: 'Yield Traps',
};

/** localStorage key for fallback / offline */
export const INSIGHTS_SECTION_ORDER_KEY = 'insights_section_order';

/** Supabase user_preferences.preference_key for this preference */
export const INSIGHTS_SECTION_ORDER_PREFERENCE_KEY = 'insights_section_order';

const VALID_IDS = new Set<string>(DEFAULT_INSIGHTS_SECTION_ORDER);

/**
 * Normalizes a raw array of section ids: valid ids kept in order, missing ids appended in default order.
 */
export function normalizeSectionOrder(parsed: unknown): InsightsSectionId[] {
  if (!Array.isArray(parsed)) return [...DEFAULT_INSIGHTS_SECTION_ORDER];
  const valid = parsed.filter((id): id is InsightsSectionId => typeof id === 'string' && VALID_IDS.has(id));
  const missing = DEFAULT_INSIGHTS_SECTION_ORDER.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

/**
 * Returns the section order from localStorage, or the default order.
 */
export function getStoredSectionOrder(): InsightsSectionId[] {
  try {
    const raw = localStorage.getItem(INSIGHTS_SECTION_ORDER_KEY);
    if (!raw) return [...DEFAULT_INSIGHTS_SECTION_ORDER];
    return normalizeSectionOrder(JSON.parse(raw));
  } catch {
    return [...DEFAULT_INSIGHTS_SECTION_ORDER];
  }
}

export function setStoredSectionOrder(order: InsightsSectionId[]): void {
  localStorage.setItem(INSIGHTS_SECTION_ORDER_KEY, JSON.stringify(order));
}
