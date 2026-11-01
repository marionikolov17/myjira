'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Pagination } from '@/lib/api/schemas';

type PaginationBarProps = {
  pagination: Pagination | undefined;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

export function PaginationBar({
  pagination,
  onPageChange,
  itemLabel = 'items',
}: PaginationBarProps) {
  if (!pagination || pagination.totalItems === 0) return null;
  const { page, pageSize, totalItems, totalPages } = pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {`Showing ${from}–${to} of ${totalItems} ${itemLabel}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
          Prev
        </Button>
        <span className="min-w-20 text-center text-sm tabular-nums">{`${page} / ${Math.max(totalPages, 1)}`}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
