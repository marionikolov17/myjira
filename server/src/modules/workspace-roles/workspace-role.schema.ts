import { z } from 'zod';

export enum WorkspaceRoleName {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  DEVELOPER = 'Developer',
}

export const WorkspaceRoleSchema = z
  .object({
    id: z.uuid(),
    name: z.enum(Object.values(WorkspaceRoleName)),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
