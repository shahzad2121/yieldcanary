import { ReactNode } from 'react';
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
} from '@/components/ui/sidebar';
import { Bird, LayoutDashboard, Star } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;
  const isDashboard = path === '/dashboard';
  const isWatchlist = path === '/watchlist';

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
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}


