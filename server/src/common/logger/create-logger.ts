import winston from 'winston';
import { WinstonLogger } from './winston-logger';
import { ILogger } from './logger.interface';
import { LoggerLevel } from './logger.types';

interface LoggerPaths {
  errorLog: string;
  combinedLog: string;
}

const DEFAULT_LOG_DIR = 'logs';
const DEFAULT_PATHS: LoggerPaths = {
  errorLog: `${DEFAULT_LOG_DIR}/errors.log`,
  combinedLog: `${DEFAULT_LOG_DIR}/combined.log`,
};

interface LoggerConfig {
  level: LoggerLevel;
  enableConsole: boolean;
  serviceName?: string;
  paths?: Partial<LoggerPaths>;
}

interface CreateLoggerDependencies {
  winstonLib?: typeof winston;
  WinstonLoggerClass?: typeof WinstonLogger;
}

export function createLogger(config: LoggerConfig, deps: CreateLoggerDependencies = {}): ILogger {
  const { winstonLib = winston, WinstonLoggerClass = WinstonLogger } = deps;
  const paths: LoggerPaths = { ...DEFAULT_PATHS, ...config.paths };

  const winstonLogger = winstonLib.createLogger({
    level: config.level,
    defaultMeta: { service: config.serviceName ?? 'api' },
    format: buildFormat(winstonLib),
    transports: buildTransports(config, paths, winstonLib),
  });

  return new WinstonLoggerClass(winstonLogger);
}

function buildFormat(winstonLib: typeof winston) {
  const { format } = winstonLib;
  return format.combine(format.timestamp(), format.errors({ stack: true }), format.json());
}

function buildTransports(config: LoggerConfig, paths: LoggerPaths, winstonLib: typeof winston) {
  const { format, transports } = winstonLib;
  const result: winston.transport[] = [
    new transports.File({ filename: paths.errorLog, level: 'error' }),
    new transports.File({ filename: paths.combinedLog }),
  ];

  if (config.enableConsole) {
    result.push(
      new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
    );
  }

  return result;
}
