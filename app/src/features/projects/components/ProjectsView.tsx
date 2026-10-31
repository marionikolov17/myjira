'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanbanIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { FilterAwareEmptyState } from '@/components/common/FilterAwareEmptyState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginationBar } from '@/components/common/PaginationBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useProjects } from '../queries';
import { PROJECT_SORT_OPTIONS } from '../constants';
import { projectFiltersToListQuery, useProjectFilters } from '../hooks/useProjectFilters';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectCard } from './ProjectCard';
import { ProjectFilterBar } from './ProjectFilterBar';

export function ProjectsView() {
  const filters = useProjectFilters();
  const [createOpen, setCreateOpen] = useState(false);
  const query = projectFiltersToListQuery(filters);
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
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                New project
              </Button>
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
        <FilterAwareEmptyState
          icon={FolderKanbanIcon}
          entityLabel="projects"
          filterActive={anyFilterActive}
          emptyDescription="Create a project to start tracking work."
          onClearFilters={filters.clearFilters}
        >
          <PermissionGate action="projects.create">
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              New project
            </Button>
          </PermissionGate>
        </FilterAwareEmptyState>
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

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
