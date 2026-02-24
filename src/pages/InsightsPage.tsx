import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SlidersHorizontal } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { UpgradeModal } from '@/components/dashboard/UpgradeModal';
import { CustomizeInsightsModal } from '@/components/insights/CustomizeInsightsModal';
import { type InsightsSectionId } from '@/components/insights/insightsSectionConfig';
import { useInsightsSectionOrder } from '@/hooks/useInsightsSectionOrder';
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
import { Button } from '@/components/ui/button';
import { useETFs } from '@/hooks/useETFs';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { supabase } from '@/integrations/supabase/client';

type Plan = 'free' | 'basic' | 'advanced';

const InsightsPage = () => {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const navigate = useNavigate();
  const { etfs, loading: etfsLoading } = useETFs();
  const { user: subscriptionUser, loading: userLoading, isTrialing, trialEndsAt, cancelAtPeriodEnd, cancelsAt, refetch: refetchSubscription } = useUserSubscription();
  const { sectionOrder, setSectionOrder } = useInsightsSectionOrder();

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

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomizeOpen(true)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Customize
              </Button>
            </div>

            <MarketSnapshotBanner />

            <InsightsSections
              sectionOrder={sectionOrder}
              etfs={etfs}
              plan={plan}
              etfsLoading={etfsLoading}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
            />

            <Footer showDataDisclaimer={true} />
          </main>
        </div>
        <CustomizeInsightsModal
          open={isCustomizeOpen}
          onOpenChange={setIsCustomizeOpen}
          sectionOrder={sectionOrder}
          onSave={setSectionOrder}
        />
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          onUpgrade={() => setIsUpgradeModalOpen(false)}
        />
      </DashboardLayout>
    </>
  );
};

type InsightsSectionsProps = {
  sectionOrder: InsightsSectionId[];
  etfs: ReturnType<typeof useETFs>['etfs'];
  plan: Plan;
  etfsLoading: boolean;
  onUpgrade: () => void;
};

function InsightsSections({ sectionOrder, etfs, plan, etfsLoading, onUpgrade }: InsightsSectionsProps) {
  const cardProps = { etfs, plan, onUpgrade, loading: etfsLoading };

  const renderSection = (id: InsightsSectionId, opts?: { stacked?: boolean }) => {
    const stacked = opts?.stacked ?? false;
    switch (id) {
      case 'highest_yielding':
        return <HighestYieldingLowRocCard {...cardProps} />;
      case 'highest_advertised':
        return <HighestAdvertisedYieldCard {...cardProps} />;
      case 'best_after_tax':
        return <BestAfterTaxCashFlowCard {...cardProps} />;
      case 'best_weekly':
        return <BestWeeklyPayersCard {...cardProps} />;
      case 'best_monthly':
        return <BestMonthlyPayersCard {...cardProps} />;
      case 'largest_aum_lowest_expense':
        return stacked ? (
          <div className="space-y-4 sm:space-y-6">
            <LargestHealthyAumCard {...cardProps} />
            <LowestExpenseHealthyCard {...cardProps} />
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <LargestHealthyAumCard {...cardProps} />
            <LowestExpenseHealthyCard {...cardProps} />
          </div>
        );
      case 'weekly_movers':
        return stacked ? (
          <div className="space-y-4 sm:space-y-6">
            <WeeklyImprovementsCard plan={plan} onUpgrade={onUpgrade} />
            <WeeklyDeteriorationsCard plan={plan} onUpgrade={onUpgrade} />
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <WeeklyImprovementsCard plan={plan} onUpgrade={onUpgrade} />
            <WeeklyDeteriorationsCard plan={plan} onUpgrade={onUpgrade} />
          </div>
        );
      case 'buy_zone':
        return <BuyZonePicksCard {...cardProps} />;
      case 'yield_traps':
        return <YieldTrapsCard {...cardProps} />;
      default:
        return null;
    }
  };

  if (sectionOrder.length === 0) return null;

  const single = sectionOrder.slice(0, -2);
  const lastTwo = sectionOrder.slice(-2);

  return (
    <>
      {single.map((id) => (
        <div key={id}>{renderSection(id)}</div>
      ))}
      {sectionOrder.length >= 2 && (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <div key={lastTwo[0]}>{renderSection(lastTwo[0], { stacked: true })}</div>
          <div key={lastTwo[1]}>{renderSection(lastTwo[1], { stacked: true })}</div>
        </div>
      )}
      {sectionOrder.length === 1 && <div key={sectionOrder[0]}>{renderSection(sectionOrder[0])}</div>}
    </>
  );
}

export default InsightsPage;
