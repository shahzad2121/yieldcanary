import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DoNotSellMyInfo() {
  return (
    <>
      <Helmet>
        <title>Do Not Sell My Info - YieldCanary</title>
        <meta name="description" content="YieldCanary Do Not Sell My Info - CCPA Compliance" />
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Do Not Sell My Personal Information</h1>
            <p className="text-muted-foreground mb-2">Last updated: January 2026</p>

            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Your Privacy Rights (CCPA)</h2>
              <p className="text-muted-foreground mb-4">
                Under the California Consumer Privacy Act (CCPA), you have the right to opt out of the sale of your
                personal information. We respect your privacy and want to make it clear that we do not sell your
                personal information to third parties.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">We Do Not Sell Your Information</h2>
              <p className="text-muted-foreground mb-4">
                YieldCanary does not sell, rent, or trade your personal information to third parties for their
                marketing purposes. We may share information with service providers who help us operate our business,
                but these providers are contractually obligated to protect your information and use it only for the
                purposes we specify.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
              <div className="text-muted-foreground mb-4 space-y-2">
                <p><strong>Right to Know:</strong> You can request information about what personal information we collect, use, and share.</p>
                <p><strong>Right to Delete:</strong> You can request that we delete your personal information.</p>
                <p><strong>Right to Opt-Out:</strong> You can opt out of the sale of your personal information (though we do not sell it).</p>
                <p><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</p>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">How to Exercise Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                To exercise any of these rights, please contact us through our support channels. We will respond to
                your request within 45 days. You may be required to verify your identity before we can process your request.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have questions about your privacy rights or wish to exercise them, please contact us through
                our support channels. We are committed to protecting your privacy and will respond to all requests
                in accordance with applicable privacy laws.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

