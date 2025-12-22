import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - YieldCanary</title>
        <meta name="description" content="YieldCanary Privacy Policy" />
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-2">Last updated: January 2026</p>

            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">
                We collect information you provide directly to us, such as when you create an account, make a purchase,
                or contact us for support. This includes your email address, username, and payment information.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">
                We use the information we collect to provide, maintain, and improve our services, process transactions,
                send you transactional emails, and comply with legal obligations.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
              <p className="text-muted-foreground mb-4">
                We do not sell your personal information. We may share your information with service providers who
                assist us in operating our service, such as payment processors and email service providers.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate security measures to protect your personal information. However, no method
                of transmission over the internet is 100% secure.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                You have the right to access, update, or delete your personal information. You may also opt out of
                certain data processing activities. See our "Do Not Sell My Info" page for more information.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">6. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                For questions about this Privacy Policy, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

