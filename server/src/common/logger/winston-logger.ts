import winston from 'winston';
import { ILogger } from './logger.interface';
import { WinstonLoggerConfig } from './winston-logger.types';
import { LoggerLevel, LoggerMeta } from './logger.types';

export class WinstonLogger implements ILogger {
  private readonly winstonLogger: winston.Logger;

  private constructor(winstonLogger: winston.Logger) {
    this.winstonLogger = winstonLogger;
  }

  public static create(config: WinstonLoggerConfig): WinstonLogger {
    const winstonLogger = winston.createLogger({
      level: config.level,
      defaultMeta: { service: config.serviceName },
      format: WinstonLogger.buildFormat(),
      transports: WinstonLogger.buildTransports(config),
    });

    return new WinstonLogger(winstonLogger);
  }

  private static buildFormat() {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );
  }

  private static buildTransports(config: WinstonLoggerConfig) {
    const result: winston.transport[] = [
      new winston.transports.File({ filename: config.paths.errorLog, level: LoggerLevel.ERROR }),
      new winston.transports.File({ filename: config.paths.combinedLog }),
    ];

    if (config.enableConsole) {
      result.push(
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      );
    }

    return result;
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
