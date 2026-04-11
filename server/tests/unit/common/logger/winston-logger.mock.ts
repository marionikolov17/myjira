import { LoggerLevel } from '@/common/logger/logger.types';

export const mockCommonConfig = {
  level: LoggerLevel.DEBUG,
  enableConsole: true,
  paths: {
    errorLog: 'logs/error.log',
    combinedLog: 'logs/combined.log',
  },
  serviceName: 'api',
};

export const mockDevelopmentConfig = {
  ...mockCommonConfig,
};

export const mockProductionConfig = {
  ...mockCommonConfig,
  enableConsole: false,
  level: LoggerLevel.HTTP,
};
