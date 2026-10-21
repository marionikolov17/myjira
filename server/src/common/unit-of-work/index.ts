import { logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { PrismaUnitOfWork } from './prisma-unit-of-work';

export * from './unit-of-work.interface';
export * from './prisma-unit-of-work';

export const unitOfWork = new PrismaUnitOfWork(prisma, logger);
