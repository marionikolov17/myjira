import { createLogger } from './create-logger';
import { env } from '../../config/env';
import { LoggerLevel } from './logger.types';
import { NodeEnv } from '@/config/env.types';

const LOG_DIR = 'logs';
const PATHS = {
  errorLog: `${LOG_DIR}/errors.log`,
  combinedLog: `${LOG_DIR}/combined.log`,
};
const SERVICE_NAME = 'api';

export const logger = createLogger({
  level: env.NODE_ENV === NodeEnv.DEVELOPMENT ? LoggerLevel.DEBUG : LoggerLevel.HTTP,
  enableConsole: env.NODE_ENV === NodeEnv.DEVELOPMENT,
  serviceName: SERVICE_NAME,
  paths: PATHS,
});
