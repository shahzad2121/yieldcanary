import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";
import { useUserTaxRate } from "@/hooks/useUserTaxRate";
import {
  calcTakeHomeReturn1Y,
  calcTakeHomeCashReturn1Y,
} from "@/lib/utils";

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}

export default function RiskTaxTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { volatility1y } = useEtfDeepDiveData(ticker, baseEtf);
  const { taxRate } = useUserTaxRate();

  const effectiveTaxRate = taxRate ?? null;
  const dividendsLast12Mo = baseEtf?.dividendsLast12Mo ?? 0;
  const afterTaxDividends =
    effectiveTaxRate != null && baseEtf
      ? dividendsLast12Mo * (1 - effectiveTaxRate / 100)
      : null;
  const afterTaxYield =
    afterTaxDividends != null &&
    baseEtf?.latestAdjClose &&
    baseEtf.latestAdjClose > 0
      ? (afterTaxDividends / baseEtf.latestAdjClose) * 100
      : null;

  const takeHomeReturn1Y =
    baseEtf && effectiveTaxRate != null
      ? calcTakeHomeReturn1Y({
          latest_adj_close: baseEtf.latestAdjClose,
          price_1y_ago: baseEtf.price1YAgo ?? undefined,
          dividends_last_12mo: baseEtf.dividendsLast12Mo ?? undefined,
          taxRate: effectiveTaxRate,
        })
      : null;

  const takeHomeCashReturn1Y =
    baseEtf && effectiveTaxRate != null
      ? calcTakeHomeCashReturn1Y({
          latest_adj_close: baseEtf.latestAdjClose,
          price_1y_ago: baseEtf.price1YAgo ?? undefined,
          dividends_last_12mo: baseEtf.dividendsLast12Mo ?? undefined,
          taxRate: effectiveTaxRate,
        })
      : null;

  const rocPercent = baseEtf?.rocPercent ?? null;
  const canaryStatus = baseEtf?.canaryStatus;
  const riskWarning =
    rocPercent != null && rocPercent >= 20
      ? `High ROC (${rocPercent.toFixed(0)}%): a significant portion of payouts may be eroding NAV.`
      : canaryStatus === "Healthy"
        ? "Healthy Canary: low erosion risk; payouts appear mostly sustainable."
        : canaryStatus === "Dying"
          ? "Moderate erosion risk; part of the yield may be return of capital."
          : canaryStatus === "Dead"
            ? "High erosion risk; much of the yield is likely returning principal."
            : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Risk Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Canary Status
              </span>
              <span className="text-xs font-medium text-foreground">
                {baseEtf?.canaryStatus ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Death Clock
              </span>
              <span className="text-xs text-foreground">
                {baseEtf?.deathClock ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                ROC %
              </span>
              <span className="text-xs text-foreground">
                {formatPercent(baseEtf?.rocPercent)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                True Income Yield
              </span>
              <span className="text-xs text-foreground">
                {formatPercent(baseEtf?.trueIncomeYield)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Volatility (1Y)
              </span>
              <span className="text-xs text-foreground">
                {volatility1y != null
                  ? `${(volatility1y * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Beta
              </span>
              <span className="text-xs text-foreground">
                {baseEtf?.beta != null ? baseEtf.beta.toFixed(2) : "—"}
              </span>
            </div>
          </div>
          {riskWarning && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {riskWarning}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tax Considerations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {effectiveTaxRate != null ? (
            <>
              <p className="text-xs text-muted-foreground">
                Using your tax rate: <strong className="text-foreground">{effectiveTaxRate}%</strong> (edit in Settings).
              </p>
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Dividends last 12 mo (after tax)
                  </span>
                  <span className="text-xs text-foreground">
                    {afterTaxDividends != null
                      ? `$${afterTaxDividends.toFixed(2)}`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    After-tax yield (1Y)
                  </span>
                  <span className="text-xs text-foreground">
                    {afterTaxYield != null
                      ? `${afterTaxYield.toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Take-home return (1Y)
                  </span>
                  <span className="text-xs text-foreground">
                    {takeHomeReturn1Y != null
                      ? formatPercent(takeHomeReturn1Y)
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Take-home cash return (1Y)
                  </span>
                  <span className="text-xs text-foreground">
                    {takeHomeCashReturn1Y != null
                      ? formatPercent(takeHomeCashReturn1Y)
                      : "—"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                After-tax figures use your marginal tax rate on distributions. Take-home return includes price change and after-tax dividends. This is an estimate; consult a tax advisor for personal advice.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set your tax rate in Settings to see personalized after-tax income and take-home return estimates.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
