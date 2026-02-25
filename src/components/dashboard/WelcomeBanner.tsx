import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

type WelcomeBannerProps = {
  onGoToHelp: () => void;
  onDismiss: () => void;
};

export function WelcomeBanner({ onGoToHelp, onDismiss }: WelcomeBannerProps) {
  return (
    <div
      role="banner"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4 bg-primary/5 border-b border-border px-3 py-3 sm:px-4 sm:py-3 text-sm"
    >
      <p className="text-foreground flex-1 min-w-0">
        Welcome to YieldCanary! The metrics can feel new at first – check out the Help Center for quick explanations.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onGoToHelp}
          className="whitespace-nowrap"
        >
          Go to Help Center
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
