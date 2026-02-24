import { useState, useEffect } from 'react';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export function SettingsModal({ isOpen, onClose, userEmail }: SettingsModalProps) {
  const [taxRate, setTaxRate] = useState('20');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [taxRateError, setTaxRateError] = useState('');
  const { toast } = useToast();
  // Use the tax rate hook to get refetch
  const { refetch } = useUserTaxRate();

  // Fetch current tax rate when modal opens
  useEffect(() => {
    if (isOpen && userEmail) {
      fetchTaxRate();
    }
  }, [isOpen, userEmail]);

  const fetchTaxRate = async () => {
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('tax_rate')
        .eq('email', userEmail)
        .single();

      if (error) {
        console.error('Error fetching tax rate:', error);
      } else if (data && typeof data.tax_rate === 'number') {
        setTaxRate(data.tax_rate.toString());
      } else {
        // Fallback to default 20% if no stored value
        setTaxRate('20');
      }
    } catch (err) {
      console.error('Failed to fetch tax rate:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let finalTaxRate = 20;
      const trimmedTax = taxRate.trim();
      if (trimmedTax !== '') {
        const parsed = Number(trimmedTax);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          setTaxRateError('Tax rate must be between 0 and 100');
          return;
        }
        finalTaxRate = parsed;
      } else {
        // Empty input means "use default 20%"
        setTaxRate('20');
      }
      setTaxRateError('');

      const { error } = await supabase
        .from('users')
        .update({ tax_rate: finalTaxRate })
        .eq('email', userEmail);

      if (error) {
        throw error;
      }

      // Normalize the displayed value to the saved value
      setTaxRate(finalTaxRate.toString());

      // Refetch the tax rate after saving
      if (refetch) await refetch();

      toast({
        title: 'Settings saved',
        description: 'Your tax rate has been updated.',
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            Adjust your tax rate. Changes are saved when you click save.
          </DialogDescription>
        </DialogHeader>
        {initialLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading settings...
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                placeholder="20"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
              {taxRateError && (
                <p className="text-xs text-destructive">{taxRateError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Your marginal tax rate for calculating after-tax yields. This helps you see true net returns on dividend income.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || initialLoading}>
            {loading ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
