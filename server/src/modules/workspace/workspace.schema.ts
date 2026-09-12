import { z } from 'zod';

export const BootstrapWorkspaceUsersParamsSchema = z.strictObject({
  bootstrapToken: z.string().min(1),
});
export type BootstrapWorkspaceUsersParams = z.infer<typeof BootstrapWorkspaceUsersParamsSchema>;
