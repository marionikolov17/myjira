import { z } from 'zod';

export const UserSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    workspace_role_id: z.uuid(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    workspaceRoleId: row.workspace_role_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export type User = z.infer<typeof UserSchema>;
