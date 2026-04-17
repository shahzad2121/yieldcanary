import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, Lock, ChevronDown } from 'lucide-react';
import { ETF } from '@/types/etf';
import { CanaryStatusBadge } from '@/components/dashboard/CanaryStatusBadge';
import { BlurredCell } from '@/components/dashboard/BlurredCell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EtfTickerChip } from '@/components/etf-deep-dive/EtfTickerChip';

const VISIBLE_ROWS_BASIC = 3;
/** Default number of rows shown before "See More". */
const DEFAULT_INITIAL_ROWS = 5;

export type InsightsListColumn = {
  id: string;
  label: string;
  width?: string;
  align?: 'left' | 'right';
  /** When 'status', unlocked cells show CanaryStatusBadge; otherwise BlurredCell with format(etf). */
  type?: 'text' | 'status';
  format: (etf: ETF) => string;
  /** Optional class for the table cell (e.g. truncate, font-mono). */
  cellClassName?: string;
  /** When true and id === 'name', show full ETF name in a tooltip on hover. */
  showNameTooltip?: boolean;
  /** Optional class for the value span inside BlurredCell (e.g. text-muted-foreground). */
  valueClassName?: string;
  /** Optional function to dynamically determine className based on ETF data. Overrides valueClassName if provided. */
  getValueClassName?: (etf: ETF) => string;
};

export interface InsightsListCardProps {
  title: string;
  subtitle?: string;
  /** Optional badge text (e.g. "Your 20% Tax Rate Applied"). */
  badge?: string;
  list: ETF[];
  emptyMessage: string;
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
  columns: InsightsListColumn[];
  /** Rows shown before "See More". Omit or 0 to show all. */
  initialRowsShown?: number;
}

/**
 * Some Insights rows (e.g. weekly movers) are lightweight projections that only
 * contain ticker + delta fields. Passing those as `baseEtf` into Deep Dive can
 * crash modal rendering because required numeric fields are missing.
 */
function hasDeepDiveBaseEtf(etf: ETF): boolean {
  return typeof etf.latestAdjClose === 'number' && Number.isFinite(etf.latestAdjClose);
}

