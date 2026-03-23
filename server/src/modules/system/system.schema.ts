import { z } from 'zod';

export const BootstrapSystemUsersSchema = z.object({
  bootstrapToken: z.string().min(1),
});
