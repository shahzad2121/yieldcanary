import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Crown, Zap } from 'lucide-react';
import { useState } from 'react';
import { redirectToCheckout } from '@/integrations/stripe/checkout';
import { supabase } from '@/integrations/supabase/client';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const basicFeatures = [
  'True Income Yield revealed (real sustainable income after ROC)',
  'ROC % + ROC Health',
  'Alive / Dying / Dead Canary status',
  'Death Clock (projected years to ~50% NAV erosion)',
  'Create a custom Watchlist to track your favorite ETFs',
  'Export CSV data for any filtered view',
  'Monthly updates included',
  'Cancel anytime',
];

const advancedFeatures = [
  'Everything in Basic +',
  'Weekly update emails (high-risk funds & big movers)',
  'Monthly newsletter (top picks, market insights, updates)',
  'Priority access to the YieldCanary founder',
  'Portfolio linking (coming soon)',
  'Custom notifications & buy alerts (coming soon)',
  'Visual charts & scenario calculator (coming soon)',
  "'Ask Canary' custom AI bot to ask any questions about high-yield funds (coming soon)",
];

export function UpgradeModal({ isOpen, onClose, onUpgrade }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'advanced'>('basic');
  const [isYearly, setIsYearly] = useState(false);

  const handleUpgradeClick = async (plan: 'basic_monthly' | 'basic_yearly' | 'advanced_monthly' | 'advanced_yearly') => {
    try {
      setLoading(plan);
      
      // Get current user email
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        alert('Unable to find user email. Please sign in again.');
        onClose();
        return;
      }

      await redirectToCheckout(plan, email);
    } catch (error) {
      console.error('Upgrade failed:', error);
      // Error is already handled and shown as toast in redirectToCheckout
    } finally {
      setLoading(null);
    }
  };

  const getPlanId = () => {
    if (selectedPlan === 'basic') {
      return isYearly ? 'basic_yearly' : 'basic_monthly';
    }
    return isYearly ? 'advanced_yearly' : 'advanced_monthly';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-4 xs:p-6">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3 xs:mb-4">
            <div className="h-12 xs:h-16 w-12 xs:w-16 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
              <Crown className="h-6 xs:h-8 w-6 xs:w-8 text-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl xs:text-2xl font-bold">
            Unlock YieldCanary Pro
          </DialogTitle>
          <DialogDescription className="text-center text-xs xs:text-sm text-muted-foreground">
            See the full picture. Make smarter income decisions.
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex justify-center gap-2 py-2">
          <Button
            variant={!isYearly ? 'default' : 'outline'}
            size="sm"
            className="rounded-full text-xs px-4"
            onClick={() => setIsYearly(false)}
          >
            Monthly
          </Button>
          <Button
            variant={isYearly ? 'default' : 'outline'}
            size="sm"
            className="rounded-full text-xs px-4"
            onClick={() => setIsYearly(true)}
          >
            Yearly (Save 17%)
          </Button>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-2 gap-3 py-2">
          {/* Basic Plan */}
          <button
            onClick={() => setSelectedPlan('basic')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              selectedPlan === 'basic'
                ? 'border-green-500 bg-green-500/10'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <p className="font-semibold text-sm">Basic</p>
            <p className="text-lg font-bold">
              {isYearly ? '$89' : '$9'}
              <span className="text-xs font-normal text-muted-foreground">/{isYearly ? 'year' : 'mo'}</span>
            </p>
          </button>

          {/* Advanced Plan */}
          <button
            onClick={() => setSelectedPlan('advanced')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              selectedPlan === 'advanced'
                ? 'border-green-500 bg-green-500/10'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <p className="font-semibold text-sm">Advanced</p>
            <p className="text-lg font-bold">
              {isYearly ? '$189' : '$19'}
              <span className="text-xs font-normal text-muted-foreground">/{isYearly ? 'year' : 'mo'}</span>
            </p>
          </button>
        </div>

        {/* Features List */}
        <div className="py-2">
          <ul className="space-y-2">
            {(selectedPlan === 'basic' ? basicFeatures : advancedFeatures).map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-2.5 w-2.5 text-green-500" />
                </div>
                <span className="text-xs text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={() => handleUpgradeClick(getPlanId() as any)}
            disabled={loading !== null}
            className="w-full h-10 text-sm gap-2"
          >
            <Zap className="h-4 w-4 flex-shrink-0" />
            {loading ? 'Processing...' : `Upgrade to ${selectedPlan === 'basic' ? 'Basic' : 'Advanced'}`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Cancel anytime • Secure checkout
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
