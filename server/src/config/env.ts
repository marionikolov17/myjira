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
  // System (Workspace) Configuration
  BOOTSTRAP_TOKEN: z.string().min(1),
  // System (Workspace) Users Configuration
  OWNER_EMAIL: z.email().optional(),
  OWNER_NAME: z.string().min(1).optional(),
  OWNER_PASSWORD: z.string().min(1).optional(),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_NAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  DEVELOPER_EMAIL: z.email().optional(),
  DEVELOPER_NAME: z.string().min(1).optional(),
  DEVELOPER_PASSWORD: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
