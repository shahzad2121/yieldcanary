/**
 * Resolves chart color CSS variables to actual hsl() strings.
 * Use for ECharts/canvas so colors match the theme (muted brand palette).
 */
export function getChartColors(): {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
} {
  if (typeof document === "undefined") {
    return {
      chart1: "hsl(160 45% 42%)",
      chart2: "hsl(200 35% 52%)",
      chart3: "hsl(160 40% 52%)",
      chart4: "hsl(0 50% 52%)",
      chart5: "hsl(200 30% 58%)",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const get = (varName: string) => style.getPropertyValue(varName).trim();
  const fallbacks = {
    chart1: "hsl(160 45% 42%)",
    chart2: "hsl(200 35% 52%)",
    chart3: "hsl(160 40% 52%)",
    chart4: "hsl(0 50% 52%)",
    chart5: "hsl(200 30% 58%)",
  };
  return {
    chart1: get("--chart-1") ? `hsl(${get("--chart-1")})` : fallbacks.chart1,
    chart2: get("--chart-2") ? `hsl(${get("--chart-2")})` : fallbacks.chart2,
    chart3: get("--chart-3") ? `hsl(${get("--chart-3")})` : fallbacks.chart3,
    chart4: get("--chart-4") ? `hsl(${get("--chart-4")})` : fallbacks.chart4,
    chart5: get("--chart-5") ? `hsl(${get("--chart-5")})` : fallbacks.chart5,
  };
}
