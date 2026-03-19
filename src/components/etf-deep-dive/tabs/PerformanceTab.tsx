import { useMemo } from "react";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtfDeepDiveSectionSeparator } from "../EtfDeepDiveModal";
import { ChartContainer } from "@/components/ui/chart";
import { getChartColors } from "@/lib/chartColors";
import { formatMMDDYYYY } from "@/lib/formatDeepDiveDate";
import ReactECharts from "echarts-for-react";

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}

export default function PerformanceTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { priceSeries } = useEtfDeepDiveData(ticker, baseEtf);

  const growthOf10kSeries = useMemo(() => {
    const valid = priceSeries.filter(
      (p): p is { date: string; close: number; volume: number | null } =>
        p.close != null && p.close > 0
    );
    if (valid.length === 0) return [];
    const firstClose = valid[0].close;
    return valid.map((p) => ({
      date: p.date,
      value: Math.round(10000 * (p.close / firstClose)),
    }));
  }, [priceSeries]);

  const periodReturns = useMemo(() => {
    const valid = priceSeries.filter(
      (p): p is { date: string; close: number; volume: number | null } =>
        p.close != null && p.close > 0
    );
    if (valid.length === 0)
      return {
        "1M": null as number | null,
        "3M": null,
        "6M": null,
      };
    const last = valid[valid.length - 1];
    const lastDate = new Date(last.date);
    const lastClose = last.close;

    const findReturn = (monthsBack: number): number | null => {
      const start = new Date(lastDate);
      start.setMonth(start.getMonth() - monthsBack);
      const startStr = start.toISOString().split("T")[0];
      const past = valid.filter((p) => p.date <= startStr);
      if (past.length === 0) return null;
      const p = past[past.length - 1];
      if (p.close <= 0) return null;
      return ((lastClose - p.close) / p.close) * 100;
    };

    return {
      "1M": findReturn(1),
      "3M": findReturn(3),
      "6M": findReturn(6),
    };
  }, [priceSeries]);

  const growthChartOption = useMemo(() => {
    if (!growthOf10kSeries.length) return {};
    const c = getChartColors();
    const categories = growthOf10kSeries.map((d) =>
      d.date.includes("T") ? d.date.split("T")[0] : d.date,
    );
    const values = growthOf10kSeries.map((d) => d.value);
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : null;
          const v = p && typeof p === "object" && p !== null && "data" in p ? (p as { data: number }).data : null;
          return v != null ? `Value: $${Number(v).toLocaleString()}` : "";
        },
      },
      grid: { left: 40, right: 24, top: 20, bottom: 52 },
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
      yAxis: {
        type: "value",
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(128,128,128,0.15)",
            type: "dashed",
          },
        },
      },
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
          name: "Value",
          type: "bar",
          data: values,
          itemStyle: {
            color: c.chart1,
            opacity: 0.6,
          },
        },
      ],
    };
  }, [growthOf10kSeries]);

  return (
    <div className="space-y-4">
      <Card className="h-[260px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Growth of $10,000</CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="h-52">
            {growthOf10kSeries.length > 0 ? (
              <ChartContainer
                id="performance-growth-chart"
                className="h-full w-full"
                config={{ value: { label: "Value", color: getChartColors().chart1 } }}
              >
                <ReactECharts
                  option={growthChartOption}
                  style={{ height: "100%", width: "100%" }}
                />
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/40 text-xs text-muted-foreground">
                No price data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Period Returns (Total Return)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 md:grid-cols-6">
            <PeriodItem label="1M" value={periodReturns["1M"]} />
            <PeriodItem label="3M" value={periodReturns["3M"]} />
            <PeriodItem label="6M" value={periodReturns["6M"]} />
            <PeriodItem
              label="1Y"
              value={baseEtf?.totalReturn1Y != null ? baseEtf.totalReturn1Y : null}
            />
            <PeriodItem
              label="YTD"
              value={baseEtf?.totalReturnYTD != null ? baseEtf.totalReturnYTD : null}
            />
            <PeriodItem
              label="Inception"
              value={
                baseEtf?.totalReturnSinceInception != null
                  ? baseEtf.totalReturnSinceInception
                  : null
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PeriodItem({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          value != null
            ? value >= 0
              ? "text-xs text-emerald-600 dark:text-emerald-400"
              : "text-xs text-red-600 dark:text-red-400"
            : "text-xs text-muted-foreground"
        }
      >
        {formatPercent(value)}
      </span>
    </div>
  );
}
