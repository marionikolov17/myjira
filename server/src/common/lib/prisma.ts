import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../prisma/generated/prisma/client';
import { logger } from '../logger';
import { env } from '@/config/env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });

prisma.$on('query', (e) => {
  logger.debug('Query: ' + e.query);
  logger.debug('Params: ' + e.params);
  logger.debug('Duration: ' + e.duration + 'ms');
});

export { prisma };
