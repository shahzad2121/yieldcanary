import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, Star, AlertTriangle, Skull, Clock, TrendingDown, Shield, Moon, Sun, X, LogOut, User } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { redirectToCheckout, type PricingPlan } from '@/integrations/stripe/checkout';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { sendTransactionalEmail } from '@/lib/sendTransactionalEmail';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Footer } from '@/components/Footer';
import { MarketingStats } from '@/components/MarketingStats';
import { DashboardScreenshot } from '@/components/DashboardScreenshot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Landing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);

  // Load user session on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    };

    checkUser();
  }, []);

  // Subscribe to auth changes so nav stays in sync
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Handle payment status query param
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success' || payment === 'cancelled') {
      setPaymentStatus(payment as 'success' | 'cancelled');
      const cleanedParams = new URLSearchParams(searchParams);
      cleanedParams.delete('payment');
      setSearchParams(cleanedParams);

      // Send payment receipt email on success
      if (payment === 'success' && userEmail) {
        const firstName = userEmail.split('@')[0];
        sendTransactionalEmail({
          to: userEmail,
          templateId: 'payment_receipt',
          data: { first_name: firstName },
        }).catch(err => console.error('Failed to send payment receipt email:', err));
      }
    }
  }, [searchParams, setSearchParams, userEmail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    navigate('/');
  };

  const handleCheckout = async (plan: PricingPlan) => {
    try {
      // Get current user email
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        // Redirect to auth if not logged in
        alert('Please sign in first to upgrade your plan.');
        navigate('/auth');
        return;
      }

      setLoading(plan);
      await redirectToCheckout(plan, email);
    } catch (error) {
      console.error('Checkout failed:', error);
      // Error is already handled and shown as toast in redirectToCheckout
    } finally {
      setLoading(null);
    }
  };
  return (
    <>
      <Helmet>
        <title>YieldCanary - See Which High-Yield ETFs Are Quietly Dying</title>
        <meta 
          name="description" 
          content="The only tool that shows True Income Yield, Death Clock, and Canary Status for high-yield ETFs. Stop investing in funds that are quietly giving you your own money back." 
        />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border">
          <div className="max-w-7xl mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <span className="text-lg xs:text-xl sm:text-2xl">🐤</span>
              <span className="text-sm xs:text-base sm:text-lg font-bold text-foreground hidden xs:inline">YieldCanary</span>
            </div>
            <div className="flex items-center gap-2 xs:gap-3">
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 xs:h-5 xs:w-5 text-foreground" />
                ) : (
                  <Moon className="h-4 w-4 xs:h-5 xs:w-5 text-foreground" />
                )}
              </button>
              {userEmail ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="text-xs sm:text-sm px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-10"
                    onClick={() => navigate('/dashboard')}
                  >
                    Dashboard
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-full border border-border px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                          <AvatarFallback className="text-sm font-semibold">
                            {userEmail.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col text-left">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Signed in</span>
                          <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">{userEmail}</span>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>
                        <div className="flex items-start gap-2">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-base font-semibold">
                              {userEmail.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Account email</p>
                            <p className="text-sm font-medium break-all">{userEmail}</p>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={(event) => { event.preventDefault(); navigate('/dashboard'); }}>
                        <User className="mr-2 h-4 w-4" /> View dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(event) => { event.preventDefault(); handleSignOut(); }}
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <>
                  <Link to="/auth" className="hidden xs:inline">
                    <Button variant="ghost" className="text-xs sm:text-sm px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-10">Login</Button>
                  </Link>
                  <Link to="/auth">
                    <Button className="text-xs sm:text-sm px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-10">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Payment Status Alert */}
        {paymentStatus === 'success' && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              <span className="text-sm">Payment successful! Your access has been upgraded. Refresh the dashboard to see all features.</span>
            </div>
            <button
              onClick={() => setPaymentStatus(null)}
              className="flex-shrink-0 hover:bg-green-500/20 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {paymentStatus === 'cancelled' && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">Payment was cancelled. No charges were made.</span>
            </div>
            <button
              onClick={() => setPaymentStatus(null)}
              className="flex-shrink-0 hover:bg-amber-500/20 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Hero Section */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-4 sm:mb-6">
              The smartest way to invest in high-yield funds.
            </h1>
            <p className="text-base xs:text-lg sm:text-xl text-muted-foreground mb-2 sm:mb-4 px-2">
              Most high-yield ETFs quietly give you your own money back and call it income.
            </p>
            <p className="text-base xs:text-lg sm:text-xl font-semibold text-foreground mb-6 sm:mb-8 px-2">
              We name the dying ones — and show exactly how many years they have left.
            </p>
            <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-sm sm:text-base px-6 sm:px-8 w-full xs:w-auto">
                  Get Started Free
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-sm sm:text-base px-6 sm:px-8 w-full xs:w-auto"
                onClick={() => {
                  const pricingSection = document.getElementById('pricing');
                  pricingSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>

        {/* Dashboard Screenshot with 3D Pop-out */}
        <DashboardScreenshot
          alt="YieldCanary Dashboard - See which ETFs are healthy vs dying"
          enableParticles={true}
          enableFloating={true}
          enableScanLine={true}
        />

        {/* Value Proposition */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
              The Only Tool That Tells You When a High-Yield ETF Is Dying
            </h2>
            <p className="text-sm xs:text-base sm:text-lg text-muted-foreground px-2">
              No fluff. No 40-page PDFs. Just the cold, hard truth about your "income" funds.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              <FeatureCard 
                icon={<TrendingDown className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8" />}
                title="True Income Yield"
                description="The real yield after stripping out return-of-capital. Not the marketing number."
              />
              <FeatureCard 
                icon={<Clock className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8" />}
                title="Death Clock"
                description="Exact number of years until 50% NAV erosion at the current ROC bleed rate."
              />
              <FeatureCard 
                icon={<AlertTriangle className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8" />}
                title="Canary Status"
                description="Alive / Dying / Dead status at a glance. Green means safe. Red means run."
              />
              <FeatureCard 
                icon={<Shield className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8" />}
                title="Live ROC %"
                description="ROC % estimated from recent NAV erosion + distribution trends. Updated weekly — no guesswork, just real data."
              />
            </div>
          </div>
        </section>

        {/* Marketing Stats */}
        <MarketingStats
          amount={80000}
          headline="Avoid Yield Traps That Could Cost You Thousands"
          exampleText="$100,000 in TSLY at its inception: $80,000 in principal loss"
          disclaimer="Assuming distributions were spent as income"
          description="Join thousands of investors who use YieldCanary to identify dying funds before they erode their portfolio value."
          ctaText="Get Started Free"
          ctaLink="/auth"
          enableParticles={true}
          enableCounter={true}
        />

        {/* Testimonials */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-xs xs:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Real Results | Real People
              </p>
              <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground">
                Hear from others using YieldCanary!
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <TestimonialCard 
                quote="Finally someone just says it out loud — half my 'high-yield' funds are dying. Sold three positions the day I saw the Death Clock under 4 years. Thank you."
                name="Morgan James"
                title="Co-Founder & CEO"
              />
              <TestimonialCard 
                quote="I was about to load up on another YieldMax single-stock disaster. One look at the red Dead Canary and the 1.8-year Death Clock saved me six figures. Worth 10× the price."
                name="John Jacobs"
                title="Private Investor"
              />
              <TestimonialCard 
                quote="Been in the high-yield game for 5 years and this is the first tool that actually shows True Income instead of the marketing yield. Every dividend investor needs this."
                name="Amy Schneider"
                title="Data Analyst"
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
                Pricing For Every Investor
              </h2>
              <p className="text-sm xs:text-base sm:text-lg text-muted-foreground px-2">
                Stop guessing which high-yield ETFs are actually safe.<br />
                Choose the plan that fits your portfolio.
              </p>
            </div>
            
            <div className="flex justify-center gap-2 xs:gap-3 mb-8 sm:mb-12">
              <Button 
                variant={!isYearly ? "default" : "outline"} 
                className="rounded-full text-xs xs:text-sm px-4 xs:px-6 h-9 xs:h-10"
                onClick={() => setIsYearly(false)}
              >
                Monthly
              </Button>
              <Button 
                variant={isYearly ? "default" : "outline"} 
                className="rounded-full text-xs xs:text-sm px-4 xs:px-6 h-9 xs:h-10"
                onClick={() => setIsYearly(true)}
              >
                Yearly (Save 17%)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <PricingCard 
                name="Free"
                description="For anyone to get started."
                price="$0"
                period="/ month"
                features={[
                  "Explore 200+ high-yield ETFs for free",
                  "Instant Canary Status on every fund",
                  "4 high-profile ETFs completely unblurred",
                  "Search, filter, and sort the full list",
                  "Get a taste of true income after ROC",
                ]}
                buttonText="Get Started"
                buttonVariant="outline"
                onCheckout={() => window.location.href = '/auth'}
                isLoading={false}
              />
              <PricingCard 
                name="Basic"
                description="Unlock the full dashboard & real income insights."
                price={isYearly ? "$89" : "$9"}
                period={isYearly ? "/ year" : "/ month"}
                features={[
                  "True Income Yield revealed (real sustainable income after ROC)",
                  "ROC % + ROC Health",
                  "Alive / Dying / Dead Canary status",
                  "Death Clock (projected years to ~50% NAV erosion)",
                  "Create a custom Watchlist to track your favorite ETFs",
                  "Export CSV data for any filtered view",
                  "Monthly updates included",
                  "Cancel anytime",
                ]}
                buttonText="Start Basic"
                featured
                onCheckout={() => handleCheckout(isYearly ? 'basic_yearly' : 'basic_monthly')}
                isLoading={loading === (isYearly ? 'basic_yearly' : 'basic_monthly')}
              />
              <PricingCard 
                name="Advanced"
                description="Unlock weekly alerts, exclusive insights, and priority support."
                price={isYearly ? "$189" : "$19"}
                period={isYearly ? "/ year" : "/ month"}
                teaserText={!isYearly ? "Lock in $19/month now – going to $49/month when released" : undefined}
                features={[
                  "Everything in Basic +",
                  'Weekly update emails (high-risk funds & big movers)',
                  "Monthly newsletter (top picks, market insights, updates)",
                  "Priority access to the YieldCanary founder",
                  "Portfolio linking (coming soon)",
                  "Custom notifications & buy alerts (coming soon)",
                  "Visual charts & scenario calculator (coming soon)",
                  "'Ask Canary' custom AI bot to ask any questions about high-yield funds (coming soon)",
                ]}
                buttonText="Start Advanced"
                buttonVariant="outline"
                onCheckout={() => handleCheckout(isYearly ? 'advanced_yearly' : 'advanced_monthly')}
                isLoading={loading === (isYearly ? 'advanced_yearly' : 'advanced_monthly')}
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="text-center p-3 xs:p-4 sm:p-6 group">
    <div className="inline-flex items-center justify-center w-12 xs:w-14 h-12 xs:h-14 sm:w-16 sm:h-16 rounded-full bg-muted mb-2 xs:mb-3 sm:mb-4 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110 electric-glow">
      <div className="text-primary">
        {icon}
      </div>
    </div>
    <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 group-hover:text-primary transition-colors">{title}</h3>
    <p className="text-xs xs:text-sm sm:text-base text-muted-foreground group-hover:text-foreground transition-colors px-1">{description}</p>
    
    {/* Animated badge */}
    <div className="mt-2 xs:mt-3 sm:mt-4 inline-block">
      <div className="px-2 xs:px-3 py-0.5 xs:py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30 animate-pulse-slow">
        ✓ Live Tracking
      </div>
    </div>
  </div>
);

const TestimonialCard = ({ quote, name, title }: { quote: string; name: string; title: string }) => (
  <div className="bg-background border border-border rounded-lg p-4 xs:p-5 sm:p-6">
    <div className="flex gap-1 mb-3 xs:mb-4">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="h-4 xs:h-5 w-4 xs:w-5 fill-foreground text-foreground" />
      ))}
    </div>
    <p className="text-xs xs:text-sm sm:text-base text-foreground mb-4 xs:mb-6">"{quote}"</p>
    <div>
      <p className="text-sm xs:text-base font-semibold text-foreground">{name}</p>
      <p className="text-xs xs:text-sm text-muted-foreground">{title}</p>
    </div>
  </div>
);

const PricingCard = ({ 
  name, 
  description, 
  price, 
  period, 
  features, 
  buttonText, 
  buttonVariant = "default",
  featured = false,
  teaserText,
  onCheckout,
  isLoading = false,
}: { 
  name: string; 
  description: string; 
  price: string; 
  period: string; 
  features: string[]; 
  buttonText: string; 
  buttonVariant?: "default" | "outline";
  featured?: boolean;
  teaserText?: string;
  onCheckout: () => void;
  isLoading?: boolean;
}) => (
  <div className={`rounded-lg p-4 xs:p-6 sm:p-8 electric-card relative group transition-all duration-300 ${featured ? 'border-2 border-primary shadow-lg hover:shadow-xl scale-100 md:scale-105' : 'border border-border hover:border-primary/50 hover:shadow-md'}`}>
    <div className="relative z-10">
      <h3 className={`text-lg xs:text-xl font-bold mb-1 ${featured ? 'text-primary electric-text' : 'text-foreground'}`}>{name}</h3>
      <p className="text-xs xs:text-sm text-muted-foreground mb-3 xs:mb-4">{description}</p>
      {teaserText && (
        <div className="mb-3 xs:mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs xs:text-sm font-medium text-amber-600 dark:text-amber-400 text-center">
            {teaserText}
          </p>
        </div>
      )}
      <div className="mb-4 xs:mb-6">
        <span className={`text-3xl xs:text-4xl font-bold ${featured ? 'electric-text' : 'text-foreground'}`}>{price}</span>
        <span className="text-xs xs:text-sm text-muted-foreground">{period}</span>
      </div>
      <Button 
        className={`w-full mb-4 xs:mb-6 text-xs xs:text-sm ${featured ? 'bg-gradient-to-r from-primary to-secondary hover:shadow-lg electric-glow' : ''}`}
        variant={buttonVariant}
        onClick={onCheckout}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : buttonText}
      </Button>
      <ul className="space-y-2 xs:space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className={`h-4 xs:h-5 w-4 xs:w-5 shrink-0 mt-0.5 ${featured ? 'text-primary' : 'text-foreground'}`} />
            <span className="text-xs xs:text-sm text-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default Landing;
