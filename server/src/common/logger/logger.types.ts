export type LoggerMeta = Record<string, unknown>;

export enum LoggerLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}
