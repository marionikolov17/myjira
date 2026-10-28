'use client';

import { RoleBadge } from '@/components/common/RoleBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyOpenIssues } from '@/features/issues/queries';
import { useProjects } from '@/features/projects/queries';
import { useUser } from '@/features/users/queries';
import { useActor } from '@/lib/authz/useCan';
import { ErrorState } from '@/components/common/ErrorState';
import { MyOpenIssuesCard } from './MyOpenIssuesCard';
import { MyProjectsCard } from './MyProjectsCard';
import { PriorityDonutCard } from './PriorityDonutCard';
import { WelcomeCard } from './WelcomeCard';

export const DASHBOARD_PROJECTS_QUERY = { page: 1, pageSize: 6, sort: '-updatedAt' };

export function DashboardView() {
  const actor = useActor();
  const { data: me } = useUser(actor?.userId);
  const projects = useProjects(DASHBOARD_PROJECTS_QUERY);
  const projectList = projects.data?.data ?? [];
  const openIssues = useMyOpenIssues(
    projectList.map((project) => project.id),
    actor?.userId,
  );

  const firstName = me?.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {firstName ? `Welcome back, ${firstName}` : <Skeleton className="h-8 w-56" />}
        </h1>
        {actor && <RoleBadge scope="workspace" role={actor.workspaceRole.name} />}
      </header>

      {projects.error ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : !projects.isLoading && projectList.length === 0 ? (
        <WelcomeCard />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MyOpenIssuesCard
              issues={openIssues.issues}
              projects={projectList}
              isLoading={projects.isLoading || openIssues.isLoading}
              error={openIssues.error}
              onRetry={openIssues.refetch}
            />
          </div>
          <PriorityDonutCard
            issues={openIssues.issues}
            isLoading={projects.isLoading || openIssues.isLoading}
          />
          <div className="lg:col-span-3">
            <MyProjectsCard projects={projectList} isLoading={projects.isLoading} />
          </div>
        </div>
      )}
    </div>
  );
}