export function InsightsListCard({
  title,
  subtitle,
  badge,
  list,
  emptyMessage,
  plan,
  onUpgrade,
  loading = false,
  columns,
  initialRowsShown = DEFAULT_INITIAL_ROWS,
}: InsightsListCardProps) {
  const [rowsToShow, setRowsToShow] = useState(() =>
    initialRowsShown > 0 ? Math.min(initialRowsShown, list.length) : list.length
  );

  useEffect(() => {
    setRowsToShow(
      initialRowsShown > 0 ? Math.min(initialRowsShown, list.length) : list.length
    );
  }, [initialRowsShown, list.length]);

  const visibleCount =
    plan === 'advanced' ? list.length : plan === 'basic' ? VISIBLE_ROWS_BASIC : 0;
  const canExpand = initialRowsShown > 0 && rowsToShow < list.length;
  const displayedList = list.slice(0, rowsToShow);

  if (loading) {
    return (
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {badge && (
            badge.includes('Tax Rate Applied')
              ? (
                <div className="w-fit inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{badge}</span>
                </div>
              )
              : (
                <p className="text-xs text-muted-foreground font-medium">{badge}</p>
              )
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (list.length === 0) {
    return (
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {badge && (
            badge.includes('Tax Rate Applied')
              ? (
                <div className="w-fit inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{badge}</span>
                </div>
              )
              : (
                <p className="text-xs text-muted-foreground font-medium">{badge}</p>
              )
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            {emptyMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        {badge && (
          badge.includes('Tax Rate Applied')
            ? (
              <div className="w-fit inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{badge}</span>
              </div>
            )
            : (
              <p className="text-xs text-muted-foreground font-medium">{badge}</p>
            )
        )}
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={300}>
        {/* Desktop/tablet: keep dense comparison table */}
        <div className="hidden md:block insights-table-x-scroll">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={`${col.width ?? ''} ${col.align === 'right' ? 'text-right' : ''}`.trim()}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedList.map((etf, index) => {
                const isUnlocked = index < visibleCount;
                return (
                  <TableRow key={etf.id}>
                    {columns.map((col, colIndex) => (
                      <TableCell
                        key={col.id}
                        className={`${col.width ?? ''} ${col.id === 'name' ? (col.cellClassName ?? '').replace(/\btruncate\b/g, '').trim() : (col.cellClassName ?? '')} ${col.align === 'right' ? 'text-right' : ''} ${col.id === 'name' ? 'max-w-[220px] align-top' : ''}`.trim()}
                      >
                        <div
                          className={
                            col.align === 'right' ? 'w-full flex justify-end' : undefined
                          }
                        >
                          {col.id === 'ticker' || colIndex === 0 ? (
                            <EtfTickerChip
                              ticker={col.format(etf)}
                              baseEtf={hasDeepDiveBaseEtf(etf) ? etf : undefined}
                            />
                          ) : col.type === 'status' ? (
                            isUnlocked ? (
                              <CanaryStatusBadge status={etf.canaryStatus} />
                            ) : (
                              <BlurredCell
                                value={col.format(etf)}
                                isUnlocked={false}
                                onUpgradeClick={onUpgrade}
                                className={col.getValueClassName?.(etf) ?? col.valueClassName}
                              />
                            )
                          ) : col.id === 'name' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-full min-w-0 text-left ${col.id === 'name' ? 'break-words whitespace-normal' : ''}`}>
                                  <BlurredCell
                                    value={col.format(etf)}
                                    isUnlocked={isUnlocked}
                                    onUpgradeClick={onUpgrade}
                                    className={col.getValueClassName?.(etf) ?? col.valueClassName}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                {col.format(etf)}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <BlurredCell
                              value={col.format(etf)}
                              isUnlocked={isUnlocked}
                              onUpgradeClick={onUpgrade}
                              className={col.getValueClassName?.(etf) ?? col.valueClassName}
                            />
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: card-style layout inspired by dashboard stats */}
        <div className="space-y-2 md:hidden">
          {displayedList.map((etf, index) => {
            const isUnlocked = index < visibleCount;

            const tickerColumn = columns[0];
            const nameColumn = columns.find((col) => col.id === 'name');
            const statusColumn = columns.find((col) => col.type === 'status');

            return (
              <div
                key={etf.id}
                className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {tickerColumn && (
                    <EtfTickerChip
                      ticker={tickerColumn.format(etf)}
                      baseEtf={hasDeepDiveBaseEtf(etf) ? etf : undefined}
                    />
                  )}
                  {statusColumn && (
                    <div className="flex-shrink-0">
                      {isUnlocked ? (
                        <CanaryStatusBadge status={etf.canaryStatus} />
                      ) : (
                        <BlurredCell
                          value={statusColumn.format(etf)}
                          isUnlocked={false}
                          onUpgradeClick={onUpgrade}
                        />
                      )}
                    </div>
                  )}
                </div>

                {nameColumn && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground break-words whitespace-normal">
                        {nameColumn.format(etf)}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      {nameColumn.format(etf)}
                    </TooltipContent>
                  </Tooltip>
                )}

                <div className="mt-1.5 space-y-1">
                  {columns
                    .filter(
                      (col) =>
                        col !== tickerColumn &&
                        col !== nameColumn &&
                        col !== statusColumn
                    )
                    .map((col) => (
                      <div
                        key={col.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="min-w-0 flex-1 text-muted-foreground truncate">
                          {col.label}
                        </span>
                        <div className="ml-2 flex-shrink-0 text-right">
                          <BlurredCell
                            value={col.format(etf)}
                            isUnlocked={isUnlocked}
                            onUpgradeClick={onUpgrade}
                            className={col.getValueClassName?.(etf) ?? col.valueClassName}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {canExpand && (
          <div className="mt-3 flex justify-center border-t border-border pt-3">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground gap-1"
              onClick={() =>
                setRowsToShow((current) =>
                  Math.min(
                    current + initialRowsShown,
                    list.length
                  )
                )
              }
            >
              <ChevronDown className="h-4 w-4" />
              {`See more (${Math.min(initialRowsShown, list.length - rowsToShow)} more)`}
            </Button>
          </div>
        )}

        {(plan === 'free' ||
          (plan === 'basic' && list.length > VISIBLE_ROWS_BASIC)) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {plan === 'free'
                ? 'Upgrade to Basic to see the top 3 in this list, or Advanced for the full list.'
                : `Upgrade to Advanced to see all ${list.length} funds.`}
            </p>
            <Button size="sm" variant="outline" onClick={onUpgrade}>
              Upgrade
            </Button>
          </div>
        )}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
