import { Button } from "@/components/ui/button";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import type { ETF } from "@/types/etf";

interface EtfTickerChipProps {
  ticker: string;
  baseEtf?: ETF;
  className?: string;
}

export function EtfTickerChip({ ticker, baseEtf, className }: EtfTickerChipProps) {
  const { openDeepDive } = useEtfDeepDive();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={["h-7 px-2 rounded-full font-mono text-xs leading-none", className]
        .filter(Boolean)
        .join(" ")}
      onClick={() => openDeepDive({ ticker, baseEtf })}
    >
      {ticker}
    </Button>
  );
}

