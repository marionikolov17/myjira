'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** API sort field; when set the header becomes a sort toggle. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  sort?: string | null;
  onSortChange?: (sort: string | null) => void;
  empty?: ReactNode;
  caption?: string;
  skeletonRows?: number;
};

const MotionRow = motion.create(TableRow);

function nextSort(current: string | null | undefined, key: string): string | null {
  if (current === key) return `-${key}`;
  if (current === `-${key}`) return null;
  return key;
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === 'asc') return <ArrowUpIcon data-icon="inline-end" aria-hidden="true" />;
  if (direction === 'desc') return <ArrowDownIcon data-icon="inline-end" aria-hidden="true" />;
  return <ArrowUpDownIcon data-icon="inline-end" aria-hidden="true" className="opacity-50" />;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  onRowClick,
  rowLabel,
  sort,
  onSortChange,
  empty,
  caption,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  const showEmpty = !isLoading && rows !== undefined && rows.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const direction =
                column.sortKey && sort === column.sortKey
                  ? 'asc'
                  : column.sortKey && sort === `-${column.sortKey}`
                    ? 'desc'
                    : null;
              return (
                <TableHead
                  key={column.id}
                  className={cn('h-11 px-4', column.headerClassName)}
                  aria-sort={
                    column.sortKey
                      ? direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                >
                  {column.sortKey && onSortChange ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2.5"
                      onClick={() => onSortChange(nextSort(sort, column.sortKey as string))}
                    >
                      {column.header}
                      <SortIcon direction={direction} />
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableCell key={column.id} className="px-4 py-3">
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {showEmpty && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          )}
          <AnimatePresence initial={false}>
            {!isLoading &&
              rows?.map((row) => (
                <MotionRow
                  key={getRowId(row)}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'link' : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event: KeyboardEvent<HTMLTableRowElement>) => handleKeyDown(event, row)
                      : undefined
                  }
                  className={cn(
                    onRowClick &&
                      'cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none',
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn('px-4 py-3', column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </MotionRow>
              ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
