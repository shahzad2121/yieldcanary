import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtfDeepDiveSectionSeparator } from "../EtfDeepDiveModal";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";
import { ChartContainer } from "@/components/ui/chart";
import { useUserTaxRate } from "@/hooks/useUserTaxRate";
import { getChartColors } from "@/lib/chartColors";
import { formatMMDDYYYY } from "@/lib/formatDeepDiveDate";
import {
  dividendComboTooltipFormatter,
  getDividendComboChartLayout,
} from "@/lib/echartsDividendLayout";
import ReactECharts from "echarts-for-react";

export default function DividendsTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { dividendBuckets, dividendAnalytics, dividendEvents } = useEtfDeepDiveData(
    ticker,
    baseEtf,
  );
  const { taxRate } = useUserTaxRate();


  const last12Dividends = dividendEvents.slice(-12);
  const totalDividendsLastYear = last12Dividends.reduce((sum, d) => sum + d.amount, 0);
  const effectiveTaxRate = taxRate ?? null;
  const afterTaxDividends =
    effectiveTaxRate != null ? totalDividendsLastYear * (1 - effectiveTaxRate / 100) : null;
  const takeHomeYield =
    afterTaxDividends != null && baseEtf && baseEtf.latestAdjClose
      ? (afterTaxDividends / baseEtf.latestAdjClose) * 100
      : null;

  const dividendChartOption = useMemo(() => {
    if (!dividendBuckets.length) return {};
    const c = getChartColors();
    const categories = dividendBuckets.map((b) => b.label);
    const layout = getDividendComboChartLayout();
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: dividendComboTooltipFormatter,
      },
      ...layout,
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          fontSize: 10,
          hideOverlap: true,
          formatter: (v: string) => formatMMDDYYYY(v),
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Amount",
          axisLabel: {
            fontSize: 10,
            formatter: (value: number) => value.toFixed(2),
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(128,128,128,0.15)",
              type: "dashed",
            },
          },
        },
        {
          type: "value",
          name: "Cumulative Yield",
          axisLabel: {
            fontSize: 10,
            formatter: (value: number) => `${value.toFixed(1)}%`,
          },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 20,
          bottom: 6,
          borderColor: "transparent",
          fillerColor: "transparent",
          showDataShadow: false,
          dataBackground: {
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
          },
          handleStyle: {
            color: "rgba(160,160,160,0.6)",
            borderColor: "rgba(140,140,140,0.4)",
          },
          moveHandleStyle: { color: "rgba(150,150,150,0.45)" },
          emphasis: {
            handleStyle: { color: "rgba(180,180,180,0.8)" },
            moveHandleStyle: { color: "rgba(170,170,170,0.6)" },
          },
        },
      ],
      series: [
        {
          name: "True Income",
          type: "bar",
          stack: "dividends",
          yAxisIndex: 0,
          data: dividendBuckets.map((b) => b.trueIncomePortion),
          itemStyle: { color: c.chart3 },
        },
        {
          name: "ROC",
          type: "bar",
          stack: "dividends",
          yAxisIndex: 0,
          data: dividendBuckets.map((b) => b.rocPortion),
          itemStyle: { color: c.chart4 },
        },
        {
          name: "Cumulative Yield",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: dividendBuckets.map((b) => b.cumulativeYield),
          lineStyle: { color: c.chart5, width: 2 },
        },
      ],
    };
  }, [dividendBuckets]);

  return (
    <div className="space-y-4">
      <Card className="h-64">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dividend History</CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="h-52">
            <ChartContainer
              id="etf-dividend-history-chart"
              className="h-full w-full"
              config={{
                trueIncome: { label: "True Income", color: getChartColors().chart3 },
                roc: { label: "ROC", color: getChartColors().chart4 },
                cumulativeYield: { label: "Cumulative Yield", color: getChartColors().chart5 },
              }}
            >
              <ReactECharts
                option={dividendChartOption}
                style={{ height: "100%", width: "100%" }}
              />
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dividend Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <AnalyticsItem
              label="MoM Payout Change"
              value={formatChange(dividendAnalytics.monthOverMonthChangePct)}
              isDecrease={isNegative(dividendAnalytics.monthOverMonthChangePct)}
            />
            <AnalyticsItem
              label="YoY Payout Change"
              value={formatChange(dividendAnalytics.yearOverYearChangePct)}
              isDecrease={isNegative(dividendAnalytics.yearOverYearChangePct)}
            />
            <AnalyticsItem
              label="After-Tax Take-Home Yield"
              value={
                effectiveTaxRate != null && takeHomeYield != null
                  ? `${takeHomeYield.toFixed(2)}%`
                  : "Set your tax rate in settings to see personalized estimates."
              }
              isDecrease={false}
            />
          </div>
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dividend Events</CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 overflow-auto">
          <div className="min-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-[11px] sm:text-xs">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left">
                  <th className="px-2 py-1 font-medium">Declaration</th>
                  <th className="px-2 py-1 font-medium">Ex-Dividend</th>
                  <th className="px-2 py-1 font-medium">Record</th>
                  <th className="px-2 py-1 font-medium">Payment</th>
                  <th className="px-2 py-1 font-medium text-right">Cash Amount</th>
                  <th className="px-2 py-1 font-medium text-right">ROC %</th>
                  {/* <th className="px-2 py-1 font-medium text-right">Qualified %</th> */}
                </tr>
              </thead>
              <tbody>
                {[...dividendEvents].reverse().map((d, idx) => (
                  <tr key={`${d.exDate ?? d.paymentDate ?? d.declarationDate ?? "row"}-${idx}`} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1">{formatMMDDYYYY(d.declarationDate)}</td>
                    <td className="px-2 py-1">{formatMMDDYYYY(d.exDate)}</td>
                    <td className="px-2 py-1">{formatMMDDYYYY(d.recordDate)}</td>
                    <td className="px-2 py-1">{formatMMDDYYYY(d.paymentDate)}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {d.amount.toFixed(4)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {baseEtf ? `${baseEtf.rocPercent.toFixed(2)}%` : "—"}
                    </td>
                    {/* <td className="px-2 py-1 text-right font-mono">—</td> */}
                  </tr>
                ))}
                {dividendEvents.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-3 text-center text-muted-foreground"
                      colSpan={7}
                    >
                      No dividend history available yet for this ETF.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AnalyticsItemProps {
  label: string;
  value: string;
  isDecrease: boolean;
}

function AnalyticsItem({ label, value, isDecrease }: AnalyticsItemProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={[
          "text-xs",
          isDecrease ? "text-destructive font-semibold" : "text-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function formatChange(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function isNegative(value: number | null): boolean {
  if (value == null || Number.isNaN(value)) return false;
  return value < 0;
}


