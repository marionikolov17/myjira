'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanbanIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginationBar } from '@/components/common/PaginationBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ListFilter, ListQuery } from '@/lib/api/schemas';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useProjects } from '../queries';
import { PROJECTS_PAGE_SIZE, PROJECT_SORT_OPTIONS } from '../schemas';
import { useProjectFilters, type ProjectFilterValues } from '../useProjectFilters';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectCard } from './ProjectCard';
import { ProjectFilterBar } from './ProjectFilterBar';

function buildFilter(values: ProjectFilterValues): ListFilter | undefined {
  if (values.creator.length === 0) return undefined;
  return { creatorId: { in: values.creator } };
}

export function ProjectsView() {
  const filters = useProjectFilters();

  const filter = buildFilter(filters.values);
  const query: ListQuery = {
    page: filters.page,
    pageSize: PROJECTS_PAGE_SIZE,
    sort: filters.sort,
    filter,
  };

  const { data, isLoading, error, refetch } = useProjects(query);

  const anyFilterActive = filters.values.creator.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Everything your team is working on."
        actions={
          <>
            <OptionSelect
              value={filters.sort}
              options={PROJECT_SORT_OPTIONS}
              onChange={filters.setSort}
              ariaLabel="Sort projects"
              className="w-48"
            />
            <PermissionGate action="projects.create">
              <CreateProjectDialog />
            </PermissionGate>
          </>
        }
      />

      <ProjectFilterBar
        keys={['creator']}
        values={filters.values}
        onChange={filters.setFilter}
        onClear={filters.clearFilters}
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
          title={anyFilterActive ? 'No projects match these filters' : 'No projects yet'}
          description={
            anyFilterActive ? 'Try removing a filter.' : 'Create a project to start tracking work.'
          }
        >
          {anyFilterActive ? (
            <Button variant="outline" onClick={filters.clearFilters}>
              Clear filters
            </Button>
          ) : (
            <PermissionGate action="projects.create">
              <CreateProjectDialog />
            </PermissionGate>
          )}
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
            onPageChange={filters.setPage}
            itemLabel="projects"
          />
        </>
      )}
    </div>
  );
}
