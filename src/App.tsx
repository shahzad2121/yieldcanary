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
import Landing from "./pages/Landing";
import DashboardPage from "./pages/DashboardPage";
import WatchlistPage from "./pages/WatchlistPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import CookiePolicy from "./pages/legal/CookiePolicy";
import DoNotSellMyInfo from "./pages/legal/DoNotSellMyInfo";

const queryClient = new QueryClient();

const AutoLogoutManager = () => {
  useAutoLogout();
  return null;
};

const App = () => {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ParticleBackground />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              {/* Must be inside BrowserRouter so useNavigate has router context */}
              <ScrollToTop />
              <CookieConsent />
              <AutoLogoutManager />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                {/* Legal Pages */}
                <Route path="/legal/terms" element={<TermsOfService />} />
                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/refund" element={<RefundPolicy />} />
                <Route path="/legal/cookies" element={<CookiePolicy />} />
                <Route path="/legal/do-not-sell" element={<DoNotSellMyInfo />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
};

export default App;
