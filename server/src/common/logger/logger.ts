import { env } from '@/config/env';
import { NodeEnv } from '@/config/env.types';
import { WinstonLogger } from './winston-logger';
import { LoggerLevel } from './logger.types';

const LOG_DIR = 'logs';

export const logger = WinstonLogger.create({
  level: env.NODE_ENV === NodeEnv.DEVELOPMENT ? LoggerLevel.DEBUG : LoggerLevel.HTTP,
  enableConsole: env.NODE_ENV === NodeEnv.DEVELOPMENT,
  serviceName: 'api',
  paths: {
    errorLog: `${LOG_DIR}/errors.log`,
    combinedLog: `${LOG_DIR}/combined.log`,
  },
});
