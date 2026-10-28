'use client';

import { CircleCheckBigIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Issue, Project } from '@/lib/api/schemas';
import { formatRelative } from '@/lib/format';

type MyOpenIssuesCardProps = {
  issues: Issue[];
  projects: Project[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
};

export function MyOpenIssuesCard({
  issues,
  projects,
  isLoading,
  error,
  onRetry,
}: MyOpenIssuesCardProps) {
  const router = useRouter();
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const columns: DataTableColumn<Issue>[] = [
    {
      id: 'project',
      header: 'Project',
      cell: (issue) => (
        <Badge variant="outline" className="max-w-32 truncate">
          {projectNames.get(issue.projectId) ?? 'Project'}
        </Badge>
      ),
    },
    {
      id: 'title',
      header: 'Title',
      cell: (issue) => <span className="line-clamp-1 font-medium">{issue.title}</span>,
    },
    { id: 'status', header: 'Status', cell: (issue) => <StatusBadge status={issue.status} /> },
    {
      id: 'priority',
      header: 'Priority',
      cell: (issue) => <PriorityBadge priority={issue.priority} />,
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: (issue) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatRelative(issue.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>My open issues</CardTitle>
        <CardDescription>To do and in progress, assigned to you.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <DataTable
            columns={columns}
            rows={issues}
            isLoading={isLoading}
            skeletonRows={5}
            getRowId={(issue) => issue.id}
            rowLabel={(issue) => `Open issue ${issue.title}`}
            onRowClick={(issue) => router.push(`/projects/${issue.projectId}/issues/${issue.id}`)}
            caption="Open issues assigned to you"
            empty={
              <EmptyState
                icon={CircleCheckBigIcon}
                title="All clear"
                description="No open issues are assigned to you."
              />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
