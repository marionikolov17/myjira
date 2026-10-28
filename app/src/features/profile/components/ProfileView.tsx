'use client';

import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLogout } from '@/features/auth/mutations';
import { useProject } from '@/features/projects/queries';
import { useUser } from '@/features/users/queries';
import type { ActorContext } from '@/lib/api/schemas';
import { useActor } from '@/lib/authz/useCan';

type Membership = ActorContext['projectRoles'][number];

function MembershipRow({ membership }: { membership: Membership }) {
  const { data: project, isLoading, error } = useProject(membership.projectId);
  return (
    <TableRow>
      <TableCell>
        {isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : project ? (
          <Link
            href={`/projects/${project.id}/board`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">
            {error ? 'Unavailable project' : 'Unknown project'}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <RoleBadge scope="project" role={membership.projectRoleName} />
      </TableCell>
    </TableRow>
  );
}

export function ProfileView() {
  const actor = useActor();
  const { data: user } = useUser(actor?.userId);
  const logout = useLogout();

  if (!actor) return null;

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
            ) : (
              <>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </>
            )}
          </div>
          <RoleBadge scope="workspace" role={actor.workspaceRole.name} />
          <Button variant="outline" onClick={() => logout()}>
            <LogOutIcon data-icon="inline-start" />
            Log out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project memberships</CardTitle>
          <CardDescription>
            {actor.projectRoles.length === 0
              ? "You aren't a member of any project yet."
              : `You belong to ${actor.projectRoles.length} ${actor.projectRoles.length === 1 ? 'project' : 'projects'}.`}
          </CardDescription>
        </CardHeader>
        {actor.projectRoles.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Project role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actor.projectRoles.map((membership) => (
                  <MembershipRow key={membership.projectId} membership={membership} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
