import { Bird, Crown, Search, Bell, Settings, LogOut, ChevronLeft, Moon, Sun, Star, CreditCard, XCircle } from 'lucide-react';
import { useState } from 'react';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { SettingsModal } from './SettingsModal';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { redirectToManageSubscription } from '@/integrations/stripe/checkout';

/** Mobile sticky header height (nav h-14 + search row h-9 + pb-2). Use for sticky elements that sit below the header. */
export const DASHBOARD_HEADER_HEIGHT_MOBILE = '6.25rem';

interface DashboardHeaderProps {
  plan: 'free' | 'basic' | 'advanced';
  isPaid: boolean;
  isTrialing?: boolean;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelsAt?: string | null;
  userEmail?: string;
  onUpgrade: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Callback after subscription is cancelled (e.g. refetch user) so UI updates. */
  onSubscriptionCancelled?: () => void;
}

export function DashboardHeader({
  plan,
  isPaid,
  isTrialing = false,
  trialEndsAt = null,
  cancelAtPeriodEnd = false,
  cancelsAt = null,
  userEmail = 'user@example.com',
  onUpgrade,
  searchQuery,
  onSearchChange,
  onSubscriptionCancelled,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await redirectToManageSubscription();
    } finally {
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 md:px-6">
        {/* Sidebar Toggle (tablet & mobile) + Logo */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <SidebarTrigger className="lg:hidden" />
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <Bird className="h-4 w-4 sm:h-8 sm:w-8 text-foreground flex-shrink-0" />
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

          {/* Feedback Button */}
          <Button
            variant="ghost"
            onClick={() => setIsFeedbackOpen(true)}
            className="text-xs sm:text-sm h-8 sm:h-10 px-0 sm:px-4"
            aria-label="Send feedback"
          >
            Feedback
          </Button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <Moon className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </button>

          {/* Upgrade Button - Hidden on smallest screens */}
          {plan === 'free' && (
            <Button
              onClick={onUpgrade}
              variant="outline"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-7 sm:h-10 px-2 sm:px-4"              >
              <Crown className="h-2 w-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Upgrade</span>
            </Button>
          )}

          {/* {isPaid && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground h-8 w-8 hidden sm:flex"
            >
              <Bell className="h-4 w-4" />
            </Button>
          )} */}

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
                  {plan === 'free' ? 'Free Tier' : plan === 'advanced' ? 'Advanced Member' : 'Basic Member'}
                </p>
                {isTrialing && trialEndsAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trial ends {new Date(trialEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {cancelAtPeriodEnd && cancelsAt && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Cancels on {new Date(cancelsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              {plan !== 'free' && (
                <DropdownMenuItem onClick={() => navigate('/watchlist')} className="text-xs sm:text-sm">
                  <Star className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Watchlist
                </DropdownMenuItem>
              )}
              {plan !== 'free' && (
                <DropdownMenuItem
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="text-xs sm:text-sm"
                >
                  <CreditCard className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </DropdownMenuItem>
              )}
              {plan !== 'free' && !cancelAtPeriodEnd && (
                <DropdownMenuItem
                  onClick={() => setIsCancelModalOpen(true)}
                  className="text-xs sm:text-sm text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Cancel subscription
                </DropdownMenuItem>
              )}
              {plan !== 'free' && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="text-xs sm:text-sm">
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

      {/* Cancellation scheduled banner */}
      {cancelAtPeriodEnd && cancelsAt && (
        <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-center">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Your subscription will cancel on {new Date(cancelsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}. You keep access until then.
          </p>
        </div>
      )}

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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
      />
         {/* Feedback Modal */}
       <FeedbackModal
         isOpen={isFeedbackOpen}
         onClose={() => setIsFeedbackOpen(false)}
         userEmail={userEmail}
       />
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        isTrialing={isTrialing}
        onSuccess={() => {
          onSubscriptionCancelled?.();
        }}
      />
    </header>
  );
}
