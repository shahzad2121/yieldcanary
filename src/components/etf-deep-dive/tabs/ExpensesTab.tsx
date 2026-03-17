import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { supabase } from "@/integrations/supabase/client";

const SPY_EXPENSE_RATIO = 0.09; // Approximate SPY total expense ratio in percent

interface ExpenseStats {
  medianExpenseRatio: number | null;
}

export default function ExpensesTab() {
  const { baseEtf } = useEtfDeepDive();

  const { data: stats } = useQuery<ExpenseStats>({
    queryKey: ["etf-expense-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etfs")
        .select("expense_ratio")
        .not("expense_ratio", "is", null);

      if (error) {
        throw error;
      }

      const ratios = (data ?? [])
        .map((row: any) => row.expense_ratio as number | null)
        .filter((v): v is number => typeof v === "number");

      if (ratios.length === 0) {
        return { medianExpenseRatio: null };
      }

      const sorted = [...ratios].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      return { medianExpenseRatio: median };
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    cacheTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    refetchOnWindowFocus: false,
  });

  const expenseRatio = baseEtf?.expenseRatio ?? null;

  const costPer10k = useMemo(() => {
    if (expenseRatio == null) return null;
    return (expenseRatio / 100) * 10_000;
  }, [expenseRatio]);

  const spyComparison = useMemo(() => {
    if (expenseRatio == null) return null;
    if (SPY_EXPENSE_RATIO <= 0) return null;
    return expenseRatio / SPY_EXPENSE_RATIO;
  }, [expenseRatio]);

  const medianComparison = useMemo(() => {
    if (expenseRatio == null || !stats?.medianExpenseRatio) return null;
    const median = stats.medianExpenseRatio;
    if (median <= 0) return null;
    return {
      median,
      ratio: expenseRatio / median,
    };
  }, [expenseRatio, stats]);

  const formatPercent = (value: number | null | undefined) => {
    if (value == null) return "—";
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fund Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Expense Ratio (Total)
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatPercent(expenseRatio)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Approx. cost on $10,000
              </span>
              <span className="text-sm font-medium text-foreground">
                {costPer10k != null ? `$${costPer10k.toFixed(0)}/year` : "—"}
              </span>
            </div>
          </div>

          <p className="text-muted-foreground">
            The expense ratio is the fund&apos;s annual operating cost as a
            percentage of assets. It includes management and operating expenses
            but does not include trading costs or taxes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How This Compares</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Versus Market ETF (SPY)
              </span>
              <span className="text-xs text-foreground">
                This ETF:{" "}
                <span className="font-medium">
                  {formatPercent(expenseRatio)}
                </span>{" "}
                vs SPY:{" "}
                <span className="font-medium">
                  {formatPercent(SPY_EXPENSE_RATIO)}
                </span>
              </span>
              {spyComparison != null && (
                <span className="text-[11px] text-muted-foreground">
                  Roughly {spyComparison.toFixed(1)}× the cost of a low-cost
                  market ETF.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Versus YC Income Universe
              </span>
              {medianComparison ? (
                <>
                  <span className="text-xs text-foreground">
                    Median expense ratio of tracked income ETFs:{" "}
                    <span className="font-medium">
                      {formatPercent(medianComparison.median)}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    This fund is{" "}
                    {medianComparison.ratio > 1.1
                      ? "above"
                      : medianComparison.ratio < 0.9
                        ? "below"
                        : "roughly in line with"}{" "}
                    the median fee level.
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Median fee data will appear here when available.
                </span>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            High-yield option income ETFs often have higher fees than plain
            index funds. What matters is whether the fund&apos;s sustainable
            income (True Income Yield) justifies the extra cost after ROC and
            taxes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

