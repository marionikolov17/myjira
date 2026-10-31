'use client';

import { FolderKanbanIcon, LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout } from '@/features/auth/mutations';
import { useProject } from '@/features/projects/queries';
import { useUser } from '@/features/users/queries';
import type { ActorContext } from '@/lib/api/schemas';
import { useActor } from '@/lib/authz/useCan';

type Membership = ActorContext['projectRoles'][number];

export function ProfileView() {
  const actor = useActor();
  const { data: user, isLoading, error, refetch } = useUser(actor?.userId);
  const logout = useLogout();

  const columns: DataTableColumn<Membership>[] = [
    {
      id: 'project',
      header: 'Project',
      cell: (membership) => <MembershipProjectCell membership={membership} />,
    },
    {
      id: 'role',
      header: 'Project role',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (membership) => <RoleBadge scope="project" role={membership.projectRoleName} />,
    },
  ];

  if (!actor) return null;

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Profile" description="Your account and project access." />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description="Your account and project access." />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <UserAvatar user={user ?? null} size="lg" decorative />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {user ? (
              <>
                <p className="truncate text-lg font-semibold">{user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </>
            ) : isLoading ? (
              <>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : null}
          </div>
          <RoleBadge scope="workspace" role={actor.workspaceRole.name} />
          <Button variant="outline" onClick={() => logout()}>
            <LogOutIcon data-icon="inline-start" />
            Log out
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Project memberships</h2>
          <p className="text-sm text-muted-foreground">
            {actor.projectRoles.length} {actor.projectRoles.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        <DataTable
          columns={columns}
          rows={actor.projectRoles}
          getRowId={(membership) => membership.projectId}
          caption="Project memberships"
          skeletonRows={3}
          empty={
            <EmptyState
              icon={FolderKanbanIcon}
              title="No project memberships"
              description="You'll see projects here once you're added to one."
            />
          }
        />
      </div>
    </div>
  );
}

function MembershipProjectCell({ membership }: { membership: Membership }) {
  const { data: project, isLoading, error } = useProject(membership.projectId);

  if (isLoading) return <Skeleton className="h-4 w-40" />;

  if (project) {
    return (
      <Link
        href={`/projects/${project.id}/board`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {project.name}
      </Link>
    );
  }

  return (
    <span className="text-muted-foreground">
      {error ? 'Unavailable project' : 'Unknown project'}
    </span>
  );
}
