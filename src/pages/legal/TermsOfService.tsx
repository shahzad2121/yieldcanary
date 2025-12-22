import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
  return (
    <>
      <Helmet>
        <title>Terms of Service - YieldCanary</title>
        <meta name="description" content="YieldCanary Terms of Service" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mb-6"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground mb-2">Last updated: January 2026</p>

            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground mb-4">
                By accessing and using YieldCanary, you accept and agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                YieldCanary provides ETF analytics and data visualization services. We analyze high-yield ETFs
                and provide information about their sustainability, Return of Capital (ROC), and health status.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground mb-4">
                You are responsible for maintaining the confidentiality of your account credentials and for all
                activities that occur under your account.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">4. Subscription and Payment</h2>
              <p className="text-muted-foreground mb-4">
                Subscriptions are billed on a monthly or yearly basis. You may cancel your subscription at any time.
                Refunds are subject to our Refund Policy.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                YieldCanary provides data and analytics for informational purposes only. This is not financial advice.
                You are solely responsible for your investment decisions.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">6. Contact Information</h2>
              <p className="text-muted-foreground mb-4">
                For questions about these Terms of Service, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

