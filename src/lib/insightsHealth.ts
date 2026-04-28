import type { ETF } from '@/types/etf';

export function isHealthyForInsights(etf: ETF): boolean {
  return etf.canaryStatus === 'Healthy' || etf.isTaxEfficientRoc === true;
}
