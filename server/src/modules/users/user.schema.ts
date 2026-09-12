import { z } from 'zod';
import { UserStatus } from '@/generated/prisma/enums';

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  workspaceRoleId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const CreatedUserSchema = UserSchema.extend({
  status: z.enum(UserStatus),
});
export type CreatedUser = z.infer<typeof CreatedUserSchema>;

export const CreateUserRequestParamsSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  workspaceRoleId: z.uuid(),
});
export type CreateUserRequestParams = z.infer<typeof CreateUserRequestParamsSchema>;
