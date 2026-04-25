import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../prisma/generated/prisma/client';
import { env } from '@/config/env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prismaClient = new PrismaClient({ adapter });
