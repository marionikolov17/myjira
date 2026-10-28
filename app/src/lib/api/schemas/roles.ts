import { z } from 'zod';

export const WORKSPACE_ROLE_NAMES = ['Owner', 'Admin', 'Developer'] as const;
export const workspaceRoleNameSchema = z.enum(WORKSPACE_ROLE_NAMES);
export type WorkspaceRoleName = z.infer<typeof workspaceRoleNameSchema>;

export const PROJECT_ROLE_NAMES = ['ProjectOwner', 'ProjectAdmin', 'Developer'] as const;
export const projectRoleNameSchema = z.enum(PROJECT_ROLE_NAMES);
export type ProjectRoleName = z.infer<typeof projectRoleNameSchema>;

export const WORKSPACE_ROLE_IDS: Record<WorkspaceRoleName, string> = {
  Owner: '00000000-0000-4000-8000-000000000001',
  Admin: '00000000-0000-4000-8000-000000000002',
  Developer: '00000000-0000-4000-8000-000000000003',
};

export const PROJECT_ROLE_IDS: Record<ProjectRoleName, string> = {
  ProjectOwner: '00000000-0000-4000-8000-000000000011',
  ProjectAdmin: '00000000-0000-4000-8000-000000000012',
  Developer: '00000000-0000-4000-8000-000000000013',
};

function invert<K extends string>(record: Record<K, string>): Record<string, K> {
  return Object.fromEntries(Object.entries(record).map(([name, id]) => [id, name])) as Record<
    string,
    K
  >;
}

const workspaceRoleNamesById = invert(WORKSPACE_ROLE_IDS);
const projectRoleNamesById = invert(PROJECT_ROLE_IDS);

export function workspaceRoleNameById(id: string): WorkspaceRoleName | undefined {
  return workspaceRoleNamesById[id];
}

export function projectRoleNameById(id: string): ProjectRoleName | undefined {
  return projectRoleNamesById[id];
}

export const PROJECT_ROLE_LABELS: Record<ProjectRoleName, string> = {
  ProjectOwner: 'Project Owner',
  ProjectAdmin: 'Project Admin',
  Developer: 'Developer',
};
