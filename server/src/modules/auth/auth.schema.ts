import { z } from 'zod';

const NormalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const LoginParamsSchema = z.strictObject({
  email: NormalizedEmailSchema,
  password: z.string().min(1),
});

export type LoginParams = z.infer<typeof LoginParamsSchema>;
