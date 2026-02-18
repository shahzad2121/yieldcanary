import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlurredCellProps {
  value: string;
  isUnlocked: boolean;
  onUpgradeClick: () => void;
  /** Optional class for the unlocked value span (e.g. text-muted-foreground). */
  className?: string;
}

export function BlurredCell({ value, isUnlocked, onUpgradeClick, className }: BlurredCellProps) {
  if (isUnlocked) {
    return (
      <span className={cn('font-mono text-foreground', className)}>
        {value}
      </span>
    );
  }

  return (
    <button
      onClick={onUpgradeClick}
      className="group relative flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
    >
      <span className="blur-[4px] font-mono text-muted-foreground">
        {value.replace(/[0-9.-]/g, '?')}
      </span>
      <Lock className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
