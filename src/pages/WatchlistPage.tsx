import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { KillerStats } from '@/components/dashboard/KillerStats';
import { WatchlistSummary } from '@/components/dashboard/WatchlistSummary';
import { Footer } from '@/components/Footer';
import { useETFs } from '@/hooks/useETFs';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useWatchlist } from '@/hooks/useWatchlist';
import { CanaryStatus } from '@/types/etf';

const WatchlistPage = () => {
  const { etfs, loading: etfsLoading, error: etfsError } = useETFs();
  const { user: subscriptionUser, loading: userLoading, isTrialing, trialEndsAt, cancelAtPeriodEnd, cancelsAt, refetch: refetchSubscription } = useUserSubscription();
  const { watchlistTickers, loading: watchlistLoading } = useWatchlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CanaryStatus | 'all'>('all');
  const [userEmail, setUserEmail] = useState<string>('');

  // Plan derivation: distinguish between 'free', 'basic', and 'advanced'
  type Plan = 'free' | 'basic' | 'advanced';
  const subscriptionTier = subscriptionUser?.subscription_tier ?? null;
  const plan: Plan = 
    subscriptionTier === 'advanced' ? 'advanced' :
    subscriptionTier === 'basic' ? 'basic' : 
    'free';
  const isPaid = plan !== 'free';

  // Get user email from session (for header/avatar)
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  // Filter ETFs down to the user's watchlist, then apply search + status filters
  const filteredWatchlistETFs = useMemo(() => {
    const inWatchlist = etfs.filter((etf) => watchlistTickers.includes(etf.ticker));

    return inWatchlist.filter((etf) => {
      const searchMatch =
        searchQuery === '' ||
        etf.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        etf.name.toLowerCase().includes(searchQuery.toLowerCase());

      const statusMatch = statusFilter === 'all' || etf.canaryStatus === statusFilter;

      return searchMatch && statusMatch;
    });
  }, [etfs, watchlistTickers, searchQuery, statusFilter]);

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const loading = etfsLoading || userLoading || watchlistLoading;
  const error = etfsError;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading your watchlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error loading watchlist: {error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Watchlist - YieldCanary</title>
        <meta
          name="description"
          content="View and manage your starred income ETFs in your personal YieldCanary watchlist."
        />
      </Helmet>
      <DashboardLayout>
        <div className="min-h-screen bg-background">
        <DashboardHeader
          plan={plan}
          isPaid={isPaid}
          isTrialing={isTrialing}
          trialEndsAt={trialEndsAt}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          cancelsAt={cancelsAt}
          userEmail={userEmail}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onUpgrade={() => {}}
          onSubscriptionCancelled={refetchSubscription}
        />

        <main className="container px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Hero Section */}
          <div className="text-center space-y-1 sm:space-y-2 py-2 sm:py-4">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground px-2">
              Your Watchlist
            </h1>
            <p className="text-xs sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              All the ETFs you&apos;ve starred in one place. Use this to keep an eye on funds you care about most.
            </p>
          </div>

          {/* Killer Stats (based only on watchlist ETFs) */}
          <KillerStats etfs={filteredWatchlistETFs} />

          {/* Filters */}
          <FilterBar
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onClearFilters={handleClearFilters}
          />

          {/* Watchlist Summary (above the list) */}
          <WatchlistSummary etfs={filteredWatchlistETFs} />

          {/* Watchlist Table */}
          {filteredWatchlistETFs.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
              You don&apos;t have any ETFs in your watchlist yet. Star ETFs on the main dashboard to see them here.
            </div>
          ) : (
            <ETFTable
              etfs={filteredWatchlistETFs}
              plan={plan}
              isPaid={isPaid}
              onUpgrade={() => {}} // Watchlist is only visible when already signed in; upgrade CTA handled elsewhere
            />
          )}

          {/* Footer */}
          <Footer showDataDisclaimer={true} />
        </main>
      </div>
      </DashboardLayout>
    </>
  );
};

export default WatchlistPage;



