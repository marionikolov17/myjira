import { z } from 'zod';
import { NodeEnv } from '@/config/env.types';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(Object.values(NodeEnv)).default(NodeEnv.DEVELOPMENT),
  SALT_ROUNDS: z.coerce.number().min(4).max(31).default(10),
});

export const env = envSchema.parse(process.env);
