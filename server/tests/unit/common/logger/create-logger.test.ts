import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import winston from 'winston';
import { createLogger, LoggerLevel, WinstonLogger } from '@/common/logger';

jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}));
const mockWinston = jest.mocked(winston);

const serviceName = 'api';
const errorLogPath = 'logs/error.log';
const combinedLogPath = 'logs/combined.log';
const paths = {
  errorLog: errorLogPath,
  combinedLog: combinedLogPath,
};

const commonConfig = {
  level: LoggerLevel.DEBUG,
  enableConsole: true,
  paths,
  serviceName,
};
const developmentConfig = {
  ...commonConfig,
};
const productionConfig = {
  ...commonConfig,
  enableConsole: false,
  level: LoggerLevel.HTTP,
};

describe('createLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a logger for every environment', () => {
    const logger = createLogger(commonConfig);

    expect(logger).toBeInstanceOf(WinstonLogger);
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.http).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should call winston.createLogger with the correct config for every environment', () => {
    createLogger(commonConfig);

    expect(mockWinston.createLogger).toHaveBeenCalled();
    expect(mockWinston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: commonConfig.level,
        defaultMeta: { service: commonConfig.serviceName },
      }),
    );
  });

  it('should create a logger with the correct format for every environment', () => {
    createLogger(commonConfig);

    expect(mockWinston.format.combine).toHaveBeenCalled();
    expect(mockWinston.format.timestamp).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.errors).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.errors).toHaveBeenCalledWith({ stack: true });
    expect(mockWinston.format.json).toHaveBeenCalledTimes(1);
  });

  it('should use the correct error log and combined log paths for every environment', () => {
    createLogger(commonConfig);

    expect(mockWinston.transports.File).toHaveBeenCalledWith({
      filename: commonConfig.paths.errorLog,
      level: LoggerLevel.ERROR,
    });
    expect(mockWinston.transports.File).toHaveBeenCalledWith({
      filename: commonConfig.paths.combinedLog,
    });
    expect(mockWinston.transports.File).toHaveBeenCalledTimes(2);
  });

  it('should use the console transport when enableConsole is true in development', () => {
    createLogger(developmentConfig);

    expect(mockWinston.transports.Console).toHaveBeenCalled();
  });

  it('should not use the console transport when enableConsole is false in production', () => {
    createLogger(productionConfig);

    expect(mockWinston.transports.Console).not.toHaveBeenCalled();
  });

  it('should use the correct format for the console transport when enableConsole is true in development', () => {
    createLogger(developmentConfig);

    expect(mockWinston.transports.Console).toHaveBeenCalled();
    expect(mockWinston.format.combine).toHaveBeenCalledTimes(2);
    expect(mockWinston.format.colorize).toHaveBeenCalled();
    expect(mockWinston.format.simple).toHaveBeenCalled();
  });

  it('should not call the extra format functions when enableConsole is false in production', () => {
    createLogger(productionConfig);

    expect(mockWinston.format.combine).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.colorize).not.toHaveBeenCalled();
    expect(mockWinston.format.simple).not.toHaveBeenCalled();
  });
});
