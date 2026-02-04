import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';

export default function Affiliates() {
  return (
    <>
      <Helmet>
        <title>Affiliates - YieldCanary</title>
        <meta name="description" content="YieldCanary affiliate program" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Affiliate Program</h1>
            <p className="text-muted-foreground">
              Our affiliate program is coming soon. If you’re interested in promoting YieldCanary and earning commissions, check back here later or contact us for updates.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
