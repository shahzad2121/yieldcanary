import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CookiePolicy() {
  return (
    <>
      <Helmet>
        <title>Cookie Policy - YieldCanary</title>
        <meta name="description" content="YieldCanary Cookie Policy" />
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground mb-2">Last updated: January 2026</p>

            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">1. What Are Cookies</h2>
              <p className="text-muted-foreground mb-4">
                Cookies are small text files that are placed on your device when you visit our website. They help us
                provide you with a better experience and allow us to improve our services.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">2. Types of Cookies We Use</h2>
              <div className="text-muted-foreground mb-4 space-y-2">
                <p><strong>Essential Cookies:</strong> Required for the website to function properly, such as authentication and session management.</p>
                <p><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website.</p>
                <p><strong>Preference Cookies:</strong> Remember your settings and preferences, such as theme selection.</p>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">3. How We Use Cookies</h2>
              <p className="text-muted-foreground mb-4">
                We use cookies to maintain your login session, remember your preferences, analyze website traffic,
                and improve our services. We do not use cookies to track you across other websites.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">4. Managing Cookies</h2>
              <p className="text-muted-foreground mb-4">
                You can control and manage cookies through your browser settings. However, disabling certain cookies
                may affect the functionality of our website. You can also manage your cookie preferences through
                our cookie consent banner.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">5. Third-Party Cookies</h2>
              <p className="text-muted-foreground mb-4">
                We may use third-party services that set their own cookies. These services help us provide and
                improve our services. Please refer to their privacy policies for more information.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">6. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                For questions about our use of cookies, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

