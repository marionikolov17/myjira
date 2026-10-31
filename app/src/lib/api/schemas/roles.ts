import { z } from 'zod';
import { timestampSchema } from './common';

export const WORKSPACE_ROLE_NAMES = ['Owner', 'Admin', 'Developer'] as const;
export const workspaceRoleNameSchema = z.enum(WORKSPACE_ROLE_NAMES);
export type WorkspaceRoleName = z.infer<typeof workspaceRoleNameSchema>;

export const PROJECT_ROLE_NAMES = ['ProjectOwner', 'ProjectAdmin', 'Developer'] as const;
export const projectRoleNameSchema = z.enum(PROJECT_ROLE_NAMES);
export type ProjectRoleName = z.infer<typeof projectRoleNameSchema>;

export const workspaceRoleSchema = z.object({
  id: z.uuid(),
  name: workspaceRoleNameSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const projectRoleSchema = z.object({
  id: z.uuid(),
  name: projectRoleNameSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type ProjectRole = z.infer<typeof projectRoleSchema>;
