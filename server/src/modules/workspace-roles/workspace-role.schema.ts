import { z } from 'zod';

export enum WorkspaceRoleName {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  DEVELOPER = 'Developer',
}

export const WorkspaceRoleSchema = z.object({
  id: z.uuid(),
  name: z.enum(Object.values(WorkspaceRoleName)),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
