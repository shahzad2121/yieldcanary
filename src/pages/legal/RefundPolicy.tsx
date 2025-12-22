import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RefundPolicy() {
  return (
    <>
      <Helmet>
        <title>Refund Policy - YieldCanary</title>
        <meta name="description" content="YieldCanary Refund Policy" />
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Refund Policy</h1>
            <p className="text-muted-foreground mb-2">Last updated: January 2026</p>

            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">1. Refund Eligibility</h2>
              <p className="text-muted-foreground mb-4">
                We offer refunds for subscription payments within 30 days of the initial purchase date, provided
                you have not used the service extensively. Refund requests must be submitted through our support channels.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">2. Refund Process</h2>
              <p className="text-muted-foreground mb-4">
                To request a refund, please contact our support team with your account email and reason for the refund.
                We will process refunds within 5-10 business days to your original payment method.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">3. Subscription Cancellations</h2>
              <p className="text-muted-foreground mb-4">
                You may cancel your subscription at any time. Cancellation will take effect at the end of your current
                billing period. You will continue to have access until the end of the paid period.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">4. Non-Refundable Items</h2>
              <p className="text-muted-foreground mb-4">
                Refunds are not available for subscriptions that have been active for more than 30 days, or for accounts
                that have been terminated due to violation of our Terms of Service.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">5. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                For refund requests or questions about this policy, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

