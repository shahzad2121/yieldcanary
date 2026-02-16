import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendSupportRequest } from '@/lib/sendSupportRequest';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export function HelpModal({ isOpen, onClose, userEmail }: HelpModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Pre-fill email and reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(userEmail || '');
      setName('');
      setMessage('');
    }
  }, [isOpen, userEmail]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your message before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await sendSupportRequest({
        name: name.trim() || undefined,
        email: email.trim(),
        message: message.trim(),
      });

      toast({
        title: 'Message sent',
        description: 'Thank you for contacting us! All support tickets are responded to within 1 business day.',
      });
      
      setName('');
      setEmail(userEmail || '');
      setMessage('');
      onClose();
    } catch (err: any) {
      console.error('Error sending support request:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] mx-1 flex flex-col">
        <DialogHeader>
          <DialogTitle>YieldCanary Help Center</DialogTitle>
          <DialogDescription>
            Understanding the Dashboard Metrics
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {/* Introduction */}
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome! YieldCanary tracks over 200 income ETFs to help you separate sustainable funds from those that quietly erode principal through destructive Return of Capital (ROC). Below is a detailed breakdown of each column in the main dashboard.
              Scroll down to the bottom to see the <strong>Key Concepts</strong> and Support Ticket sections.
            </p>
          </div>

          {/* Ticker & Name */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Ticker & Name</h3>
            <p className="text-sm text-muted-foreground">
              Standard ETF symbol and full name for easy identification.
            </p>
          </div>

          {/* Canary Status */}
<div>
  <h3 className="font-semibold text-sm mb-2">Canary Status</h3>
  <p className="text-sm text-muted-foreground mb-3">
    A quick health rating for each ETF based on estimated destructive Return of Capital (ROC) — the portion of payouts that comes from returning principal (NAV decline) rather than real earned income.
  </p>

  <p className="text-sm text-muted-foreground mb-3 font-medium">
    How destructive ROC% is actually calculated (brief recap):
  </p>

  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc mb-4">
    <li>
      We start with the ETF's share price (NAV) decline since inception (or earliest available data). That's the core evidence of erosion.
    </li>
    <li>
      We compare that NAV drop to the total distributions paid out over the same period.
    </li>
    <li>
      To make it annual:
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>Annual NAV erosion = total price drop ÷ years since inception</li>
        <li>Annual distributions = total payouts ÷ years since inception</li>
      </ul>
    </li>
    <li>
      ROC% = (annual NAV erosion ÷ annual distributions) × 100 (capped at 100%).
    </li>
  </ul>

  <p className="text-sm text-muted-foreground mb-3">
    In other words: NAV decline is the proof something's being eroded. Distributions are the scale we measure it against. The result tells us how much of those payouts were likely returning your own principal instead of real income.
  </p>

  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
    <li>
      <span className="font-medium text-green-600 dark:text-green-400">Healthy (green)</span>: ROC &lt; 20% — low or no principal erosion. Distributions are mostly real earned income — safe for long-term cash flow.
    </li>
    <li>
      <span className="font-medium text-yellow-600 dark:text-yellow-400">Dying (yellow)</span>: ROC 20%&ndash;39% — moderate principal erosion. Some of the payout is your own capital — monitor closely.
    </li>
    <li>
      <span className="font-medium text-red-600 dark:text-red-400">Dead (red)</span>: ROC &ge; 40% — severe erosion. Most of the headline yield is returning capital — high risk of fast principal loss.
    </li>
  </ul>

  <p className="text-xs text-muted-foreground mt-4 italic">
    Status is an estimate based on historical NAV changes vs. cumulative payouts. Always cross-check issuer 19a-1 notices for official ROC details. Updates weekly with new data.
  </p>
</div>

          {/* Death Clock */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Death Clock</h3>
            <p className="text-sm text-muted-foreground">
              Projects how many years (or fraction) until the ETF's NAV could be cut in half at the current rate of destructive ROC.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc mt-2">
              <li>Shown only for funds with meaningful erosion risk.</li>
              <li>"N/A" means little/no destructive ROC — no significant projected decay.</li>
              <li>This is a trend-based estimate, not a guarantee — it changes weekly with new data.</li>
            </ul>
          </div>

          {/* True Income Yield */}
<div>
  <h3 className="font-semibold text-sm mb-2">True Income Yield</h3>
  <p className="text-sm text-muted-foreground mb-3">
    The real, sustainable yield after subtracting destructive Return of Capital (ROC) from the ETF's payouts.
  </p>

  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
    <li>
      Funds often advertise high yields (total distributions ÷ current price), but a large portion can be ROC — your own principal being returned as "income."
    </li>
    <li>
      True Income Yield isolates the portion that's actual earned income (from option premiums, dividends, interest, etc.).
    </li>
    <li>
      A big gap between True Income Yield and Headline Yield signals potential principal erosion.
    </li>
  </ul>

  <p className="text-xs text-muted-foreground mt-3 italic">
    Note: This is an estimate based on historical data. Always cross-check issuer 19a-1 notices for official ROC details.
  </p>
</div>

          {/* Total Return 1Y */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Total Return 1Y</h3>
            <p className="text-sm text-muted-foreground">
              Price appreciation (capital return) over the last 12 months, excluding distributions. This shows only the change in share price — not total return with reinvested dividends.
            </p>
          </div>

{/* Take-Home Cash Return */}
<div>
  <h3 className="font-semibold text-sm mb-2">Take-Home Cash Return</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Estimated total return over the last year after taxes on distributions — what you actually keep in your pocket.
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    It combines:
  </p>
  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
    <li>Price change (capital appreciation or depreciation) over the past 12 months</li>
    <li>After-tax distributions received (total payouts × (1 – your personal tax rate from account settings))</li>
  </ul>

  <p className="text-sm text-muted-foreground mt-3">
    Formula: (Ending price + after-tax distributions) / Starting price – 1
  </p>

  <p className="text-sm text-muted-foreground mt-3">
    Default tax rate is 20% for new users — update in your account settings for accuracy.
  </p>

  <p className="text-sm text-muted-foreground mt-4">
    This is the default sort order when you log in to the dashboard — it prioritizes funds with the highest after-tax return over the last year.
  </p>

  <p className="text-xs text-muted-foreground mt-4 italic">
    This is an estimate based on historical data and your entered tax rate. It does not include capital gains taxes (assumes no sale). Consult a tax advisor for personal advice.
  </p>
</div>

          {/* Monthly Spendable Cash Yield */}
<div>
  <h3 className="font-semibold text-sm mb-2">Monthly Spendable Cash Yield</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Estimated spendable monthly cash from the ETF's most recent full month of distributions, after taxes — what you could actually pocket (not reinvested).
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    Uses your personal tax rate from account settings (default 20% for new users) applied to the distributions. Price change is not included (unrealized until sold).
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    Formula: (Last full month's distributions after tax) ÷ current price × 100
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    Shows "N/A" if the fund has no full month of payout data yet (common for very new funds).
  </p>

  <p className="text-xs text-muted-foreground mt-4 italic">
    This is an estimate based on the latest available month and your tax rate. Actual cash received may vary slightly due to timing or taxes.
  </p>
</div>

          {/* Price */}
<div>
  <h3 className="font-semibold text-sm mb-2">Price</h3>
  <p className="text-sm text-muted-foreground mb-2">
    Current market price per share of the ETF.
  </p>
  <p className="text-sm text-muted-foreground">
    This is the latest adjusted closing price pulled from our data source. It updates every 2 minutes and is used to calculate yields, returns, and other metrics.
  </p>
</div>

          {/* Headline Yield */}
<div>
  <h3 className="font-semibold text-sm mb-2">Headline Yield</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Trailing 12-month (TTM) yield: total actual distributions paid over the past year divided by current price.
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    This is the historical yield most platforms and funds report — what investors actually received over the last year.
  </p>

  <p className="text-sm text-muted-foreground mb-3">
    Often higher than True Income Yield because it includes destructive ROC (your own principal being returned as "yield").
  </p>

  <p className="text-sm text-muted-foreground">
    Compare it to True Income Yield (which strips out destructive ROC) and Advertised Yield (issuer's forward-looking snapshot from the latest payout) to see the full picture.
  </p>

  <p className="text-xs text-muted-foreground mt-4 italic">
    Note: This is based on actual historical payouts. Always cross-check issuer 19a-1 notices for official details.
  </p>
</div>

          {/* Payout Frequency */}
<div>
  <h3 className="font-semibold text-sm mb-2">Payout Frequency</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Shows how often the ETF typically distributes cash to shareholders.
  </p>
  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
    <li>
      <span className="font-medium">Weekly</span>: Paid every week (common in newer high-yield option-income ETFs like many YieldMax and Roundhill funds).
    </li>
    <li>
      <span className="font-medium">Monthly</span>: Paid once per month (most traditional dividend and covered-call ETFs).
    </li>
    <li>
      <span className="font-medium">Quarterly</span>: Paid every three months.
    </li>
  </ul>
</div>

          {/* ROC % */}
<div>
  <h3 className="font-semibold text-sm mb-2">ROC %</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Estimated percentage of distributions classified as destructive Return of Capital (ROC).
  </p>
  <p className="text-sm text-muted-foreground mb-3">
    High ROC means the fund is returning your own principal to meet payout targets, leading to NAV decay over time.
  </p>
  <p className="text-sm text-muted-foreground">
    This is an estimate based on historical NAV changes vs. cumulative payouts. Always cross-check issuer 19a-1 notices for official ROC details. Updates weekly.
  </p>
</div>

          {/* AUM */}
<div>
  <h3 className="font-semibold text-sm mb-2">AUM (Assets Under Management)</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Total assets in the fund (in USD) — larger funds are generally more liquid and established.
  </p>
  <p className="text-sm text-muted-foreground">
    Higher AUM often means better trading volume and lower risk of extreme volatility.
  </p>
</div>

          {/* Expense */}
<div>
  <h3 className="font-semibold text-sm mb-2">Expense</h3>
  <p className="text-sm text-muted-foreground mb-3">
    Annual expense ratio — the percentage of assets charged as fees each year.
  </p>
  <p className="text-sm text-muted-foreground">
    Lower expense ratios mean more of the yield stays with you, especially important for long-term income.
  </p>
</div>

          {/* Key Concepts Section */}
<div className="border-t border-border pt-6">
  <h3 className="font-semibold text-lg mb-4">Key Concepts</h3>

  <h4 className="font-bold text-sm mb-2">Destructive vs Constructive ROC</h4>
  <p className="text-sm text-muted-foreground mb-4">
    Not all Return of Capital (ROC) is harmful. Constructive ROC can occur when a fund earns excess income (e.g., from option premiums) and returns part of it tax-efficiently.
  </p>
  <p className="text-sm text-muted-foreground mb-4">
    YieldCanary flags <strong>destructive ROC</strong> — when distributions exceed earned income, forcing the fund to return principal and erode NAV over time. This reduces your actual capital rather than representing real earnings.
  </p>

  <h4 className="font-bold text-sm mb-2">Headline Yield vs. Advertised Yield vs. True Income Yield</h4>
  <ul className="text-sm text-muted-foreground space-y-3 ml-4 list-disc">
    <li>
      <span className="font-medium">Headline Yield</span>: Trailing 12-month (TTM) yield — total actual distributions paid over the past year ÷ current price. Historical and comparable.
    </li>
    <li>
      <span className="font-medium">Advertised Yield</span>: Issuer's forward-looking snapshot — most recent payout annualized (ex. last weekly payout × 52) ÷ current price. This is often higher but not guaranteed.
    </li>
    <li>
      <span className="font-medium">True Income Yield</span>: Headline Yield minus destructive ROC — shows only sustainable earned income (premiums, dividends, interest). A large gap from Headline signals erosion risk.
    </li>
  </ul>
</div>

          {/* Footer Note */}
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              All metrics update weekly, except the current market price per share of the ETF (updates every 2 minutes), based on public distribution and price data.
            </p>
          </div>

          {/* Transition Text */}
          {/* <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Have questions or feedback? Use the form below!
            </p>
          </div> */}

          {/* Contact Support Section */}
          <div className="border-t border-border pt-6 p-2 space-y-4">
            <h3 className="font-semibold text-lg">Contact Support</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="help-name">Name</Label>
                <Input
                  id="help-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="help-email">Email *</Label>
                <Input
                  id="help-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="help-message">Message *</Label>
                <Textarea
                  id="help-message"
                  placeholder="Tell us how we can help..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px]"
                  disabled={loading}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                All support tickets are responded to within 1 business day.
              </p>
            </div>
            
            {/* Buttons inside scrollable content for mobile */}
            <div className="flex flex-col sm:hidden gap-3 pt-4">
              <Button onClick={handleSubmit} disabled={loading || !message.trim() || !email.trim()} className="w-full">
                {loading ? 'Sending...' : 'Send Message'}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={loading} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* Buttons in footer for desktop */}
        <DialogFooter className="hidden sm:flex">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !message.trim() || !email.trim()}>
            {loading ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

