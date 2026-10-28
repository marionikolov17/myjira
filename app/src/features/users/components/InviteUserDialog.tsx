'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { OptionSelect } from '@/components/common/OptionSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { WORKSPACE_ROLE_IDS, type CreateUserResponse } from '@/lib/api/schemas'
import { invitableWorkspaceRoles } from '@/lib/authz/can'
import { useActor } from '@/lib/authz/useCan'
import { handleFormError } from '@/lib/forms/handleFormError'
import { useCreateUser } from '../mutations'
import { createUserInputSchema, type CreateUserInput } from '../schemas'

export function InviteUserDialog({ onInvited }: { onInvited: (invite: CreateUserResponse) => void }) {
  const actor = useActor()
  const roles = invitableWorkspaceRoles(actor)
  const [open, setOpen] = useState(false)
  const createUser = useCreateUser()
  const defaultValues: CreateUserInput = { name: '', email: '', workspaceRoleId: WORKSPACE_ROLE_IDS.Developer }
  const form = useForm<CreateUserInput>({ resolver: zodResolver(createUserInputSchema), defaultValues })
  const { errors } = form.formState

  const handleOpenChange = (next: boolean) => {
    if (createUser.isPending) return
    if (!next) form.reset(defaultValues)
    setOpen(next)
  }

  const onSubmit = form.handleSubmit((values) =>
    createUser.mutate(values, {
      onSuccess: (invite) => {
        toast.success(`Invited ${invite.user.name}`)
        form.reset(defaultValues)
        setOpen(false)
        onInvited(invite)
      },
      onError: (error) => handleFormError(error, form),
    }),
  )

  const roleOptions = roles.map((role) => ({ value: WORKSPACE_ROLE_IDS[role], label: role }))

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MailPlusIcon data-icon="inline-start" />
        Invite user
      </Button>
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
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="invite-name">Name</FieldLabel>
                <Input
                  id="invite-name"
                  autoComplete="off"
                  aria-invalid={errors.name ? true : undefined}
                  {...form.register('name')}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>
              <Field data-invalid={errors.email ? true : undefined}>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  aria-invalid={errors.email ? true : undefined}
                  {...form.register('email')}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </Field>
              <Field data-invalid={errors.workspaceRoleId ? true : undefined}>
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
                <FieldError>{errors.workspaceRoleId?.message}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createUser.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Spinner data-icon="inline-start" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
