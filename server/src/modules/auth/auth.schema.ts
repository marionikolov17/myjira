import { z } from 'zod';

export const LoginParamsSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export type LoginParams = z.infer<typeof LoginParamsSchema>;
