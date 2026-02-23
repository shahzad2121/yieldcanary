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
  onSuccess: () => void;
}

export function CancelSubscriptionModal({ isOpen, onClose, onSuccess }: CancelSubscriptionModalProps) {
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
      const err = await cancelSubscriptionWithReason({
        cancel_reason: reason as CancelReasonValue,
        cancel_reason_other: reason === 'other' ? reasonOther.trim() : undefined,
      });
      if (err) {
        setError(err);
        return;
      }
      toast({
        title: 'Subscription cancelled',
        description: 'Your account is now on the free plan.',
      });
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
          <DialogTitle>Cancel subscription</DialogTitle>
          <DialogDescription>
            Your subscription will be cancelled immediately. Please tell us why you&apos;re leaving so we can improve.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            {loading ? 'Cancelling...' : 'Cancel subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
