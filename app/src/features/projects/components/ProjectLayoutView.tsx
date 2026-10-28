'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/ErrorState'
import { InlineEditText } from '@/components/common/InlineEditText'
import { NoAccessState } from '@/components/common/NoAccessState'
import { Breadcrumbs, type Crumb } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isForbiddenOrNotFound } from '@/lib/api/schemas'
import { useCan } from '@/lib/authz/useCan'
import { notifyError } from '@/lib/forms/handleFormError'
import { shortIssueId } from '@/lib/format'
import { useUpdateProject } from '../mutations'
import { useProject } from '../queries'
import { createProjectInputSchema } from '../schemas'
import { ProjectSubNav } from './ProjectSubNav'

const TAB_LABELS: Record<string, string> = {
  board: 'Board',
  issues: 'Issues',
  members: 'Members',
  settings: 'Settings',
}

export function ProjectLayoutView({ children }: { children: ReactNode }) {
  const { projectId, issueId } = useParams<{ projectId: string; issueId?: string }>()
  const pathname = usePathname()
  const { data: project, isLoading, error, refetch } = useProject(projectId)
  const canUpdate = useCan('projects.update', { projectId })
  const updateProject = useUpdateProject(projectId)

  if (error) {
    return isForbiddenOrNotFound(error) ? (
      <NoAccessState>
        <Button variant="outline" nativeButton={false} render={<Link href="/projects" />}>
          Back to projects
        </Button>
      </NoAccessState>
    ) : (
      <ErrorState error={error} onRetry={() => refetch()} />
    )
  }

  const tab = pathname.split('/')[3] ?? 'board'
  const crumbs: Crumb[] = [
    { label: 'Projects', href: '/projects' },
    { label: project?.name ?? null, href: `/projects/${projectId}/board` },
    { label: TAB_LABELS[tab] ?? 'Board', href: issueId ? `/projects/${projectId}/issues` : undefined },
  ]
  if (issueId) crumbs.push({ label: shortIssueId(issueId) })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={crumbs} />
        {isLoading || !project ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <InlineEditText
              value={project.name}
              schema={createProjectInputSchema.shape.name}
              canEdit={canUpdate}
              label="project name"
              onSave={(name) =>
                updateProject.mutateAsync(
                  { name },
                  { onSuccess: () => toast.success('Project renamed'), onError: notifyError },
                )
              }
            />
            {project.description && (
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{project.description}</p>
            )}
          </div>
        )}
        <ProjectSubNav projectId={projectId} />
      </div>
      {project ? children : null}
    </div>
  )
}
