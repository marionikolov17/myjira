import fs from 'fs';
import winston, { format, transports } from 'winston';
import { WinstonLogger } from './winston-logger';
import { ILogger } from './logger.interface';
import { LoggerLevel } from './logger.types';

interface LoggerConfig {
  level: LoggerLevel;
  enableConsole: boolean;
}

const LOG_DIR = 'logs';
const ERROR_LOG = `${LOG_DIR}/errors.log`;
const COMBINED_LOG = `${LOG_DIR}/combined.log`;

export function createLogger(config: LoggerConfig): ILogger {
  const winstonLogger = winston.createLogger({
    level: config.level,
    format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
    defaultMeta: { service: 'api' },
  });

  createLogsDirectory();
  configureTransports(winstonLogger, config);

  return new WinstonLogger(winstonLogger);
}

function createLogsDirectory() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function configureTransports(winstonLogger: winston.Logger, config: LoggerConfig) {
  winstonLogger.add(new transports.File({ filename: ERROR_LOG, level: 'error' }));
  winstonLogger.add(new transports.File({ filename: COMBINED_LOG }));

  if (config.enableConsole) {
    winstonLogger.add(
      new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
    );
  }
}
