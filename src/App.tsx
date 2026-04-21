import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/hooks/useTheme";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CookieConsent } from "@/components/CookieConsent";
import { ToltScript } from "@/components/ToltScript";
import { EtfDeepDiveProvider } from "@/context/EtfDeepDiveContext";
import { EtfDeepDiveModal } from "@/components/etf-deep-dive/EtfDeepDiveModal";

/**
 * Code-split every route-level page so the initial JS bundle only contains
 * providers, the landing page, and the shell. Each page is downloaded on
 * first navigation to that route and then cached by the browser.
 */
const Landing = lazy(() => import("./pages/Landing"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const DoNotSellMyInfo = lazy(() => import("./pages/legal/DoNotSellMyInfo"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));

const queryClient = new QueryClient();

const AutoLogoutManager = () => {
  useAutoLogout();
  return null;
};

/** Shown while a lazy page chunk is being fetched. Keeps the screen non-blank. */
function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ParticleBackground />
            <ToltScript />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <EtfDeepDiveProvider>
                {/* Must be inside BrowserRouter so useNavigate has router context */}
                <ScrollToTop />
                <CookieConsent />
                <AutoLogoutManager />
                {/*
                 * Suspense wraps all lazy-loaded pages. The PageLoader spinner
                 * is shown for the brief moment a new route chunk is downloading.
                 * Each page chunk loads only once and is then cached.
                 */}
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/watchlist" element={<WatchlistPage />} />
                    <Route path="/insights" element={<InsightsPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    {/* Legal Pages */}
                    <Route path="/legal/terms" element={<TermsOfService />} />
                    <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                    <Route path="/legal/refund" element={<RefundPolicy />} />
                    <Route path="/legal/cookies" element={<CookiePolicy />} />
                    <Route path="/legal/do-not-sell" element={<DoNotSellMyInfo />} />
                    <Route path="/affiliates" element={<Affiliates />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <EtfDeepDiveModal />
              </EtfDeepDiveProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
};

export default App;
