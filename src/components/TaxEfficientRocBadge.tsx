import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TOOLTIP_TEXT =
  'This fund uses high ROC primarily for tax efficiency. NAV and distributions have been relatively stable.';

interface TaxEfficientRocBadgeProps {
  showTooltip?: boolean;
}

export function TaxEfficientRocBadge({ showTooltip = true }: TaxEfficientRocBadgeProps) {
  const badge = (
    <Badge
      variant="outline"
      className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] px-2 py-0.5"
    >
      Tax-Efficient ROC
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {TOOLTIP_TEXT}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
