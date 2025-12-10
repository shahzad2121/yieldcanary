import { useState, useMemo, useEffect } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { KillerStats } from './KillerStats';
import { ETFTable } from './ETFTable';
import { FilterBar } from './FilterBar';
import { UpgradeModal } from './UpgradeModal';
import { useETFs } from '@/hooks/useETFs';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { CanaryStatus } from '@/types/etf';
import { supabase } from '@/integrations/supabase/client';

export function Dashboard() {
  const { etfs, loading, error } = useETFs();
  const { user: subscriptionUser, loading: userLoading } = useUserSubscription();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CanaryStatus | 'all'>('all');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  const isPaid = subscriptionUser?.is_paid || false;

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

      return searchMatch && statusMatch;
    });
  }, [etfs, searchQuery, statusFilter]);

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading ETF data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error loading ETFs: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        isPaid={isPaid}
        userEmail={userEmail}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      <main className="container px-2 xs:px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-1 sm:space-y-2 py-3 sm:py-4">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Which ETFs are healthy vs quietly dying?
          </h1>
          <p className="text-sm xs:text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            See through the marketing. Know exactly what lands in your pocket after taxes.
          </p>
        </div>

        {/* Killer Stats */}
        <KillerStats etfs={filteredETFs} />

        {/* Filters */}
        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={handleClearFilters}
        />

        {/* ETF Table */}
        <ETFTable
          etfs={filteredETFs}
          isPaid={isPaid}
          onUpgrade={() => setIsUpgradeModalOpen(true)}
        />

        {/* Footer */}
        <footer className="text-center py-6 sm:py-8 border-t border-border text-xs sm:text-sm">
          <p className="text-muted-foreground">
            Data updated daily. ROC data from 19a-1 filings.
          </p>
          <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
            © 2026 YieldCanary. Not financial advice.
          </p>
        </footer>
      </main>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onUpgrade={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
