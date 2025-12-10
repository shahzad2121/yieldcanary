import { Bird, Crown, Search, Bell, Settings, LogOut, ChevronLeft, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';

interface DashboardHeaderProps {
  isPaid: boolean;
  userEmail?: string;
  onUpgrade: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function DashboardHeader({
  isPaid,
  userEmail = 'user@example.com',
  onUpgrade,
  searchQuery,
  onSearchChange,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 md:px-6">
        {/* Logo + Back Button */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <Bird className="h-5 w-5 sm:h-8 sm:w-8 text-foreground flex-shrink-0" />
            <span className="text-sm sm:text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
              YieldCanary
            </span>
          </button>
        </div>

        {/* Search - Hidden on mobile, visible on larger screens */}
        <div className="hidden md:flex flex-1 max-w-md w-full">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ETFs..."
              className="pl-10 text-sm"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Actions - Right aligned */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Upgrade Button - Hidden on smallest screens */}
          {!isPaid && (
            <Button
              onClick={onUpgrade}
              variant="outline"
              className="hidden sm:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
            >
              <Crown className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Upgrade</span>
            </Button>
          )}

          {isPaid && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground h-8 w-8 hidden sm:flex"
            >
              <Bell className="h-4 w-4" />
            </Button>
          )}

          {/* User Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-secondary text-foreground text-xs">
                    {userEmail.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <div className="px-2 py-1.5">
                <p className="text-xs sm:text-sm font-medium break-words">{userEmail}</p>
                <p className="text-xs text-muted-foreground">
                  {isPaid ? 'Pro Member' : 'Free Tier'}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs sm:text-sm">
                <Settings className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-xs sm:text-sm">
                <LogOut className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ETFs..."
            className="pl-10 text-sm h-9"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
