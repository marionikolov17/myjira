'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { handleFormError } from '@/lib/forms/handleFormError'
import { useCreateProject } from '../mutations'
import { createProjectInputSchema, type CreateProjectInput } from '../schemas'

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const createProject = useCreateProject()
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectInputSchema),
    defaultValues: { name: '', description: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    createProject.mutate(values, {
      onSuccess: (project) => {
        toast.success(`Project "${project.name}" created`)
        setOpen(false)
        form.reset()
        router.push(`/projects/${project.id}/board`)
      },
      onError: (error) => handleFormError(error, form),
    }),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New project
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>You&apos;ll become the Project Owner.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input id="project-name" autoFocus aria-invalid={Boolean(errors.name) || undefined} {...form.register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Textarea
                id="project-description"
                rows={4}
                aria-invalid={Boolean(errors.description) || undefined}
                {...form.register('description')}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending && <Spinner data-icon="inline-start" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
