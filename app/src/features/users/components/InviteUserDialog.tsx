'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
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
import {
  createUserInputSchema,
  type CreateUserInput,
  type CreateUserResponse,
} from '@/lib/api/schemas';
import { invitableWorkspaceRoles } from '@/lib/authz/can';
import { useActor } from '@/lib/authz/useCan';
import { handleFormError } from '@/lib/forms/handleFormError';
import { WORKSPACE_ROLE_LABELS } from '@/lib/labels/roles';
import { useWorkspaceRoles, workspaceRoleByName } from '@/features/roles/queries';
import { useCreateUser } from '../mutations';

type InviteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (invite: CreateUserResponse) => void;
};

export function InviteUserDialog({ open, onOpenChange, onInvited }: InviteUserDialogProps) {
  const actor = useActor();
  const workspaceRoles = useWorkspaceRoles();
  const invitableNames = invitableWorkspaceRoles(actor);

  const roleOptions = useMemo(
    () =>
      invitableNames.flatMap((name) => {
        const role = workspaceRoleByName(workspaceRoles.data, name);
        return role ? [{ value: role.id, label: WORKSPACE_ROLE_LABELS[name] }] : [];
      }),
    [invitableNames, workspaceRoles.data],
  );

  const createUser = useCreateUser();

  const defaultValues: CreateUserInput = {
    name: '',
    email: '',
    workspaceRoleId: roleOptions[0]?.value ?? '',
  };
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserInputSchema),
    defaultValues,
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (!open) return;
    const current = form.getValues('workspaceRoleId');
    if (!current && roleOptions[0]) form.setValue('workspaceRoleId', roleOptions[0].value);
  }, [open, roleOptions, form]);

  const handleOpenChange = (next: boolean) => {
    if (createUser.isPending) return;
    if (!next) form.reset({ ...defaultValues, workspaceRoleId: roleOptions[0]?.value ?? '' });
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit((values) =>
    createUser.mutate(values, {
      onSuccess: (invite) => {
        toast.success(`Invited ${invite.user.name}`);
        form.reset({ ...defaultValues, workspaceRoleId: roleOptions[0]?.value ?? '' });
        onOpenChange(false);
        onInvited(invite);
      },
      onError: (error) => handleFormError(error, form),
    }),
  );

  const rolesReady = roleOptions.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              They&apos;ll be added as pending. You&apos;ll get a one-time activation link to share.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="invite-name">Name</FieldLabel>
              <Input
                id="invite-name"
                autoComplete="off"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(errors.email) || undefined}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={Boolean(errors.workspaceRoleId) || undefined}>
              <FieldLabel htmlFor="invite-role">Workspace role</FieldLabel>
              <Controller
                control={form.control}
                name="workspaceRoleId"
                render={({ field }) => (
                  <OptionSelect
                    id="invite-role"
                    ariaLabel="Workspace role"
                    value={field.value}
                    options={roleOptions}
                    onChange={field.onChange}
                    disabled={roleOptions.length <= 1}
                    invalid={Boolean(errors.workspaceRoleId)}
                  />
                )}
              />
              <FieldError errors={[errors.workspaceRoleId]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createUser.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending || !rolesReady}>
              {createUser.isPending && <Spinner data-icon="inline-start" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
