import { z } from 'zod';
import { timestampSchema } from './common';
import { projectRoleNameSchema, workspaceRoleNameSchema } from './roles';

export const USER_STATUSES = ['Pending', 'Active'] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  workspaceRoleId: z.uuid(),
  status: userStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

export const actorContextSchema = z.object({
  userId: z.uuid(),
  workspaceRole: z.object({ id: z.uuid(), name: workspaceRoleNameSchema }),
  projectRoles: z.array(
    z.object({
      projectId: z.uuid(),
      projectRoleId: z.uuid(),
      projectRoleName: projectRoleNameSchema,
    }),
  ),
});
export type ActorContext = z.infer<typeof actorContextSchema>;

export const createUserInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  email: z.email('Enter a valid email address'),
  workspaceRoleId: z.uuid('Select a workspace role'),
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const userActivationSchema = z.object({
  url: z.url(),
  expiresAt: timestampSchema,
});
export type UserActivation = z.infer<typeof userActivationSchema>;

export type CreateUserResponse = { user: User; activation: UserActivation };

export const updateUserRoleInputSchema = z.object({
  workspaceRoleId: z.uuid('Select a workspace role'),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInputSchema>;
