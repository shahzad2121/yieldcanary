import type { EChartsOption } from "echarts";
import { formatMMDDYYYY } from "./formatDeepDiveDate";

/** Short legend text only; series names stay unchanged for tooltips. */
function formatDividendLegendLabel(name: string): string {
  if (name === "Cumulative Yield") return "Cum. yield";
  return name;
}

/**
 * Legend + grid for dividend combo charts (bars + cumulative yield line).
 * Single top row, extra spacing + shorter label for “Cumulative Yield” so items don’t overlap on mobile.
 */
export function getDividendComboChartLayout(): Pick<EChartsOption, "legend" | "grid"> {
  return {
    legend: {
      type: "plain",
      orient: "horizontal",
      left: "center",
      top: 0,
      itemWidth: 11,
      itemHeight: 10,
      itemGap: 28,
      /** Extra bottom padding so legend row clears the right y-axis “Cumulative Yield” title */
      padding: [4, 4, 14, 4],
      textStyle: { fontSize: 10 },
      formatter: formatDividendLegendLabel,
    },
    grid: {
      left: 40,
      right: 40,
      /** Pull plot down so legend + gap don’t collide with dual y-axis name area */
      top: 46,
      bottom: 52,
      containLabel: true,
    },
  };
}

/** Tooltip for dividend stacked bars + cumulative yield line (formats axis date as MM-DD-YYYY). */
export function dividendComboTooltipFormatter(params: unknown): string {
  const list = Array.isArray(params) ? params : params ? [params] : [];
  if (!list.length) return "";
  const first = list[0] as { axisValue?: string; axisValueLabel?: string };
  const header = formatMMDDYYYY(String(first.axisValueLabel ?? first.axisValue ?? ""));
  const lines = [`<div style="font-weight:600;margin-bottom:4px">${header}</div>`];
  for (const item of list) {
    const p = item as { marker?: string; seriesName?: string; value?: unknown };
    const marker = p.marker ?? "";
    const name = p.seriesName ?? "";
    let num: number | null = null;
    const v = p.value;
    if (typeof v === "number") num = v;
    else if (Array.isArray(v) && typeof v[1] === "number") num = v[1];
    if (num == null || !Number.isFinite(num)) continue;
    if (name === "Cumulative Yield") {
      lines.push(`${marker} ${name}: ${num.toFixed(2)}%`);
    } else {
      lines.push(`${marker} ${name}: ${num.toFixed(4)}`);
    }
  }
  return lines.join("<br/>");
}

/** Price + volume + dividend markers (axis tooltip). */
export function priceVolumeTooltipFormatter(params: unknown): string {
  const list = Array.isArray(params) ? params : params ? [params] : [];
  if (!list.length) return "";
  const first = list[0] as { axisValue?: string; axisValueLabel?: string };
  const header = formatMMDDYYYY(String(first.axisValueLabel ?? first.axisValue ?? ""));
  const lines = [`<div style="font-weight:600;margin-bottom:4px">${header}</div>`];
  for (const item of list) {
    const p = item as { marker?: string; seriesName?: string; value?: unknown };
    const marker = p.marker ?? "";
    const name = p.seriesName ?? "";
    let num: number | null = null;
    const v = p.value;
    if (typeof v === "number") num = v;
    else if (Array.isArray(v) && typeof v[1] === "number") num = v[1];
    if (num == null || !Number.isFinite(num)) continue;
    if (name === "Volume") {
      lines.push(`${marker} ${name}: ${(num / 1_000_000).toFixed(2)}M`);
    } else {
      lines.push(`${marker} ${name}: $${num.toFixed(2)}`);
    }
  }
  return lines.join("<br/>");
}
