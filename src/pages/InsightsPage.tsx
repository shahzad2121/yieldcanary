import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UpgradeModal } from '@/components/dashboard/UpgradeModal';
import { MarketSnapshotBanner } from '@/components/insights/MarketSnapshotBanner';
import { HighestYieldingLowRocCard } from '@/components/insights/HighestYieldingLowRocCard';
import { HighestAdvertisedYieldCard } from '@/components/insights/HighestAdvertisedYieldCard';
import { BestAfterTaxCashFlowCard } from '@/components/insights/BestAfterTaxCashFlowCard';
import { BestWeeklyPayersCard } from '@/components/insights/BestWeeklyPayersCard';
import { BestMonthlyPayersCard } from '@/components/insights/BestMonthlyPayersCard';
import { BuyZonePicksCard } from '@/components/insights/BuyZonePicksCard';
import { YieldTrapsCard } from '@/components/insights/YieldTrapsCard';
import { LargestHealthyAumCard } from '@/components/insights/LargestHealthyAumCard';
import { LowestExpenseHealthyCard } from '@/components/insights/LowestExpenseHealthyCard';
import { WeeklyImprovementsCard } from '@/components/insights/WeeklyImprovementsCard';
import { WeeklyDeteriorationsCard } from '@/components/insights/WeeklyDeteriorationsCard';
import { Footer } from '@/components/Footer';
import { useETFs } from '@/hooks/useETFs';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { supabase } from '@/integrations/supabase/client';

const InsightsPage = () => {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const navigate = useNavigate();
  const { etfs, loading: etfsLoading } = useETFs();
  const { user: subscriptionUser, loading: userLoading, isTrialing, trialEndsAt, cancelAtPeriodEnd, cancelsAt, refetch: refetchSubscription } = useUserSubscription();

  type Plan = 'free' | 'basic' | 'advanced';
  const subscriptionTier = subscriptionUser?.subscription_tier ?? null;
  const plan: Plan =
    subscriptionTier === 'advanced' ? 'advanced' :
    subscriptionTier === 'basic' ? 'basic' : 'free';
  const isPaid = plan !== 'free';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate('/auth');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    };
    getUser();
  }, []);

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Insights - YieldCanary | Market Snapshot & ETF Insights</title>
        <meta
          name="description"
          content="Market snapshot and curated ETF insights. Track indices, commodities, and high-yield fund opportunities."
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
            onUpgrade={() => setIsUpgradeModalOpen(true)}
            onSubscriptionCancelled={refetchSubscription}
          />

          <main className="container px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="text-center space-y-1 sm:space-y-2 py-2 sm:py-4">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground px-2">
                Insights
              </h1>
              <p className="text-xs sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
                Market snapshot and curated ETF lists.
              </p>
            </div>

            <MarketSnapshotBanner />

            

            <HighestYieldingLowRocCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <HighestAdvertisedYieldCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <BestAfterTaxCashFlowCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <BestWeeklyPayersCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <BestMonthlyPayersCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <LargestHealthyAumCard
                etfs={etfs}
                plan={plan}
                onUpgrade={() => setIsUpgradeModalOpen(true)}
                loading={etfsLoading}
              />
              <LowestExpenseHealthyCard
                etfs={etfs}
                plan={plan}
                onUpgrade={() => setIsUpgradeModalOpen(true)}
                loading={etfsLoading}
              />
            </div>

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <WeeklyImprovementsCard
                plan={plan}
                onUpgrade={() => setIsUpgradeModalOpen(true)}
              />
              <WeeklyDeteriorationsCard
                plan={plan}
                onUpgrade={() => setIsUpgradeModalOpen(true)}
              />
            </div>

            <BuyZonePicksCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <YieldTrapsCard
              etfs={etfs}
              plan={plan}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
              loading={etfsLoading}
            />

            <Footer showDataDisclaimer={true} />
          </main>
        </div>
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          onUpgrade={() => setIsUpgradeModalOpen(false)}
        />
      </DashboardLayout>
    </>
  );
};

export default InsightsPage;
