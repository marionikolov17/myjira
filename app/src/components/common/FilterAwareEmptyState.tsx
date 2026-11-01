'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

type FilterAwareEmptyStateProps = {
  icon: LucideIcon;
  entityLabel: string;
  filterActive: boolean;
  emptyDescription: string;
  onClearFilters: () => void;
  /** Shown when no filters are active (e.g. a create CTA). */
  children?: ReactNode;
};

/** Empty state that swaps copy/actions when list filters are active. */
export function FilterAwareEmptyState({
  icon,
  entityLabel,
  filterActive,
  emptyDescription,
  onClearFilters,
  children,
}: FilterAwareEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={filterActive ? `No ${entityLabel} match these filters` : `No ${entityLabel} yet`}
      description={filterActive ? 'Try removing a filter.' : emptyDescription}
    >
      {filterActive ? (
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : (
        children
      )}
    </EmptyState>
  );
}
