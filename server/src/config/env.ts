import { z } from 'zod';
import { NodeEnv } from '@/config/env.types';

const envSchema = z.object({
  // Node Configuration
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(Object.values(NodeEnv)).default(NodeEnv.DEVELOPMENT),
  // Password Hashing Configuration
  SALT_ROUNDS: z.coerce.number().min(4).max(31).default(10),
  // Supabase Configuration
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
