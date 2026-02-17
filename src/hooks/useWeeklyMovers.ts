import { useQuery } from '@tanstack/react-query';

export interface WeeklyMover {
  ticker: string;
  rocChange: number;
  deathClockChange: number;
  trueIncomeChange: number;
  score: number;
  canaryHealth: string | null;
}

type WeeklyMoversResponseOk = {
  success: true;
  status: 'ok';
  currentWeek: string;
  previousWeek: string;
  gainers: WeeklyMover[];
  losers: WeeklyMover[];
};

type WeeklyMoversResponseInsufficient = {
  success: true;
  status: 'insufficient_history';
  message: string;
};

type WeeklyMoversResponseError = {
  success: false;
  error: string;
};

type WeeklyMoversResponse =
  | WeeklyMoversResponseOk
  | WeeklyMoversResponseInsufficient
  | WeeklyMoversResponseError;

export interface WeeklyMoversData {
  status: 'ok' | 'insufficient_history';
  currentWeek?: string;
  previousWeek?: string;
  gainers: WeeklyMover[];
  losers: WeeklyMover[];
  message?: string;
}

async function fetchWeeklyMovers(): Promise<WeeklyMoversData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/weekly-movers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Failed to fetch weekly movers' }));
    throw new Error(errorBody.error || `HTTP ${response.status}: Failed to fetch weekly movers`);
  }

  const result: WeeklyMoversResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch weekly movers');
  }

  if (result.status === 'insufficient_history') {
    return {
      status: 'insufficient_history',
      gainers: [],
      losers: [],
      message: result.message,
    };
  }

  return {
    status: 'ok',
    currentWeek: result.currentWeek,
    previousWeek: result.previousWeek,
    gainers: result.gainers,
    losers: result.losers,
  };
}

export function useWeeklyMovers() {
  return useQuery({
    queryKey: ['weekly-movers'],
    queryFn: fetchWeeklyMovers,
    staleTime: 60 * 60 * 1000, // 1 hour; updates weekly so can be fairly stale
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
  });
}

