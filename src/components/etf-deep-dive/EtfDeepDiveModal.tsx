import { lazy, Suspense } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEtfDeepDive, EtfDeepDiveTabId } from "@/context/EtfDeepDiveContext";
import { EtfTickerChip } from "./EtfTickerChip";
import { CanaryStatusBadge } from "@/components/dashboard/CanaryStatusBadge";
import { Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";

const SummaryTab = lazy(() => import("./tabs/SummaryTab"));
const DividendsTab = lazy(() => import("./tabs/DividendsTab"));
const PerformanceTab = lazy(() => import("./tabs/PerformanceTab"));
const HoldingsTab = lazy(() => import("./tabs/HoldingsTab"));
const ExpensesTab = lazy(() => import("./tabs/ExpensesTab"));
const RiskTaxTab = lazy(() => import("./tabs/RiskTaxTab"));
const NewsFilingsTab = lazy(() => import("./tabs/NewsFilingsTab"));

const TABS: { id: EtfDeepDiveTabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "dividends", label: "Dividends" },
  { id: "performance", label: "Performance" },
  { id: "holdings", label: "Holdings" },
  { id: "expenses", label: "Expenses" },
  { id: "riskTax", label: "Risk & Tax" },
  { id: "newsFilings", label: "News & Filings" },
];

export function EtfDeepDiveModal() {
  const { isOpen, ticker, baseEtf, activeTab, closeDeepDive, setActiveTab } = useEtfDeepDive();
  const { error } = useEtfDeepDiveData(ticker, baseEtf);
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const handleTabClick = (tabId: EtfDeepDiveTabId) => {
    setActiveTab(tabId);
  };

  const handleCompareClick = () => {
    // Placeholder: wiring to filtered dashboard view will be added later.
    closeDeepDive();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDeepDive()}>
      <DialogContent className="custom-scrollbar flex max-h-[90vh] w-full max-w-5xl flex-col overflow-y-auto p-0 sm:h-[100vh] sm:max-h-[720px]">
        <div className="flex flex-col gap-3 border-b border-border bg-card px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {ticker && <EtfTickerChip ticker={ticker} baseEtf={baseEtf ?? undefined} />}
                {baseEtf?.name && (
                  <span className="text-sm font-medium text-foreground sm:text-base">
                    {baseEtf.name}
                  </span>
                )}
                {baseEtf?.canaryStatus && (
                  <CanaryStatusBadge status={baseEtf.canaryStatus} />
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2 text-xs sm:text-sm">
                <span className="font-mono text-lg font-semibold sm:text-xl">
                  {baseEtf ? `$${baseEtf.latestAdjClose.toFixed(2)}` : "—"}
                </span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {/* Daily % change placeholder */}
                  +0.00%
                </Badge>
                {baseEtf?.latestDate && (
                  <span className="text-[11px] text-muted-foreground">
                    As of {baseEtf.latestDate}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2">
              {ticker && (
                <Button
                  type="button"
                  variant={isInWatchlist(ticker) ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center sm:w-auto"
                  onClick={() =>
                    isInWatchlist(ticker)
                      ? removeFromWatchlist(ticker)
                      : addToWatchlist(ticker)
                  }
                >
                  <Star
                    className={[
                      "mr-1 h-3 w-3",
                      isInWatchlist(ticker) ? "fill-current" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  {isInWatchlist(ticker) ? "In Watchlist" : "Add to Watchlist"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-center sm:w-auto"
                onClick={handleCompareClick}
              >
                Compare to Similar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 sm:text-xs">
            <QuickStat label="TTM Yield" value={formatPercent(baseEtf?.headlineYieldTTM)} />
            <QuickStat label="True Income Yield" value={formatPercent(baseEtf?.trueIncomeYield)} />
            <QuickStat label="Canary Status" value={baseEtf?.canaryStatus ?? "—"} />
            <QuickStat label="Death Clock" value={baseEtf?.deathClock ?? "—"} />
            <QuickStat label="ROC %" value={formatPercent(baseEtf?.rocPercent)} />
            <QuickStat label="Payout Freq." value={baseEtf?.payoutFrequency ?? "—"} />
            <QuickStat label="AUM" value={formatCurrency(baseEtf?.aum)} />
            <QuickStat
              label="Expense Ratio"
              value={baseEtf ? `${baseEtf.expenseRatio.toFixed(2)}%` : "—"}
            />
          </div>
        </div>

        {error && (
          <div className="border-b border-border bg-destructive/5 px-4 py-2 text-[11px] text-destructive sm:px-6 sm:text-xs">
            Failed to load deep-dive data: {error}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-2 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={[
                "whitespace-nowrap rounded-full px-3 py-1 transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar md:min-h-0 min-h-[500px] flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-6 sm:pt-4">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading details…
              </div>
            }
          >
            {activeTab === "summary" && <SummaryTab />}
            {activeTab === "dividends" && <DividendsTab />}
            {activeTab === "performance" && <PerformanceTab />}
            {activeTab === "holdings" && <HoldingsTab />}
            {activeTab === "expenses" && <ExpensesTab />}
            {activeTab === "riskTax" && <RiskTaxTab />}
            {activeTab === "newsFilings" && <NewsFilingsTab />}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface QuickStatProps {
  label: string;
  value: string;
}

function QuickStat({ label, value }: QuickStatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(2)}`;
}

export function EtfDeepDiveSectionSeparator() {
  return <Separator className="my-4" />;
}

