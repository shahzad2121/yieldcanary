import { ReactNode, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Bird, LayoutDashboard, Star, HelpCircle, BarChart2, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { HelpModal } from '@/components/modals/HelpModal';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { useWelcomeBanner } from '@/hooks/useWelcomeBanner';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const { shouldShow: showWelcomeBanner, isLoading: welcomeBannerLoading, dismiss: dismissWelcomeBanner } = useWelcomeBanner();

  const path = location.pathname;
  const isDashboard = path === '/dashboard';
  const isWatchlist = path === '/watchlist';
  const isInsights = path === '/insights';
  const isPortfolio = path === '/portfolio';

  // Get user email from session
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Bird className="h-5 w-5" />
            <span className="font-semibold text-sm truncate">YieldCanary</span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isDashboard}
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isWatchlist}
                onClick={() => navigate('/watchlist')}
              >
                <Star className="h-4 w-4" />
                <span>Watchlist</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isInsights}
                onClick={() => navigate('/insights')}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Insights</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isPortfolio}
                onClick={() => navigate('/portfolio')}
              >
                <Briefcase className="h-4 w-4" />
                <span>Portfolio</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenuButton onClick={() => setIsHelpOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            <span>Help</span>
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        {isDashboard && !welcomeBannerLoading && showWelcomeBanner && (
          <WelcomeBanner
            onGoToHelp={() => {
              dismissWelcomeBanner();
              setIsHelpOpen(true);
            }}
            onDismiss={dismissWelcomeBanner}
          />
        )}
        {children}
      </SidebarInset>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        userEmail={userEmail}
      />
    </SidebarProvider>
  );
}


