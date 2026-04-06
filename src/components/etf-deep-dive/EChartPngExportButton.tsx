import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { EChartsType } from "echarts";
/**
 * Import ReactECharts as a TYPE only — it is used solely for the ref shape
 * (InstanceType<typeof ReactECharts>). Using `import type` prevents bundlers
 * from including the full echarts-for-react runtime in this module's chunk;
 * the actual runtime import lives in the lazy-loaded tab components.
 */
import type ReactECharts from "echarts-for-react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { downloadEChartAsPNG } from "@/lib/downloadEChartAsPNG";
import { cn } from "@/lib/utils";

export type EChartsReactRef = RefObject<InstanceType<typeof ReactECharts> | null>;

interface EChartPngExportButtonProps {
  chartRef: EChartsReactRef;
  /** Without .png — helper adds it if missing */
  filename: string;
  className?: string;
}

const EXPORT_COOLDOWN_MS = 700;

export function EChartPngExportButton({
  chartRef,
  filename,
  className,
}: EChartPngExportButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(() => {
    if (busy) return;
    let inst: EChartsType | undefined;
    try {
      inst = chartRef.current?.getEchartsInstance();
    } catch {
      return;
    }
    if (!inst) return;

    setBusy(true);
    try {
      downloadEChartAsPNG(inst, filename);
      toast({ title: "Downloaded" });
    } finally {
      window.setTimeout(() => setBusy(false), EXPORT_COOLDOWN_MS);
    }
  }, [busy, chartRef, filename, toast]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground",
              className,
            )}
            disabled={busy}
            aria-label="Download chart as PNG"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Download PNG
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
