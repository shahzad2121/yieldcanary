import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';

export default function Affiliates() {
  return (
    <>
      <Helmet>
        <title>Affiliates - YieldCanary</title>
        <meta name="description" content="Earn 30% lifetime recurring commissions by promoting YieldCanary – the tool for spotting sustainable high-yield ETFs." />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
            <h1 className="text-3xl sm:text-4xl font-bold mb-6">Affiliate Program</h1>

            <p className="text-lg text-muted-foreground mb-8">
              Earn <strong>30% lifetime recurring commissions</strong> on every paid signup you refer. Help investors discover sustainable high-yield ETFs and earn passive income while you do it.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-10">
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <h3 className="text-xl font-semibold mb-4">Why Promote YieldCanary?</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li>Perfect fit for finance, dividend, and ETF creators/audiences</li>
                  <li>30-day trials for your referrals (vs. standard 7-day)</li>
                  <li>Easy tracking & payouts via Tolt</li>
                  <li>High conversion potential – investors are hungry for ROC/true yield clarity</li>
                  <li>Branded affiliate portal at yieldcanary.tolt.io</li>
                </ul>
              </div>

              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <h3 className="text-xl font-semibold mb-4">How It Works</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li>Sign up as an affiliate → get your unique link/code</li>
                  <li>Share in videos, posts, newsletters, or your community</li>
                  <li>Earn 30% of every paid subscription your referrals make – for life</li>
                  <li>Payouts monthly</li>
                  <li>Full dashboard to track clicks, signups, revenue, and commissions</li>
                </ul>
              </div>
            </div>

            <div className="text-center mb-10">
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <a href="https://yieldcanary.tolt.io" target="_blank" rel="noopener noreferrer">
                  Join the Affiliate Program Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                Already approved? <a href="https://yieldcanary.tolt.io/login" className="underline">Log in to your portal</a>.
              </p>
            </div>

            <div className="prose prose-sm sm:prose-base">
              <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
              <details className="mb-4">
                <summary className="font-medium cursor-pointer">How do I get started?</summary>
                <p className="mt-2 text-muted-foreground">
                  Click "Join the Affiliate Program" above → sign up in Tolt → get your unique referral link/code.
                </p>
              </details>
              <details className="mb-4">
                <summary className="font-medium cursor-pointer">What commission do affiliates earn?</summary>
                <p className="mt-2 text-muted-foreground">
                  30% lifetime recurring on every paid subscription you refer (monthly or annual plans).
                </p>
              </details>
              <details className="mb-4">
                <summary className="font-medium cursor-pointer">Do referrals get a special trial?</summary>
                <p className="mt-2 text-muted-foreground">
                  Yes — 30-day free trial (vs. standard 7-day) to increase conversions.
                </p>
              </details>
              <details>
                <summary className="font-medium cursor-pointer">Questions or need promo materials?</summary>
                <p className="mt-2 text-muted-foreground">
                  Email support@yieldcanary.com — happy to send banners, swipe copy, or custom codes.
                </p>
              </details>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
