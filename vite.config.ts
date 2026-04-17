import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // ECharts is intentionally isolated into its own vendor chunk and can exceed
    // Vite's default 500 kB warning threshold. Raise warning limit to reduce
    // noise while keeping current code-splitting behavior unchanged.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        /**
         * Split large vendor libraries into separate named chunks so that:
         *  - Each chunk can be cached independently by the browser/CDN.
         *  - Echarts (the heaviest dep) loads only when a chart tab is opened
         *    (tabs are already lazy-loaded via React.lazy in EtfDeepDiveModal).
         *  - Changing app code doesn't bust the vendor cache.
         */
        manualChunks: {
          // React runtime — tiny and stable; long-lived cache
          "vendor-react": ["react", "react-dom"],
          // ECharts is the largest single dependency (~1 MB min); isolated chunk
          // so it loads in parallel and is cached between deployments
          "vendor-echarts": ["echarts", "echarts-for-react"],
          // Supabase JS client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Recharts (used in ui/chart.tsx shadcn wrapper)
          "vendor-recharts": ["recharts"],
          // Client-side router
          "vendor-router": ["react-router-dom"],
          // Server-state / data fetching
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
});
