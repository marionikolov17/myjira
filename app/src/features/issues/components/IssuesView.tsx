'use client';

import { ListIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type DataTableColumn, DataTable } from '@/components/common/DataTable';
import { ErrorState } from '@/components/common/ErrorState';
import { FilterAwareEmptyState } from '@/components/common/FilterAwareEmptyState';
import { PaginationBar } from '@/components/common/PaginationBar';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import type { Issue } from '@/lib/api/schemas';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { formatRelative, shortIssueId } from '@/lib/format';
import { useProjectIssues } from '../queries';
import { issueFiltersToListQuery, useIssueFilters } from '../useIssueFilters';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueFilterBar } from './IssueFilterBar';

export function IssuesView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const filters = useIssueFilters();
  const [createOpen, setCreateOpen] = useState(false);
  const query = issueFiltersToListQuery(filters);
  const { data, isLoading, error, refetch } = useProjectIssues(projectId, query);
  const filterActive = Boolean(query.filter);

  const columns: DataTableColumn<Issue>[] = [
    {
      id: 'title',
      header: 'Title',
      sortKey: 'title',
      cell: (issue) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{issue.title}</span>
          <span className="font-mono text-xs text-muted-foreground">{shortIssueId(issue.id)}</span>
        </div>
      ),
      className: 'max-w-[22rem]',
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (issue) => <StatusBadge status={issue.status} />,
    },
    {
      id: 'priority',
      header: 'Priority',
      sortKey: 'priority',
      cell: (issue) => <PriorityBadge priority={issue.priority} />,
    },
    {
      id: 'assignee',
      header: 'Assignee',
      cell: (issue) => (
        <div className="flex items-center gap-2">
          <UserAvatar user={issue.assignee} size="sm" decorative />
          <span className="truncate text-sm">{issue.assignee.name}</span>
        </div>
      ),
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      sortKey: 'updatedAt',
      cell: (issue) => (
        <time
          dateTime={issue.updatedAt}
          className="text-sm whitespace-nowrap text-muted-foreground"
        >
          {formatRelative(issue.updatedAt)}
        </time>
      ),
      headerClassName: 'hidden sm:table-cell',
      className: 'hidden sm:table-cell',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IssueFilterBar
          projectId={projectId}
          keys={['status', 'priority', 'assignee', 'creator']}
          values={filters.values}
          onChange={filters.setFilter}
          onClear={filters.clearFilters}
        />
        <PermissionGate action="issues.create" projectId={projectId}>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            New issue
          </Button>
        </PermissionGate>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data}
            getRowId={(issue) => issue.id}
            isLoading={isLoading}
            sort={filters.sort}
            onSortChange={filters.setSort}
            onRowClick={(issue) => router.push(`/projects/${projectId}/issues/${issue.id}`)}
            rowLabel={(issue) => `Open issue ${issue.title}`}
            caption="Project issues"
            skeletonRows={8}
            empty={
              <FilterAwareEmptyState
                icon={ListIcon}
                entityLabel="issues"
                filterActive={filterActive}
                emptyDescription="Issues created in this project will appear here."
                onClearFilters={filters.clearFilters}
              />
            }
          />

          <PaginationBar
            pagination={data?.meta.pagination}
            onPageChange={filters.setPage}
            itemLabel="issues"
          />
        </>
      )}

      <CreateIssueDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
