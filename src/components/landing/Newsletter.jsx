import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUserSubscription } from '@/hooks/useUserSubscription';

export default function Newsletter() {
  const { hasBundledNewsletterAccess, loading } = useUserSubscription();

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
            biggest movers, and buy-zone picks delivered to your inbox — included with
            Basic and Advanced.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : hasBundledNewsletterAccess ? (
              <p className="text-sm text-muted-foreground max-w-md">
                You&apos;re all set — the weekly newsletter is included with your plan.
                It arrives every Monday morning at the email on your account.
              </p>
            ) : (
              <>
                <Button size="lg" className="text-sm sm:text-base px-6 sm:px-8 w-auto" asChild>
                  <Link to="/#pricing">View Basic &amp; Advanced plans</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-sm sm:text-base px-6 sm:px-8 w-auto"
                  asChild
                >
                  <Link to={`/auth?redirect=${encodeURIComponent('/#newsletter')}`}>
                    Sign in
                  </Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-xs xs:text-sm text-muted-foreground mt-4 sm:mt-6">
            {hasBundledNewsletterAccess && !loading
              ? 'Thank you for being a subscriber.'
              : 'Cancel anytime. Delivered every Monday morning to paid Basic and Advanced members.'}
          </p>
        </div>
      </div>
    </section>
  );
}
