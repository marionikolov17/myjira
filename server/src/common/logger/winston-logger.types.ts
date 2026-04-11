import { LoggerLevel } from './logger.types';

export interface WinstonLoggerConfig {
  level: LoggerLevel;
  enableConsole: boolean;
  serviceName: string;
  paths: LoggerPaths;
}

interface LoggerPaths {
  errorLog: string;
  combinedLog: string;
}
