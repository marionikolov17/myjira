import { z } from 'zod';

export const BootstrapWorkspaceUsersSchema = z.strictObject({
  bootstrapToken: z.string().min(1),
});
