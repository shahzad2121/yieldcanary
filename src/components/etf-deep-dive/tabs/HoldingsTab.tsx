import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtfDeepDiveSectionSeparator } from "../EtfDeepDiveModal";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";
import { ChartContainer } from "@/components/ui/chart";
import { getChartColors } from "@/lib/chartColors";
import ReactECharts from "echarts-for-react";
import { EChartPngExportButton } from "../EChartPngExportButton";

export default function HoldingsTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { sectors } = useEtfDeepDiveData(ticker, baseEtf);
  const sectorChartRef = useRef<InstanceType<typeof ReactECharts>>(null);

  const sectorChartOption = useMemo(() => {
    if (!sectors.length) return {};
    const c = getChartColors();
    const categories = sectors.map((s) => s.sector ?? "");
    const weights = sectors.map((s) => s.weight ?? 0);
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : null;
          const v = p && typeof p === "object" && p !== null && "data" in p ? (p as { data: number }).data : null;
          const name = p && typeof p === "object" && p !== null && "name" in p ? (p as { name: string }).name : "";
          return v != null ? `${name}: ${Number(v).toFixed(1)}%` : "";
        },
      },
      grid: { left: 40, right: 24, top: 20, bottom: 72 },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: { fontSize: 10, rotate: -30 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Weight %",
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => `${value.toFixed(1)}%`,
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
          name: "Sector",
          type: "bar",
          data: weights,
          itemStyle: {
            color: c.chart1,
            opacity: 0.7,
          },
        },
      ],
    };
  }, [sectors]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex h-56 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Holdings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center px-4">
            <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card className="flex h-56 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Holdings Allocation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center px-4">
            <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-1">
            <CardTitle className="text-sm">Sector Allocation</CardTitle>
            {ticker && sectors.length > 0 ? (
              <EChartPngExportButton
                chartRef={sectorChartRef}
                filename={`${ticker}-sector-allocation`}
                className="shrink-0"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ChartContainer
              id="etf-sector-allocation"
              className="h-full max-h-72 w-full"
              config={{
                sector: { label: "Sector", color: getChartColors().chart1 },
              }}
            >
              <ReactECharts
                ref={sectorChartRef}
                option={sectorChartOption}
                style={{ height: "100%", width: "100%" }}
              />
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

