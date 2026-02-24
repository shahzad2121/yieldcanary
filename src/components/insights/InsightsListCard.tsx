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
import { Check, Lock } from 'lucide-react';
import { ETF } from '@/types/etf';
import { CanaryStatusBadge } from '@/components/dashboard/CanaryStatusBadge';
import { BlurredCell } from '@/components/dashboard/BlurredCell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const VISIBLE_ROWS_BASIC = 3;

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
}: InsightsListCardProps) {
  const visibleCount =
    plan === 'advanced' ? list.length : plan === 'basic' ? VISIBLE_ROWS_BASIC : 0;

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
              {list.map((etf, index) => {
                const isUnlocked = index < visibleCount;
                return (
                  <TableRow key={etf.id}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={`${col.width ?? ''} ${col.cellClassName ?? ''} ${col.align === 'right' ? 'text-right' : ''}`.trim()}
                      >
                        <div
                          className={
                            col.align === 'right' ? 'w-full flex justify-end' : undefined
                          }
                        >
                          {col.type === 'status' ? (
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
                          ) : col.id === 'name' && isUnlocked && col.showNameTooltip ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full min-w-0 overflow-hidden truncate text-left">
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
          {list.map((etf, index) => {
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
                    <span className="font-mono font-semibold text-sm">
                      {tickerColumn.format(etf)}
                    </span>
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
                      <p className="text-xs text-muted-foreground line-clamp-2">
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
