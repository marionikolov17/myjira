import { z } from 'zod';

export const LoginParamsSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginParams = z.infer<typeof LoginParamsSchema>;
