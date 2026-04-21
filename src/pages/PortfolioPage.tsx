import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Clock, DollarSign, Shield, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Footer } from '@/components/Footer';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  PORTFOLIO_HOLDINGS,
  PORTFOLIO_SUMMARY,
  type PortfolioHolding,
} from '@/data/portfolioDummyData';
import type { CanaryStatus } from '@/types/etf';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

const STATUS_STYLES: Record<CanaryStatus, { badge: string; dot: string }> = {
  Healthy: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  Dying: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  Dead: {
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    dot: 'bg-red-500',
  },
};

function StatusBadge({ status }: { status: CanaryStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function mask(value: string, hidden: boolean) {
  return hidden ? '••••' : value;
}

/* ─────────────────────────────────────────────
   Section 2: Summary Cards
───────────────────────────────────────────── */
function SummaryCards({ privacyMode }: { privacyMode: boolean }) {
  const cards = [
    {
      icon: Shield,
      label: 'Portfolio Status',
      value: <StatusBadge status={PORTFOLIO_SUMMARY.status} />,
      subtext: 'Overall portfolio health',
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
    },
    {
      icon: Clock,
      label: 'Death Clock',
      value: (
        <span className="text-2xl font-bold tracking-tight text-foreground">
          {mask(`${PORTFOLIO_SUMMARY.weightedDeathClock} yrs`, privacyMode)}
        </span>
      ),
      subtext: 'Estimated sustainability timeline',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: TrendingDown,
      label: 'ROC Exposure',
      value: (
        <span className={`text-2xl font-bold tracking-tight ${PORTFOLIO_SUMMARY.rocExposure > 15 ? 'text-amber-500' : 'text-foreground'}`}>
          {mask(`${PORTFOLIO_SUMMARY.rocExposure}%`, privacyMode)}
        </span>
      ),
      subtext: 'Income from return of capital',
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
    {
      icon: DollarSign,
      label: 'Monthly Cash Flow',
      value: (
        <span className="text-2xl font-bold tracking-tight text-foreground">
          {mask(`$${PORTFOLIO_SUMMARY.monthlyCashFlow.toLocaleString()}`, privacyMode)}
        </span>
      ),
      subtext: 'Estimated spendable income',
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, subtext, iconColor, iconBg }) => (
        <div
          key={label}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </span>
          </div>
          <div>{value}</div>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section 3: Holdings Table
───────────────────────────────────────────── */
function HoldingsTable({
  holdings,
  privacyMode,
}: {
  holdings: PortfolioHolding[];
  privacyMode: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm custom-scrollbar">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ETF
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Allocation
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              True Yield
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ROC %
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Death Clock
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly Income
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr
              key={h.ticker}
              className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/15'}`}
            >
              {/* ETF name + ticker */}
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground">{h.ticker}</div>
                <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {h.name}
                </div>
              </td>

              {/* Allocation bar */}
              <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className="font-medium text-foreground">{h.allocation}%</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${h.allocation}%` }}
                    />
                  </div>
                </div>
              </td>

              {/* True income yield */}
              <td className="px-4 py-3 text-right font-medium text-foreground">
                {mask(`${h.trueIncomeYield}%`, privacyMode)}
              </td>

              {/* ROC % */}
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-medium ${h.rocPct > 15 ? 'text-amber-500' : h.rocPct > 0 ? 'text-muted-foreground' : 'text-emerald-500'}`}
                >
                  {mask(`${h.rocPct}%`, privacyMode)}
                </span>
              </td>

              {/* Canary status */}
              <td className="px-4 py-3 text-center">
                <StatusBadge status={h.canaryStatus} />
              </td>

              {/* Death clock */}
              <td className="px-4 py-3 text-right font-medium text-foreground">
                {h.deathClock === null
                  ? <span className="text-emerald-500 text-xs">N/A</span>
                  : mask(`${h.deathClock} yrs`, privacyMode)}
              </td>

              {/* Monthly income */}
              <td className="px-4 py-3 text-right font-semibold text-foreground">
                {mask(`$${h.monthlyIncome.toLocaleString()}`, privacyMode)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section 4: Allocation Breakdown
───────────────────────────────────────────── */
function AllocationBreakdown({ holdings }: { holdings: PortfolioHolding[] }) {
  const STATUS_BAR_COLOR: Record<CanaryStatus, string> = {
    Healthy: 'bg-emerald-500',
    Dying: 'bg-amber-500',
    Dead: 'bg-red-500',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Allocation Breakdown</h3>
      <div className="space-y-3">
        {holdings.map((h) => (
          <div key={h.ticker} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs font-semibold text-foreground">{h.ticker}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted h-2.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR_COLOR[h.canaryStatus]}`}
                style={{ width: `${h.allocation}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
              {h.allocation}%
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
        {(['Healthy', 'Dying', 'Dead'] as CanaryStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${STATUS_BAR_COLOR[s]}`} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function PortfolioPage() {
  const [privacyMode, setPrivacyMode] = useState(false);

  return (
    <>
      <Helmet>
        <title>Portfolio – YieldCanary</title>
        <meta
          name="description"
          content="Track the health of your entire income ETF portfolio in one view."
        />
      </Helmet>

      <DashboardLayout>
        <div className="min-h-screen bg-background">
          <main className="container py-6 sm:py-8 lg:py-10">

            {/* ── Section 1: Header ── */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Portfolio
                  </h1>
                  {/* <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20">
                    Coming Soon
                  </span> */}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track the health of your entire income strategy
                </p>
              </div>

              {/* ── Section 5: Privacy Mode Toggle ── */}
              <div className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm self-start">
                {privacyMode
                  ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                  : <Eye className="h-4 w-4 text-muted-foreground" />}
                <Label htmlFor="privacy-toggle" className="cursor-pointer select-none text-sm font-medium text-foreground">
                  Privacy Mode
                </Label>
                <Switch
                  id="privacy-toggle"
                  checked={privacyMode}
                  onCheckedChange={setPrivacyMode}
                />
              </div>
            </div>

            {/* ── Section 2: Summary Cards ── */}
            <SummaryCards privacyMode={privacyMode} />

            {/* ── Section 3: Holdings Table ── */}
            <div className="mt-6">
              <h2 className="mb-3 text-base font-semibold text-foreground">Holdings</h2>
              <HoldingsTable holdings={PORTFOLIO_HOLDINGS} privacyMode={privacyMode} />
            </div>

            {/* ── Section 4: Allocation Breakdown ── */}
            <div className="mt-6">
              <AllocationBreakdown holdings={PORTFOLIO_HOLDINGS} />
            </div>

            {/* Disclaimer */}
            <p className="mt-8 text-center text-xs text-muted-foreground">
              This is a demo view using sample data. Portfolio tracking is coming soon.
            </p>

            <Footer showDataDisclaimer={false} />
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}
