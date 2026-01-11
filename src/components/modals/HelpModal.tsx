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
        description: 'Thank you for contacting us! We\'ll get back to you soon.',
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
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
              Welcome! YieldCanary tracks over 400 high-yield ETFs to help you separate sustainable income from funds that quietly erode principal through destructive Return of Capital (ROC). Below is a detailed breakdown of each column in the main dashboard.
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
            <p className="text-sm text-muted-foreground mb-2">
              A quick health rating of the ETF based on recent destructive ROC trends:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li><span className="font-medium text-green-600 dark:text-green-400">Healthy (green)</span>: Low or no destructive ROC — distributions are mostly real earned income.</li>
              <li><span className="font-medium text-yellow-600 dark:text-yellow-400">Dying (yellow)</span>: Moderate ROC — some principal erosion occurring.</li>
              <li><span className="font-medium text-red-600 dark:text-red-400">Dead (red)</span>: Severe ROC — fast principal erosion; headline yield heavily reliant on returning capital.</li>
            </ul>
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
              <li>This is a trend-based estimate, not a guarantee — changes weekly with new data.</li>
            </ul>
          </div>

          {/* True Income Yield */}
          <div>
            <h3 className="font-semibold text-sm mb-2">True Income Yield</h3>
            <p className="text-sm text-muted-foreground mb-2">
              The real sustainable yield after removing destructive Return of Capital from distributions.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Funds often advertise high yields (total payouts ÷ price), but much can be ROC (your own money returned).</li>
              <li>True Income Yield shows only the portion that's actual earned income (option premiums, dividends, interest).</li>
              <li>A large gap below headline yield signals potential erosion.</li>
            </ul>
          </div>

          {/* Total Return 1Y */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Total Return 1Y</h3>
            <p className="text-sm text-muted-foreground">
              Simple price appreciation over the last 12 months (excludes distributions).
            </p>
          </div>

          {/* Take-Home Cash Return */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Take-Home Cash Return</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Estimated cash you'll actually keep from distributions over the last year, after taxes.
            </p>
            <p className="text-sm text-muted-foreground">
              Uses your personal tax rate from account settings (default 20% for new users) applied to the qualified income portion of payouts. This gives a realistic "what lands in your pocket" view for income planning.
            </p>
          </div>

          {/* Price */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Price</h3>
            <p className="text-sm text-muted-foreground">
              Current market price per share.
            </p>
          </div>

          {/* Headline Yield */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Headline Yield</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Trailing 12-month total distributions ÷ current price — the number most funds advertise.
            </p>
            <p className="text-sm text-muted-foreground">
              Often inflated by ROC — compare to True Income Yield for the real picture.
            </p>
          </div>

          {/* Payout Frequency */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Payout Frequency</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Indicates how often the ETF typically pays out distributions to shareholders.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li><span className="font-medium">Weekly</span>: Paid every week (common in newer high-yield option-income ETFs like many YieldMax and Roundhill funds).</li>
              <li><span className="font-medium">Monthly</span>: Paid once per month (most traditional dividend and covered-call ETFs).</li>
              <li><span className="font-medium">Quarterly</span>: Paid every three months.</li>
            </ul>
          </div>

          {/* ROC %} */}
          <div>
            <h3 className="font-semibold text-sm mb-2">ROC %</h3>
            <p className="text-sm text-muted-foreground">
              Estimated percentage of recent distributions classified as destructive Return of Capital. High sustained ROC usually means the fund is returning principal to meet yield targets, leading to NAV decay over time.
            </p>
          </div>

          {/* AUM */}
          <div>
            <h3 className="font-semibold text-sm mb-2">AUM (Assets Under Management)</h3>
            <p className="text-sm text-muted-foreground">
              Total size of the fund in USD — larger funds tend to be more established.
            </p>
          </div>

          {/* Expense */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Expense</h3>
            <p className="text-sm text-muted-foreground">
              Annual expense ratio — fees as a percentage of assets.
            </p>
          </div>

          {/* Key Concept */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-2">Key Concept: Destructive vs Constructive ROC</h3>
            <p className="text-sm text-muted-foreground">
              Not all ROC is bad. Some funds use it tax-efficiently when they earn excess income. YieldCanary flags destructive ROC — when distributions exceed earned income, forcing the fund to return principal and erode NAV.
            </p>
          </div>

          {/* Footer Note */}
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              All metrics update weekly based on public distribution and price data.
            </p>
          </div>

          {/* Transition Text */}
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Have questions or feedback? Use the form below!
            </p>
          </div>

          {/* Contact Support Section */}
          <div className="border-t border-border pt-6 p-2 space-y-4">
            <h3 className="font-semibold text-sm">Contact Support</h3>
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
            </div>
          </div>
        </div>

        <DialogFooter>
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

