'use client';

import { ArrowLeftIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DisabledReason } from '@/components/common/DisabledReason';
import { ErrorState } from '@/components/common/ErrorState';
import { InlineEditText } from '@/components/common/InlineEditText';
import { NoAccessState } from '@/components/common/NoAccessState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { isForbiddenOrNotFound, type Issue, type UpdateIssueInput } from '@/lib/api/schemas';
import { ISSUE_MODIFY_DENIED_REASON } from '@/lib/authz/can';
import { useCan } from '@/lib/authz/useCan';
import { formatDateTime, shortIssueId } from '@/lib/format';
import { notifyError } from '@/lib/forms/handleFormError';
import { useDeleteIssue, useUpdateIssue } from '../../mutations';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../../options';
import { useIssue } from '../../queries';
import { AssigneeSelect } from '../AssigneeSelect';
import { DescriptionEditor } from './DescriptionEditor';

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');

function MetaRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}

export function IssueDetailView({ projectId, issueId }: { projectId: string; issueId: string }) {
  const router = useRouter();
  const { data: issue, isLoading, error, refetch } = useIssue(projectId, issueId);
  const canUpdate = useCan('issues.update', { projectId });
  const canDelete = useCan('issues.delete', { projectId });
  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (error) {
    return isForbiddenOrNotFound(error) ? (
      <NoAccessState>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/projects/${projectId}/issues`} />}
        >
          Back to issues
        </Button>
      </NoAccessState>
    ) : (
      <ErrorState error={error} onRetry={() => refetch()} />
    );
  }
  if (isLoading || !issue) return <DetailSkeleton />;

  const save = async (input: UpdateIssueInput, optimistic?: Partial<Issue>): Promise<boolean> => {
    try {
      await updateIssue.mutateAsync({ issueId, input, optimistic });
      toast.success('Issue updated');
      return true;
    } catch (mutationError) {
      notifyError(mutationError);
      return false;
    }
  };

  const onDelete = () =>
    deleteIssue.mutate(issueId, {
      onSuccess: () => {
        toast.success('Issue deleted');
        router.replace(`/projects/${projectId}/board`);
      },
      onError: notifyError,
    });

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/projects/${projectId}/board`} />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to board
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <article className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">
              {shortIssueId(issue.id)}
            </span>
            <InlineEditText
              value={issue.title}
              schema={titleSchema}
              canEdit={canUpdate}
              label="issue title"
              as="h1"
              className="text-2xl font-semibold tracking-tight text-balance"
              onSave={(title) => save({ title })}
            />
          </div>
          <Separator />
          <DescriptionEditor
            value={issue.description}
            canEdit={canUpdate}
            onSave={(description) => save({ description })}
          />
        </article>

        <aside className="flex flex-col gap-4" aria-label="Issue details">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              {!canUpdate && <CardDescription>{ISSUE_MODIFY_DENIED_REASON}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <MetaRow label="Status" htmlFor="issue-status">
                <DisabledReason disabled={!canUpdate} reason={ISSUE_MODIFY_DENIED_REASON}>
                  <OptionSelect
                    id="issue-status"
                    ariaLabel="Status"
                    value={issue.status}
                    options={STATUS_OPTIONS}
                    disabled={!canUpdate}
                    className="w-full"
                    onChange={(status) => void save({ status })}
                  />
                </DisabledReason>
              </MetaRow>
              <MetaRow label="Priority" htmlFor="issue-priority">
                <DisabledReason disabled={!canUpdate} reason={ISSUE_MODIFY_DENIED_REASON}>
                  <OptionSelect
                    id="issue-priority"
                    ariaLabel="Priority"
                    value={issue.priority}
                    options={PRIORITY_OPTIONS}
                    disabled={!canUpdate}
                    className="w-full"
                    onChange={(priority) => void save({ priority })}
                  />
                </DisabledReason>
              </MetaRow>
              <MetaRow label="Assignee" htmlFor="issue-assignee">
                <DisabledReason disabled={!canUpdate} reason={ISSUE_MODIFY_DENIED_REASON}>
                  <AssigneeSelect
                    id="issue-assignee"
                    projectId={projectId}
                    value={issue.assignee}
                    disabled={!canUpdate}
                    className="w-full"
                    onChange={(assignee) =>
                      void save({ assigneeId: assignee?.id ?? null }, { assignee })
                    }
                  />
                </DisabledReason>
              </MetaRow>
              <Separator />
              <MetaRow label="Creator">
                <div className="flex items-center gap-2 text-sm">
                  <UserAvatar user={issue.creator} size="sm" decorative />
                  <span className="truncate">{issue.creator.name}</span>
                </div>
              </MetaRow>
              <MetaRow label="Created">
                <time dateTime={issue.createdAt} className="text-sm">
                  {formatDateTime(issue.createdAt)}
                </time>
              </MetaRow>
              <MetaRow label="Updated">
                <time dateTime={issue.updatedAt} className="text-sm">
                  {formatDateTime(issue.updatedAt)}
                </time>
              </MetaRow>
            </CardContent>
          </Card>

          {canDelete && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>Deleting an issue is permanent.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete issue
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this issue?"
        description={`"${issue.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete issue"
        pending={deleteIssue.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}
