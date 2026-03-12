import winston from 'winston';
import { WinstonLogger } from './winston-logger';
import { ILogger } from './logger.interface';
import { LoggerLevel } from './logger.types';

interface LoggerPaths {
  errorLog: string;
  combinedLog: string;
}

interface LoggerConfig {
  level: LoggerLevel;
  enableConsole: boolean;
  serviceName: string;
  paths: LoggerPaths;
}

export function createLogger(config: LoggerConfig): ILogger {
  const winstonLogger = winston.createLogger({
    level: config.level,
    defaultMeta: { service: config.serviceName },
    format: buildFormat(),
    transports: buildTransports(config),
  });

  return new WinstonLogger(winstonLogger);
}

function buildFormat() {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );
}

function buildTransports(config: LoggerConfig) {
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
