import winston from 'winston';
import { ILogger } from './logger.interface';
import { LoggerMeta } from './logger.types';

export class WinstonLogger implements ILogger {
  private readonly winstonLogger: winston.Logger;

  constructor(winstonLogger: winston.Logger) {
    this.winstonLogger = winstonLogger;
  }

  public error(message: string, meta?: LoggerMeta): void {
    this.winstonLogger.error(message, meta);
  }

  public warn(message: string, meta?: LoggerMeta): void {
    this.winstonLogger.warn(message, meta);
  }

  public info(message: string, meta?: LoggerMeta): void {
    this.winstonLogger.info(message, meta);
  }

  public http(message: string, meta?: LoggerMeta): void {
    this.winstonLogger.http(message, meta);
  }

  public debug(message: string, meta?: LoggerMeta): void {
    this.winstonLogger.debug(message, meta);
  }
}
