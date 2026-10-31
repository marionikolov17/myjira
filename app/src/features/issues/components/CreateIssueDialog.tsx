'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { OptionSelect } from '@/components/common/OptionSelect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { UserRef } from '@/lib/api/schemas';
import { useMe } from '@/features/auth/queries';
import { handleFormError } from '@/lib/forms/handleFormError';
import { useCreateIssue } from '../mutations';
import { PRIORITY_OPTIONS } from '../options';
import { createIssueFormSchema, type CreateIssueForm } from '../schemas';
import { AssigneeSelect } from './AssigneeSelect';

type CreateIssueDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const emptyForm = (assigneeId: string): CreateIssueForm => ({
  title: '',
  description: '',
  priority: 'Medium',
  assigneeId,
});

export function CreateIssueDialog({ projectId, open, onOpenChange }: CreateIssueDialogProps) {
  const createIssue = useCreateIssue(projectId);
  const { data: me } = useMe();
  // The backend always starts a new issue assigned to someone; default to the current user so
  // the picker never shows an empty state.
  const defaultAssignee: UserRef | null = me ? { id: me.userId, name: 'You', email: '' } : null;
  const [assignee, setAssignee] = useState<UserRef | null>(defaultAssignee);

  const form = useForm<CreateIssueForm>({
    resolver: zodResolver(createIssueFormSchema),
    defaultValues: emptyForm(me?.userId ?? ''),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open && me?.userId) {
      form.reset(emptyForm(me.userId));
      setAssignee(defaultAssignee);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me?.userId]);

  const handleOpenChange = (next: boolean) => {
    if (createIssue.isPending) return;
    if (!next && me?.userId) {
      form.reset(emptyForm(me.userId));
      setAssignee(defaultAssignee);
    }
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit((values) =>
    createIssue.mutate(values, {
      onSuccess: (issue) => {
        toast.success(`Created "${issue.title}"`);
        if (me?.userId) {
          form.reset(emptyForm(me.userId));
          setAssignee(defaultAssignee);
        }
        onOpenChange(false);
      },
      onError: (error) => handleFormError(error, form),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>New issue</DialogTitle>
            <DialogDescription>Describe the work and who should pick it up.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.title) || undefined}>
              <FieldLabel htmlFor="issue-title">Title</FieldLabel>
              <Input
                id="issue-title"
                autoFocus
                aria-invalid={Boolean(errors.title) || undefined}
                {...form.register('title')}
              />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="issue-description">Description</FieldLabel>
              <Textarea
                id="issue-description"
                rows={5}
                aria-invalid={Boolean(errors.description) || undefined}
                {...form.register('description')}
              />
              <FieldError errors={[errors.description]} />
            </Field>
            <Controller
              control={form.control}
              name="priority"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="issue-priority">Priority</FieldLabel>
                  <OptionSelect
                    id="issue-priority"
                    value={field.value}
                    options={PRIORITY_OPTIONS}
                    onChange={field.onChange}
                    ariaLabel="Priority"
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="assigneeId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="issue-assignee">Assignee</FieldLabel>
                  {assignee ? (
                    <AssigneeSelect
                      id="issue-assignee"
                      projectId={projectId}
                      value={assignee}
                      invalid={fieldState.invalid}
                      onChange={(next) => {
                        setAssignee(next);
                        field.onChange(next.id);
                      }}
                    />
                  ) : (
                    <Spinner />
                  )}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createIssue.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createIssue.isPending || !assignee}>
              {createIssue.isPending && <Spinner data-icon="inline-start" />}
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
