'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { InfoIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  type Issue,
  type IssueStatus,
} from '@/lib/api/schemas';
import { ISSUE_MODIFY_DENIED_REASON } from '@/lib/authz/can';
import { useCan } from '@/lib/authz/useCan';
import { notifyError } from '@/lib/forms/handleFormError';
import { useUpdateIssue } from '../../mutations';
import { useBoardIssues } from '../../queries';
import { UNASSIGNED } from '../../schemas';
import { useIssueFilters } from '../../useIssueFilters';
import { CreateIssueDialog } from '../CreateIssueDialog';
import { IssueFilterBar } from '../IssueFilterBar';
import { BoardCardBody } from './BoardCard';
import { BoardColumn } from './BoardColumn';

function isStatus(value: unknown): value is IssueStatus {
  return typeof value === 'string' && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function BoardView({ projectId }: { projectId: string }) {
  const { data, isLoading, error, refetch } = useBoardIssues(projectId);
  const canUpdate = useCan('issues.update', { projectId });
  const canCreate = useCan('issues.create', { projectId });
  const updateIssue = useUpdateIssue(projectId);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [createStatus, setCreateStatus] = useState<IssueStatus | null>(null);
  const filters = useIssueFilters();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const allIssues = data?.data ?? [];
  const issues = allIssues.filter(
    (issue) =>
      (filters.values.priority.length === 0 || filters.values.priority.includes(issue.priority)) &&
      (filters.values.assignee.length === 0 ||
        filters.values.assignee.includes(issue.assignee?.id ?? UNASSIGNED)),
  );
  const titleOf = (id: string | number) =>
    issues.find((issue) => issue.id === id)?.title ?? 'Issue';
  const columnOf = (id: string | number | undefined) =>
    isStatus(id) ? ISSUE_STATUS_LABELS[id] : 'no column';

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => `${titleOf(active.id)} is over ${columnOf(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} was moved to ${columnOf(over.id)}.`
        : `${titleOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveIssue((active.data.current?.issue as Issue | undefined) ?? null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveIssue(null);
    const issue = active.data.current?.issue as Issue | undefined;
    if (!issue || !isStatus(over?.id) || over.id === issue.status) return;
    const status = over.id;
    updateIssue.mutate(
      { issueId: issue.id, input: { status } },
      {
        onSuccess: () => toast.success(`Moved to ${ISSUE_STATUS_LABELS[status]}`),
        onError: notifyError,
      },
    );
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!canUpdate ? (
          <Alert className="w-auto max-w-xl">
            <InfoIcon />
            <AlertDescription>Read-only board. {ISSUE_MODIFY_DENIED_REASON}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            Drag cards between columns to change their status.
          </p>
        )}
        {canCreate && (
          <Button onClick={() => setCreateStatus('ToDo')}>
            <PlusIcon data-icon="inline-start" />
            New issue
          </Button>
        )}
      </div>

      <IssueFilterBar
        projectId={projectId}
        keys={['priority', 'assignee']}
        values={filters.values}
        onChange={filters.setFilter}
        onClear={filters.clearFilters}
      />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveIssue(null)}
        accessibility={{ announcements }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {ISSUE_STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              issues={issues.filter((issue) => issue.status === status)}
              isLoading={isLoading}
              canDrag={canUpdate}
              canCreate={canCreate}
              onCreate={setCreateStatus}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeIssue ? <BoardCardBody issue={activeIssue} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {data && data.meta.pagination.totalItems > allIssues.length && (
        <p className="text-xs text-muted-foreground">
          Showing the {allIssues.length} most recently updated issues. Use the Issues tab to see
          everything.
        </p>
      )}

      <CreateIssueDialog
        projectId={projectId}
        open={createStatus !== null}
        defaultStatus={createStatus ?? 'ToDo'}
        onOpenChange={(open) => !open && setCreateStatus(null)}
      />
    </div>
  );
}
