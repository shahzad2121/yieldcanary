import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtfDeepDiveSectionSeparator } from "../EtfDeepDiveModal";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { useEtfDeepDiveData } from "@/hooks/useEtfDeepDiveData";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import { getChartColors } from "@/lib/chartColors";
import ReactECharts from "echarts-for-react";

export default function HoldingsTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { holdingsTop10, sectors } = useEtfDeepDiveData(ticker, baseEtf);

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
        <Card className="h-56">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Holdings</CardTitle>
          </CardHeader>
          <CardContent className="h-full overflow-auto">
            <div className="max-h-44 overflow-auto">
              <table className="w-full table-auto border-collapse text-[11px] sm:text-xs">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Ticker</th>
                    <th className="px-2 py-1 font-medium">Name</th>
                    <th className="px-2 py-1 text-right font-medium">Weight</th>
                    <th className="px-2 py-1 font-medium">Sector</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsTop10.map((h, idx) => (
                    <tr key={`${h.symbol ?? h.name ?? "holding"}-${idx}`} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1 font-mono">{h.symbol ?? "—"}</td>
                      <td className="px-2 py-1">{h.name ?? "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">
                        {h.weight != null ? `${h.weight.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-2 py-1">{h.sector ?? "—"}</td>
                    </tr>
                  ))}
                  {holdingsTop10.length === 0 && (
                    <tr>
                      <td
                        className="px-2 py-3 text-center text-muted-foreground"
                        colSpan={4}
                      >
                        
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-56">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Holdings Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            <div className="h-44">
              <ChartContainer
                id="etf-holdings-pie"
                className="h-full w-full"
                config={{}}
              >
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={holdingsTop10}
                      dataKey="weight"
                      nameKey="symbol"
                      innerRadius={32}
                      outerRadius={58}
                      paddingAngle={1.5}
                    >
                      {holdingsTop10.map((_, index) => (
                        <Cell key={index} fill={`var(--chart-${(index % 5) + 1})`} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <ChartLegend content={<ChartLegendContent nameKey="symbol" />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <EtfDeepDiveSectionSeparator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sector Allocation</CardTitle>
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

