import { z } from 'zod';
import { UserStatus } from '@/generated/prisma/enums';

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  workspaceRoleId: z.uuid(),
  status: z.enum(UserStatus),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserRequestParamsSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  workspaceRoleId: z.uuid(),
});
export type CreateUserRequestParams = z.infer<typeof CreateUserRequestParamsSchema>;
