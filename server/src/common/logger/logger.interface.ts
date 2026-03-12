import { LoggerMeta } from './logger.types';

export interface ILogger {
  error(message: string, meta?: LoggerMeta): void;
  warn(message: string, meta?: LoggerMeta): void;
  info(message: string, meta?: LoggerMeta): void;
  http(message: string, meta?: LoggerMeta): void;
  debug(message: string, meta?: LoggerMeta): void;
}
