'use client';

import { ListIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type DataTableColumn, DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PaginationBar } from '@/components/common/PaginationBar';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import type { Issue, ListFilter, ListQuery } from '@/lib/api/schemas';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { formatRelative, shortIssueId } from '@/lib/format';
import { useProjectIssues } from '../queries';
import { ISSUES_PAGE_SIZE } from '../schemas';
import { useIssueFilters, type IssueFilterValues } from '../useIssueFilters';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueFilterBar } from './IssueFilterBar';

function buildFilter(values: IssueFilterValues): ListFilter | undefined {
  const filter: ListFilter = {};
  if (values.status.length) filter.status = { in: values.status };
  if (values.priority.length) filter.priority = { in: values.priority };
  if (values.assignee.length) filter.assigneeId = { in: values.assignee };
  if (values.creator.length) filter.creatorId = { in: values.creator };
  return Object.keys(filter).length > 0 ? filter : undefined;
}

export function IssuesTableView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const filters = useIssueFilters();
  const [createOpen, setCreateOpen] = useState(false);
  const filter = buildFilter(filters.values);

  const query: ListQuery = {
    page: filters.page,
    pageSize: ISSUES_PAGE_SIZE,
    sort: filters.sort,
    filter,
  };
  const { data, isLoading, error, refetch } = useProjectIssues(projectId, query);

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
              <EmptyState
                icon={ListIcon}
                title={filter ? 'No issues match these filters' : 'No issues yet'}
                description={
                  filter
                    ? 'Try removing a filter.'
                    : 'Issues created in this project will appear here.'
                }
              >
                {filter && (
                  <Button variant="outline" onClick={filters.clearFilters}>
                    Clear filters
                  </Button>
                )}
              </EmptyState>
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
