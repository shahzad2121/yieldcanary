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
  const [taxRate, setTaxRate] = useState('0');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
      } else if (data) {
        setTaxRate(data.tax_rate?.toString() || '0');
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
      const { error } = await supabase
        .from('users')
        .update({ tax_rate: parseFloat(taxRate) || 0 })
        .eq('email', userEmail);

      if (error) {
        throw error;
      }

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
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Adjust your account settings. Changes are saved when you click save.
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
                placeholder="0"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
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
