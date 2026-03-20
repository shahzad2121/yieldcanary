import type { EChartsType } from "echarts";

const DEFAULT_BACKGROUND = "#0f172a";

/**
 * Export the current ECharts canvas as PNG (respects dataZoom and visible range).
 * No-op if instance is missing or getDataURL fails.
 */
export function downloadEChartAsPNG(
  instance: EChartsType | null | undefined,
  filename: string,
  backgroundColor: string = DEFAULT_BACKGROUND,
): void {
  if (!instance || typeof instance.getDataURL !== "function") return;

  let dataUrl: string;
  try {
    dataUrl = instance.getDataURL({
      type: "png",
      pixelRatio: 3,
      backgroundColor,
    });
  } catch {
    return;
  }

  if (!dataUrl) return;

  const safeName = filename.toLowerCase().endsWith(".png")
    ? filename
    : `${filename}.png`;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export { DEFAULT_BACKGROUND as ECHART_EXPORT_DEFAULT_BACKGROUND };
