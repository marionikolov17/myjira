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
import type { IssueStatus, UserRef } from '@/lib/api/schemas';
import { handleFormError } from '@/lib/forms/handleFormError';
import { useCreateIssue } from '../mutations';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../options';
import { createIssueFormSchema, type CreateIssueForm } from '../schemas';
import { AssigneeSelect } from './AssigneeSelect';

type CreateIssueDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: IssueStatus;
};

const emptyForm = (status: IssueStatus): CreateIssueForm => ({
  title: '',
  description: '',
  status,
  priority: 'Medium',
  assigneeId: null,
});

export function CreateIssueDialog({
  projectId,
  open,
  onOpenChange,
  defaultStatus = 'ToDo',
}: CreateIssueDialogProps) {
  const createIssue = useCreateIssue(projectId);
  const [assignee, setAssignee] = useState<UserRef | null>(null);
  const form = useForm<CreateIssueForm>({
    resolver: zodResolver(createIssueFormSchema),
    defaultValues: emptyForm(defaultStatus),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(emptyForm(defaultStatus));
      setAssignee(null);
    }
  }, [open, defaultStatus, form]);

  const onSubmit = form.handleSubmit((values) =>
    createIssue.mutate(values, {
      onSuccess: (issue) => {
        toast.success(`Created "${issue.title}"`);
        onOpenChange(false);
      },
      onError: (error) => handleFormError(error, form),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="status"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="issue-status">Status</FieldLabel>
                    <OptionSelect
                      id="issue-status"
                      value={field.value}
                      options={STATUS_OPTIONS}
                      onChange={field.onChange}
                      ariaLabel="Status"
                      invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
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
            </div>
            <Controller
              control={form.control}
              name="assigneeId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="issue-assignee">Assignee</FieldLabel>
                  <AssigneeSelect
                    id="issue-assignee"
                    projectId={projectId}
                    value={assignee}
                    invalid={fieldState.invalid}
                    onChange={(next) => {
                      setAssignee(next);
                      field.onChange(next?.id ?? null);
                    }}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={createIssue.isPending}>
              {createIssue.isPending && <Spinner data-icon="inline-start" />}
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
