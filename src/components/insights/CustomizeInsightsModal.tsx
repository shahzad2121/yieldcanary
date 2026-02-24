import { useState, useEffect } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  INSIGHTS_SECTION_TITLES,
  type InsightsSectionId,
} from '@/components/insights/insightsSectionConfig';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

type CustomizeInsightsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current section order (from hook or parent state). */
  sectionOrder: InsightsSectionId[];
  /** Called with the new order when user clicks Save. Persist to Supabase/localStorage in the parent. */
  onSave: (order: InsightsSectionId[]) => void;
};

function SortableItem({
  id,
  index,
  title,
}: {
  id: InsightsSectionId;
  index: number;
  title: string;
}) {
  const { ref, isDragging } = useSortable({ id, index });

  return (
    <li
      ref={ref}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-sm',
        isDragging && 'opacity-60 shadow-md'
      )}
    >
      <span className="text-muted-foreground" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{title}</span>
    </li>
  );
}

export function CustomizeInsightsModal({ open, onOpenChange, sectionOrder, onSave }: CustomizeInsightsModalProps) {
  const [order, setOrder] = useState<InsightsSectionId[]>(sectionOrder);

  useEffect(() => {
    if (open) setOrder(sectionOrder);
  }, [open, sectionOrder]);

  const handleDragEnd = (event: { canceled?: boolean; operation?: { source: unknown } }) => {
    if (event.canceled) return;
    const source = event.operation?.source;
    if (!source || !isSortable(source as Parameters<typeof isSortable>[0])) return;
    const sortableSource = source as { initialIndex: number; index: number };
    const { initialIndex, index } = sortableSource;
    if (initialIndex === index) return;
    setOrder((items) => {
      const next = [...items];
      const [removed] = next.splice(initialIndex, 1);
      next.splice(index, 0, removed);
      return next;
    });
  };

  const handleSave = () => {
    onSave(order);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Insights</DialogTitle>
          <DialogDescription>
            Drag sections to reorder how they appear on the Insights page.
          </DialogDescription>
        </DialogHeader>
        <DragDropProvider onDragEnd={handleDragEnd}>
          <ul className="flex flex-col gap-2 py-2">
            {order.map((id, index) => (
              <SortableItem
                key={id}
                id={id}
                index={index}
                title={INSIGHTS_SECTION_TITLES[id]}
              />
            ))}
          </ul>
        </DragDropProvider>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
