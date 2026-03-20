import { useState, useMemo, useEffect } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { KillerStats } from './KillerStats';
import { KillerStatsSkeleton } from './KillerStatsSkeleton';
import { ETFTable } from './ETFTable';
import { ETFTableSkeleton } from './ETFTableSkeleton';
import { FilterBar } from './FilterBar';
import { UpgradeModal } from './UpgradeModal';
import { useETFs } from '@/hooks/useETFs';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { CanaryStatus } from '@/types/etf';
import { supabase } from '@/integrations/supabase/client';
import { Footer } from '@/components/Footer';
import { useSearchParams } from 'react-router-dom';

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { etfs, loading, error } = useETFs();
  const {
    user: subscriptionUser,
    loading: userLoading,
    isTrialing,
    trialEndsAt,
    cancelAtPeriodEnd,
    cancelsAt,
    newsletterTier,
    refetch: refetchSubscription,
  } = useUserSubscription();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CanaryStatus | 'all'>('all');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const compareMode = searchParams.get('compare');
  const compareIssuerRaw = searchParams.get('issuer');
  const compareExcludeTicker = searchParams.get('exclude');
  const compareIssuer = compareIssuerRaw?.trim() ?? '';
  const hasCompareIssuer = compareMode === 'issuer' && compareIssuer.length > 0;
  const hasCompareParams =
    Boolean(compareMode) ||
    Boolean(compareIssuerRaw?.trim()) ||
    Boolean(compareExcludeTicker?.trim());

  const showClearButton =
    statusFilter !== 'all' || searchQuery.trim() !== '' || hasCompareParams;

  // Plan derivation: distinguish between 'free', 'basic', and 'advanced'
  type Plan = 'free' | 'basic' | 'advanced';
  const subscriptionTier = subscriptionUser?.subscription_tier ?? null;
  const plan: Plan = 
    subscriptionTier === 'advanced' ? 'advanced' :
    subscriptionTier === 'basic' ? 'basic' : 
    'free';
  const isPaid = plan !== 'free';

  // Get user email from session
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  // Filter ETFs
  const filteredETFs = useMemo(() => {
    return etfs.filter((etf) => {
      // Search filter
      const searchMatch = 
        searchQuery === '' ||
        etf.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        etf.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const statusMatch = statusFilter === 'all' || etf.canaryStatus === statusFilter;

      // Optional compare-by-issuer filter from deep-dive link
      const issuerMatch = !hasCompareIssuer
        ? true
        : (etf.issuer ?? '').trim().toLowerCase() === compareIssuer.toLowerCase();

      // Optional exclude ticker (used by deep-dive compare link to hide source ETF)
      const excludeMatch = compareExcludeTicker
        ? etf.ticker.toLowerCase() !== compareExcludeTicker.toLowerCase()
        : true;

      return searchMatch && statusMatch && issuerMatch && excludeMatch;
    });
  }, [etfs, searchQuery, statusFilter, hasCompareIssuer, compareIssuer, compareExcludeTicker]);

  /** ETFs matching issuer compare + exclude only (ignore search/status) — for empty-state copy */
  const compareIssuerOnlyMatches = useMemo(() => {
    if (!hasCompareIssuer) return [];
    return etfs.filter((etf) => {
      const issuerMatch =
        (etf.issuer ?? '').trim().toLowerCase() === compareIssuer.toLowerCase();
      const excludeMatch = compareExcludeTicker
        ? etf.ticker.toLowerCase() !== compareExcludeTicker.toLowerCase()
        : true;
      return issuerMatch && excludeMatch;
    });
  }, [etfs, hasCompareIssuer, compareIssuer, compareExcludeTicker]);

  const isCompareIssuerNoRows =
    hasCompareIssuer && compareIssuerOnlyMatches.length === 0;

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    if (!hasCompareParams) return;
    const next = new URLSearchParams(searchParams);
    next.delete('compare');
    next.delete('issuer');
    next.delete('exclude');
    setSearchParams(next, { replace: true });
  };

  const isDataLoading = loading || userLoading;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        plan={plan}
        isPaid={isPaid}
        isTrialing={isTrialing}
        trialEndsAt={trialEndsAt}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        cancelsAt={cancelsAt}
        newsletterTier={newsletterTier}
        userEmail={userEmail}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
        onSubscriptionCancelled={refetchSubscription}
      />

      <main className="container py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-1 sm:space-y-2 py-2 sm:py-4">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground px-2">
            Which ETFs are healthy vs quietly dying?
          </h1>
          <p className="text-xs sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            See through the marketing. Know exactly what lands in your pocket after taxes.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Error loading ETFs: {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {/* Killer Stats */}
        {isDataLoading ? <KillerStatsSkeleton /> : <KillerStats etfs={filteredETFs} />}

        {/* Filters */}
        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={handleClearFilters}
          showClearButton={showClearButton}
        />
        {hasCompareIssuer && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
              Comparing by issuer: <span className="font-medium text-foreground">{compareIssuer}</span>
            </span>
          </div>
        )}

        {/* ETF Table */}
        {isDataLoading ? (
          <ETFTableSkeleton />
        ) : filteredETFs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 sm:py-10 text-center space-y-3">
            {isCompareIssuerNoRows ? (
              <>
                <p className="text-sm sm:text-base text-foreground font-medium">
                  No ETFs found for issuer{' '}
                  <span className="font-semibold">{compareIssuer}</span>.
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  Clear compare filter to return to the full dashboard.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm sm:text-base text-foreground font-medium">
                  No ETFs match your current filters
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  Try clearing search, status, or the issuer compare filter to see more results.
                </p>
              </>
            )}
            {showClearButton && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <ETFTable
            etfs={filteredETFs}
            plan={plan}
            isPaid={isPaid}
            onUpgrade={() => setIsUpgradeModalOpen(true)}
          />
        )}

        {/* Footer */}
        <Footer showDataDisclaimer={true} />
      </main>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onUpgrade={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
