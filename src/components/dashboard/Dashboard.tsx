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
import { Footer } from '@/components/Footer';

export function Dashboard() {
  const { etfs, loading, error } = useETFs();
  const { user: subscriptionUser, loading: userLoading } = useUserSubscription();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CanaryStatus | 'all'>('all');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

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
        plan={plan}
        isPaid={isPaid}
        userEmail={userEmail}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
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
          plan={plan}
          isPaid={isPaid}
          onUpgrade={() => setIsUpgradeModalOpen(true)}
        />

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
