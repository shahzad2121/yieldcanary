import { useMemo, useRef } from "react";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EtfDeepDiveSectionSeparator } from "../EtfDeepDiveModal";
import { useEtfDeepDiveData, Timeframe } from "@/hooks/useEtfDeepDiveData";
import {
  ChartContainer,
} from "@/components/ui/chart";
import { useUserTaxRate } from "@/hooks/useUserTaxRate";
import { getChartColors } from "@/lib/chartColors";
import { formatMMDDYYYY } from "@/lib/formatDeepDiveDate";
import {
  dividendComboTooltipFormatter,
  getDividendComboChartLayout,
  priceVolumeTooltipFormatter,
} from "@/lib/echartsDividendLayout";
import ReactECharts from "echarts-for-react";
import { EChartPngExportButton } from "../EChartPngExportButton";

export default function SummaryTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const priceChartRef = useRef<InstanceType<typeof ReactECharts>>(null);
  const dividendSummaryChartRef = useRef<InstanceType<typeof ReactECharts>>(null);
  const {
    timeframe,
    setTimeframe,
    priceSeries,
    priceSeriesFiltered,
    dividendEvents,
    dividendBuckets,
    avgDailyVolume,
    secYield30d,
    volatility1y,
  } = useEtfDeepDiveData(ticker, baseEtf);
  const { taxRate } = useUserTaxRate();

  const dividendMarkers = useMemo(() => {
    if (!priceSeriesFiltered.length || !dividendEvents.length) return [];

    const datesWithDividends = new Set<string>();
    for (const d of dividendEvents) {
      const key = d.paymentDate ?? d.exDate ?? d.declarationDate;
      if (!key) continue;
      datesWithDividends.add(key.split("T")[0]);
    }

    return priceSeriesFiltered.filter((p) =>
      datesWithDividends.has(p.date.split("T")[0]),
    );
  }, [priceSeriesFiltered, dividendEvents]);

  const priceChartOption = useMemo(() => {
    if (!priceSeriesFiltered.length) return {};
    const c = getChartColors();

    const categories = priceSeriesFiltered.map((p) =>
      p.date.includes("T") ? p.date.split("T")[0] : p.date,
    );

    const volumeData = priceSeriesFiltered.map((p) => p.volume ?? 0);
    const priceData = priceSeriesFiltered.map((p) => p.close ?? null);

    const datesWithDividends = new Set(
      dividendMarkers.map((p) =>
        p.date.includes("T") ? p.date.split("T")[0] : p.date,
      ),
    );

    const dividendScatter = priceSeriesFiltered
      .filter((p) => {
        const d = p.date.includes("T") ? p.date.split("T")[0] : p.date;
        return datesWithDividends.has(d);
      })
      .map((p) => [
        p.date.includes("T") ? p.date.split("T")[0] : p.date,
        p.close,
      ]);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: priceVolumeTooltipFormatter,
      },
      grid: { left: 40, right: 40, top: 20, bottom: 60 },
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
          name: "Price",
          axisLabel: {
            fontSize: 10,
            formatter: (value: number) => `$${value}`,
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
          name: "Volume",
          axisLabel: {
            fontSize: 10,
            formatter: (value: number) => `${value / 1_000_000}M`,
          },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
        },
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
          name: "Volume",
          type: "bar",
          yAxisIndex: 1,
          data: volumeData,
          itemStyle: {
            color: c.chart2,
            opacity: 0.45,
          },
        },
        {
          name: "Price",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: priceData,
          lineStyle: {
            color: c.chart1,
            width: 1.8,
          },
        },
        {
          name: "Dividend",
          type: "scatter",
          yAxisIndex: 0,
          data: dividendScatter,
          symbol: "circle",
          symbolSize: 4,
          itemStyle: {
            color: c.chart3,
          },
        },
      ],
    };
  }, [priceSeriesFiltered, dividendMarkers]);

  const dividendSummaryOption = useMemo(() => {
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
      <Card className="h-[260px]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            <CardTitle className="text-sm">Price & Volume</CardTitle>
            {ticker ? (
              <EChartPngExportButton
                chartRef={priceChartRef}
                filename={`${ticker}-price-chart`}
                className="shrink-0"
              />
            ) : null}
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </CardHeader>
        <CardContent className="h-full">
          <div className="h-52">
            <ChartContainer
              id="etf-price-chart"
              className="h-full w-full"
              config={{
                price: { label: "Price", color: getChartColors().chart1 },
                volume: { label: "Volume", color: getChartColors().chart2 },
                dividend: { label: "Dividend", color: getChartColors().chart3 },
              }}
            >
              <ReactECharts
                ref={priceChartRef}
                option={priceChartOption}
                style={{ height: "100%", width: "100%" }}
              />
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="h-[260px]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-1">
            <CardTitle className="text-sm">Dividend History</CardTitle>
            {ticker ? (
              <EChartPngExportButton
                chartRef={dividendSummaryChartRef}
                filename={`${ticker}-dividend-summary`}
                className="shrink-0"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="h-full">
          <div className="h-52">
            <ChartContainer
              id="etf-dividend-summary-chart"
              className="h-full w-full"
              config={{
                trueIncome: { label: "True Income", color: getChartColors().chart3 },
                roc: { label: "ROC", color: getChartColors().chart4 },
                cumulativeYield: { label: "Cumulative Yield", color: getChartColors().chart5 },
              }}
            >
              <ReactECharts
                ref={dividendSummaryChartRef}
                option={dividendSummaryOption}
                style={{ height: "100%", width: "100%" }}
              />
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Key Facts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
            <FactItem
              label="Inception Date"
              value={baseEtf?.inceptionDate ? formatMMDDYYYY(baseEtf.inceptionDate) : "—"}
            />
            <FactItem label="Issuer" value={baseEtf?.issuer ?? "—"} />
            <FactItem label="AUM" value={baseEtf?.aum != null ? formatAum(baseEtf.aum) : "—"} />
            <FactItem label="Expense Ratio" value={baseEtf ? `${baseEtf.expenseRatio.toFixed(2)}%` : "—"} />
            <FactItem
              label="Avg Daily Volume (30 Days)"
              value={avgDailyVolume != null ? formatVolume(avgDailyVolume) : "—"}
            />
            <FactItem
              label="SEC Yield (30d)"
              value={secYield30d != null ? `${(secYield30d).toFixed(2)}%` : "—"}
            />
            <FactItem
              label="Beta"
              value={baseEtf?.beta != null ? baseEtf.beta.toFixed(2) : "—"}
            />
            <FactItem
              label="Volatility (1Y)"
              value={volatility1y != null ? `${(volatility1y * 100).toFixed(2)}%` : "—"}
            />
          </div>
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Strategy & Objective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {baseEtf?.description?.trim() ? baseEtf.description : "No description available."}
          </p>
          {baseEtf?.website?.trim() ? (
            <a
              href={baseEtf.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:no-underline"
            >
              Visit fund website
            </a>
          ) : null}
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">YC Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="leading-relaxed text-muted-foreground">
            {baseEtf?.canaryStatus === "Healthy" && (
              <>
                This fund is currently{" "}
                <span className="font-medium text-primary">Healthy</span> with a
                low erosion profile. True Income Yield of{" "}
                <span className="font-mono">
                  {formatPercentShort(baseEtf.trueIncomeYield)}
                </span>{" "}
                suggests most payouts are sustainable income.
              </>
            )}
            {baseEtf?.canaryStatus === "Watch" && (
              <>
                This fund is on{" "}
                <span className="font-medium text-amber-500">Watch</span>. With
                ROC at{" "}
                <span className="font-mono">
                  {formatPercentShort(baseEtf.rocPercent)}
                </span>{" "}
                and True Income Yield of{" "}
                <span className="font-mono">
                  {formatPercentShort(baseEtf.trueIncomeYield)}
                </span>
                , part of the headline yield may be eroding NAV. Monitor the
                NAV trend closely.
              </>
            )}
            {baseEtf?.canaryStatus === "High Risk" && (
              <>
                This fund is flagged{" "}
                <span className="font-medium text-orange-500">High Risk</span>.
                ROC of{" "}
                <span className="font-mono">
                  {formatPercentShort(baseEtf.rocPercent)}
                </span>{" "}
                suggests a significant share of payouts may be returning
                principal rather than real income. Proceed with caution.
              </>
            )}
            {baseEtf?.canaryStatus === "Severe Risk" && (
              <>
                This fund is flagged{" "}
                <span className="font-medium text-destructive">Severe Risk</span>.
                High ROC of{" "}
                <span className="font-mono">
                  {formatPercentShort(baseEtf.rocPercent)}
                </span>{" "}
                and/or steep 1-year price decline indicate much of the payout
                may be returning principal. Consider this a yield trap.
              </>
            )}
            {!baseEtf && "Canary health insights will appear here when data is available."}
          </p>

          <p className="leading-relaxed text-muted-foreground">
            Using your tax rate of{" "}
            <span className="font-mono">{taxRate.toFixed(0)}%</span>, after-tax
            estimates in the Dividends and Risk &amp; Tax tabs show what you
            might realistically keep after fees, ROC, and taxes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface FactItemProps {
  label: string;
  value: string;
}

function FactItem({ label, value }: FactItemProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

function formatPercentShort(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatAum(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(2)}`;
}

function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(0);
}

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
}

function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  const options: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];

  return (
    <div className="inline-flex rounded-full bg-muted p-0.5 text-[10px] sm:text-xs">
      {options.map((opt) => (
        <Button
          key={opt}
          type="button"
          variant="ghost"
          size="sm"
          className={[
            "h-6 px-2",
            opt === value ? "bg-background shadow-sm" : "text-muted-foreground",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(opt)}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}


