'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanbanIcon } from 'lucide-react';
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginationBar } from '@/components/common/PaginationBar';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useProjects } from '../queries';
import { PROJECT_SORT_OPTIONS, PROJECT_SORT_VALUES, PROJECTS_PAGE_SIZE } from '../schemas';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectCard } from './ProjectCard';

const searchParams = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(PROJECT_SORT_VALUES).withDefault('-updatedAt'),
};

export function ProjectsView() {
  const [{ page, sort }, setParams] = useQueryStates(searchParams);
  const { data, isLoading, error, refetch } = useProjects({
    page,
    pageSize: PROJECTS_PAGE_SIZE,
    sort,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Everything your team is working on."
        actions={
          <>
            <OptionSelect
              value={sort}
              options={PROJECT_SORT_OPTIONS}
              onChange={(next) => setParams({ sort: next, page: 1 })}
              ariaLabel="Sort projects"
              className="w-48"
            />
            <PermissionGate action="projects.create">
              <CreateProjectDialog />
            </PermissionGate>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No projects yet"
          description="Create a project to start tracking work."
        >
          <PermissionGate action="projects.create">
            <CreateProjectDialog />
          </PermissionGate>
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {data.data.map((project) => (
                <motion.li
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <ProjectCard project={project} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <PaginationBar
            pagination={data.meta.pagination}
            onPageChange={(next) => setParams({ page: next })}
            itemLabel="projects"
          />
        </>
      )}
    </div>
  );
}
