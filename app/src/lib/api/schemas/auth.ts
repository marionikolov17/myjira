import { z } from 'zod';

export const loginInputSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
