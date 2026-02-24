import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  cancelSubscriptionWithReason,
  CANCEL_REASON_LABELS,
  type CancelReasonValue,
} from '@/integrations/stripe/checkout';
import { useToast } from '@/hooks/use-toast';

export interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTrialing?: boolean;
  onSuccess: () => void;
}

export function CancelSubscriptionModal({ isOpen, onClose, isTrialing = false, onSuccess }: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState<CancelReasonValue | ''>('');
  const [reasonOther, setReasonOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async () => {
    setError('');
    if (!reason) {
      setError('Please select a reason.');
      return;
    }
    if (reason === 'other' && !reasonOther.trim()) {
      setError('Please provide details for "Other".');
      return;
    }
    setLoading(true);
    try {
      const result = await cancelSubscriptionWithReason({
        cancel_reason: reason as CancelReasonValue,
        cancel_reason_other: reason === 'other' ? reasonOther.trim() : undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.cancels_at) {
        const dateStr = new Date(result.cancels_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        toast({
          title: 'Cancellation scheduled',
          description: `Your subscription will end on ${dateStr}. You'll keep access until then.`,
        });
      } else {
        toast({
          title: 'Subscription cancelled',
          description: 'Your account is now on the free plan.',
        });
      }
      onSuccess();
      onClose();
      setReason('');
      setReasonOther('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setReason('');
      setReasonOther('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isTrialing ? 'Cancel Trial' : 'Cancel subscription'}</DialogTitle>
          <DialogDescription>
            {isTrialing
              ? "Your trial will end immediately and you won't be charged. Please tell us why you're leaving so we can improve."
              : "Your subscription will continue until the end of your current billing period, then cancel. Please tell us why you're leaving so we can improve."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 pb-4">
          <div className="grid gap-3">
            <Label>Why are you leaving?</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as CancelReasonValue | '')}
              className="grid gap-2"
            >
              {(Object.entries(CANCEL_REASON_LABELS) as [CancelReasonValue, string][]).map(([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`reason-${value}`} />
                  <Label htmlFor={`reason-${value}`} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {reason === 'other' && (
            <div className="grid gap-2">
              <Label htmlFor="reason-other">Please specify (required)</Label>
              <Input
                id="reason-other"
                placeholder="Tell us more..."
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                className="text-sm"
                disabled={loading}
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Keep subscription
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading || !reason || (reason === 'other' && !reasonOther.trim())}>
            {loading ? 'Cancelling...' : isTrialing ? 'Cancel Trial' : 'Cancel subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
