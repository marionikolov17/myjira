import type { ProjectRoleName, WorkspaceRoleName } from '@/lib/api/schemas';

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRoleName, string> = {
  Owner: 'Owner',
  Admin: 'Admin',
  Developer: 'Developer',
};

export const PROJECT_ROLE_LABELS: Record<ProjectRoleName, string> = {
  ProjectOwner: 'Project Owner',
  ProjectAdmin: 'Project Admin',
  Developer: 'Developer',
};

/** Display order for project roles in member lists. */
export const PROJECT_ROLE_ORDER: Record<ProjectRoleName, number> = {
  ProjectOwner: 0,
  ProjectAdmin: 1,
  Developer: 2,
};
