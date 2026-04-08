import { z } from 'zod';

export const BootstrapWorkspaceUsersSchema = z.object({
  bootstrapToken: z.string().min(1),
});
