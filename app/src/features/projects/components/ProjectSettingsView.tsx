'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { NoAccessState } from '@/components/common/NoAccessState';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { Project } from '@/lib/api/schemas';
import { useCan } from '@/lib/authz/useCan';
import { handleFormError, notifyError } from '@/lib/forms/handleFormError';
import { useDeleteProject, useUpdateProject } from '../mutations';
import { useProject } from '../queries';
import { createProjectInputSchema, type CreateProjectInput } from '../schemas';

function DetailsForm({ project, canUpdate }: { project: Project; canUpdate: boolean }) {
  const updateProject = useUpdateProject(project.id);
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectInputSchema),
    values: { name: project.name, description: project.description },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    updateProject.mutate(values, {
      onSuccess: () => toast.success('Project updated'),
      onError: (error) => handleFormError(error, form),
    }),
  );

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            {canUpdate
              ? 'Rename the project or update its description.'
              : 'Only the project owner can edit these.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field
              data-invalid={errors.name ? true : undefined}
              data-disabled={!canUpdate || undefined}
            >
              <FieldLabel htmlFor="settings-name">Name</FieldLabel>
              <Input
                id="settings-name"
                disabled={!canUpdate}
                aria-invalid={errors.name ? true : undefined}
                {...form.register('name')}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
            <Field
              data-invalid={errors.description ? true : undefined}
              data-disabled={!canUpdate || undefined}
            >
              <FieldLabel htmlFor="settings-description">Description</FieldLabel>
              <Textarea
                id="settings-description"
                rows={4}
                disabled={!canUpdate}
                aria-invalid={errors.description ? true : undefined}
                {...form.register('description')}
              />
              <FieldError>{errors.description?.message}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
        {canUpdate && (
          <CardFooter className="mt-6 justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!isDirty || updateProject.isPending}
              onClick={() => form.reset()}
            >
              Reset
            </Button>
            <Button type="submit" disabled={!isDirty || updateProject.isPending}>
              {updateProject.isPending && <Spinner data-icon="inline-start" />}
              Save changes
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}

function DangerZone({ project }: { project: Project }) {
  const router = useRouter();
  const deleteProject = useDeleteProject(project.id);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === project.name;

  const onConfirm = () =>
    deleteProject.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Project "${project.name}" deleted`);
        router.replace('/projects');
      },
      onError: notifyError,
    });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          Deleting a project permanently removes its members and issues.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2Icon data-icon="inline-start" />
          Delete project
        </Button>
      </CardFooter>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped('');
        }}
        title="Delete project?"
        description="This action cannot be undone. All issues and memberships will be removed."
        confirmLabel="Delete project"
        confirmDisabled={!matches}
        pending={deleteProject.isPending}
        onConfirm={onConfirm}
      >
        <Field data-invalid={typed.length > 0 && !matches ? true : undefined}>
          <FieldLabel htmlFor="confirm-project-name">
            Type <span className="font-mono font-semibold">{project.name}</span> to confirm
          </FieldLabel>
          <Input
            id="confirm-project-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            aria-invalid={typed.length > 0 && !matches ? true : undefined}
          />
          {typed.length > 0 && !matches && (
            <FieldDescription>The name doesn&apos;t match.</FieldDescription>
          )}
        </Field>
      </ConfirmDialog>
    </Card>
  );
}

export function ProjectSettingsView({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const canUpdate = useCan('projects.update', { projectId });
  const canDelete = useCan('projects.delete', { projectId });

  if (!canUpdate && !canDelete) return <NoAccessState />;
  if (!project) return <Skeleton className="h-72 w-full max-w-2xl rounded-2xl" />;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <DetailsForm project={project} canUpdate={canUpdate} />
      {canDelete && <DangerZone project={project} />}
    </div>
  );
}
