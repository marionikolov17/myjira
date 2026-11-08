'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  COMMENT_BODY_MAX_LENGTH,
  createCommentInputSchema,
  type Comment,
  type CreateCommentInput,
} from '@/lib/api/schemas';
import { useActor, useCan } from '@/lib/authz/useCan';
import { formatDateTime } from '@/lib/format';
import { handleFormError, notifyError } from '@/lib/forms/handleFormError';
import { useCreateIssueComment, useDeleteIssueComment } from '../../comments/mutations';
import { useIssueComments } from '../../comments/queries';

type CommentsSectionProps = {
  projectId: string;
  issueId: string;
};

export function CommentsSection({ projectId, issueId }: CommentsSectionProps) {
  const { data: comments, isLoading, error, refetch } = useIssueComments(projectId, issueId);
  const canCreate = useCan('comments.create', { projectId });

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-4">
      <h2 id="comments-heading" className="text-sm font-medium text-muted-foreground">
        Comments
      </h2>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !comments ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem comment={comment} projectId={projectId} issueId={issueId} />
            </li>
          ))}
        </ul>
      )}

      {canCreate && <CommentComposer projectId={projectId} issueId={issueId} />}
    </section>
  );
}

function CommentItem({
  comment,
  projectId,
  issueId,
}: {
  comment: Comment;
  projectId: string;
  issueId: string;
}) {
  const actor = useActor();
  const isAuthor = Boolean(actor && actor.userId === comment.creator.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteComment = useDeleteIssueComment(projectId, issueId);

  const onDelete = () =>
    deleteComment.mutate(comment.id, {
      onSuccess: () => {
        toast.success('Comment deleted');
        setConfirmOpen(false);
      },
      onError: notifyError,
    });

  return (
    <article className="flex gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <UserAvatar user={comment.creator} size="sm" decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="truncate text-sm font-medium">{comment.creator.name}</span>
            <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt)}
            </time>
          </div>
          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete comment"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">{comment.body}</p>
      </div>
      {isAuthor && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this comment?"
          description="This comment will be permanently removed. This cannot be undone."
          confirmLabel="Delete comment"
          pending={deleteComment.isPending}
          onConfirm={onDelete}
        />
      )}
    </article>
  );
}

function CommentComposer({ projectId, issueId }: { projectId: string; issueId: string }) {
  const createComment = useCreateIssueComment(projectId, issueId);
  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentInputSchema),
    defaultValues: { body: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    createComment.mutate(values, {
      onSuccess: () => {
        toast.success('Comment posted');
        form.reset({ body: '' });
      },
      onError: (error) => handleFormError(error, form),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <Field data-invalid={Boolean(errors.body) || undefined}>
        <label htmlFor="comment-body" className="sr-only">
          Add a comment
        </label>
        <Textarea
          id="comment-body"
          rows={3}
          placeholder="Add a comment…"
          maxLength={COMMENT_BODY_MAX_LENGTH}
          aria-invalid={Boolean(errors.body) || undefined}
          disabled={createComment.isPending}
          {...form.register('body')}
        />
        <FieldError errors={[errors.body]} />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={createComment.isPending}>
          {createComment.isPending && <Spinner data-icon="inline-start" />}
          Post comment
        </Button>
      </div>
    </form>
  );
}
