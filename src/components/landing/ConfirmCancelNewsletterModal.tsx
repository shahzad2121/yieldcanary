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
import { cancelNewsletterSubscription } from '@/integrations/stripe/checkout';
import { useToast } from '@/hooks/use-toast';

export interface ConfirmCancelNewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmCancelNewsletterModal({
  isOpen,
  onClose,
  onSuccess,
}: ConfirmCancelNewsletterModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await cancelNewsletterSubscription();

      if (result.error) {
        setError(result.error);
        return;
      }

      toast({
        title: 'Newsletter cancelled',
        description:
          "Your newsletter subscription has been cancelled immediately. You won't receive further weekly emails.",
      });

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel newsletter now?</DialogTitle>
          <DialogDescription>
            This will cancel your newsletter subscription immediately. You will stop receiving the
            YieldCanary Weekly Newsletter.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Keep subscription
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Cancelling...' : 'Yes, cancel now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

