import { createLogger } from './create-logger';
import { env } from '../../config/env';
import { LoggerLevel } from './logger.types';
import { NodeEnv } from '@/config/env.types';

export const logger = createLogger({
  level: env.NODE_ENV === NodeEnv.DEVELOPMENT ? LoggerLevel.DEBUG : LoggerLevel.HTTP,
  enableConsole: env.NODE_ENV === NodeEnv.DEVELOPMENT,
});
