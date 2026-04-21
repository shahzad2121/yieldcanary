import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { redirectToCheckout } from '@/integrations/stripe/checkout';
import { supabase } from '@/integrations/supabase/client';
import { useUserSubscription } from '@/hooks/useUserSubscription';

/** @param {import('@/integrations/stripe/checkout').PricingPlan} plan */
async function startNewsletterCheckout(plan) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${window.location.origin}/auth?redirect=${encodeURIComponent('/#newsletter')}`;
    return;
  }
  await redirectToCheckout(plan, session.user.email);
}

export default function Newsletter() {
  const {
    loading,
    hasBundledNewsletterAccess,
    hasStandaloneNewsletterAccess,
    hasNewsletterAccess,
  } = useUserSubscription();

  return (
    <section id="newsletter" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="bg-background border border-border rounded-lg p-6 xs:p-8 sm:p-10 text-center electric-card">
          <p className="text-xs xs:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Weekly insights
          </p>
          <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            YieldCanary Weekly
          </h2>
          <p className="text-xs xs:text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2 leading-relaxed">
            YieldCanary Weekly sends our proprietary data and curated insights every Monday morning.
            It&apos;s a fast, no-fluff briefing based on the same analytics you see inside the app.
          </p>
          <p className="mt-3 text-[11px] xs:text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto px-2 leading-relaxed">
            Includes market pulse, sustainable high-yield ETFs, after-tax cash flow opportunities,
            Buy Zone picks, biggest movers, and Yield Traps to avoid.
          </p>
          <p className="text-[11px] xs:text-xs sm:text-sm text-muted-foreground mt-3">
            Included free with all Basic and Advanced plans. Standalone subscription available for $5/month.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : hasBundledNewsletterAccess ? (
              // Basic / Advanced subscriber: newsletter is included
              <p className="text-sm text-muted-foreground max-w-md">
                You&apos;re all set — the weekly newsletter is included with your plan.
                It arrives weekly at the email on your account.
              </p>
            ) : hasStandaloneNewsletterAccess ? (
              // Standalone newsletter subscriber
              <p className="text-sm text-muted-foreground max-w-md">
                You&apos;re subscribed to YieldCanary Weekly. Manage or cancel from your
                account dashboard.
              </p>
            ) : (
              // Not subscribed — show both paths
              <>
                <div className="flex flex-col gap-2 items-center">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      size="lg"
                      className="text-sm sm:text-base px-6 sm:px-8 w-auto"
                      onClick={() => startNewsletterCheckout('newsletter_monthly')}
                    >
                      Subscribe – $5 / month
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-sm sm:text-base px-6 sm:px-8 w-auto"
                      onClick={() => startNewsletterCheckout('newsletter_yearly')}
                    >
                      Subscribe – Yearly ($49)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Or{' '}
                    <Link to="/#pricing" className="underline underline-offset-2">
                      get it free with a Basic or Advanced plan
                    </Link>
                    .
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="text-xs xs:text-sm text-muted-foreground mt-4 sm:mt-6">
            {hasNewsletterAccess && !loading
              ? 'Thank you for being a subscriber.'
              : 'No commitment. Cancel anytime. Delivered every Monday morning.'}
          </p>
        </div>
      </div>
    </section>
  );
}
