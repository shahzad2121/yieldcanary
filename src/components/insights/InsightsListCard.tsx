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
import { Lock } from 'lucide-react';
import { ETF } from '@/types/etf';
import { CanaryStatusBadge } from '@/components/dashboard/CanaryStatusBadge';
import { BlurredCell } from '@/components/dashboard/BlurredCell';

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
};

export interface InsightsListCardProps {
  title: string;
  subtitle?: string;
  /** Optional badge text (e.g. "At your 20% rate"). */
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
            <p className="text-xs text-muted-foreground font-medium">{badge}</p>
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
            <p className="text-xs text-muted-foreground font-medium">{badge}</p>
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
          <p className="text-xs text-muted-foreground font-medium">{badge}</p>
        )}
      </CardHeader>
      <CardContent>
        <Table>
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
                      className={`${col.cellClassName ?? ''} ${col.align === 'right' ? 'text-right' : ''}`.trim()}
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
                            />
                          )
                        ) : (
                          <BlurredCell
                            value={col.format(etf)}
                            isUnlocked={isUnlocked}
                            onUpgradeClick={onUpgrade}
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
        {(plan === 'free' ||
          (plan === 'basic' && list.length > VISIBLE_ROWS_BASIC)) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {plan === 'free'
                ? 'Upgrade to Basic to see this list.'
                : `Upgrade to Advanced to see all ${list.length} funds.`}
            </p>
            <Button size="sm" variant="outline" onClick={onUpgrade}>
              Upgrade
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
