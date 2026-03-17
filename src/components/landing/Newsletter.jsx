import { redirectToCheckout } from '@/integrations/stripe/checkout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useUserSubscription } from '@/hooks/useUserSubscription';

export default function Newsletter() {
  const { newsletterTier } = useUserSubscription();

  const isSubscribed = newsletterTier === 'monthly' || newsletterTier === 'yearly';

  async function startNewsletterCheckout(plan) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = `${window.location.origin}/auth?redirect=${encodeURIComponent('/#newsletter')}`;
      return;
    }

    await redirectToCheckout(plan, session.user.email);
  }

  async function handleNewsletterMonthlyClick() {
    await startNewsletterCheckout('newsletter_monthly');
  }

  async function handleNewsletterYearlyClick() {
    await startNewsletterCheckout('newsletter_yearly');
  }

  return (
    <section id="newsletter" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="bg-background border border-border rounded-lg p-6 xs:p-8 sm:p-10 text-center electric-card">
          <p className="text-xs xs:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Weekly insights
          </p>
          <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            YieldCanary Weekly Newsletter
          </h2>
          <p className="text-sm xs:text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Curated insights every Monday morning. Top ETF income opportunities,
            biggest movers, and buy-zone picks delivered to your inbox.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            {!isSubscribed ? (
              <>
                <Button
                  size="lg"
                  className="text-sm sm:text-base px-6 sm:px-8 w-auto"
                  onClick={handleNewsletterMonthlyClick}
                >
                  Subscribe – Monthly ($5)
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-sm sm:text-base px-6 sm:px-8 w-auto"
                  onClick={handleNewsletterYearlyClick}
                >
                  Subscribe – Yearly ($49)
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                You&apos;re already subscribed to the newsletter. Manage or cancel from your dashboard profile menu.
              </p>
            )}
          </div>
          <p className="text-xs xs:text-sm text-muted-foreground mt-4 sm:mt-6">
            {isSubscribed ? 'Thank you for subscribing.' : 'Cancel anytime. Delivered every Monday morning.'}
          </p>
        </div>
      </div>
    </section>
  );
}