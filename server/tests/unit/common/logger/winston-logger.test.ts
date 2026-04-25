import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { mockCommonConfig, mockProductionConfig } from './winston-logger.mock';

const mockWinston = {
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
};

jest.unstable_mockModule('winston', () => ({
  __esModule: true,
  default: mockWinston,
  ...mockWinston,
}));

const { LoggerLevel } = await import('@/common/logger');
const { WinstonLogger } = await import('@/common/logger/winston-logger');

describe('WinstonLogger.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a WinstonLogger instance', () => {
    expect(WinstonLogger.create(mockCommonConfig)).toBeInstanceOf(WinstonLogger);
  });

  it('should call winston.createLogger with the correct config for every environment', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: mockCommonConfig.level,
        defaultMeta: { service: mockCommonConfig.serviceName },
      }),
    );
  });

  it('should create a logger with the correct format for every environment', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.format.combine).toHaveBeenCalled();
    expect(mockWinston.format.timestamp).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.errors).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.errors).toHaveBeenCalledWith({ stack: true });
    expect(mockWinston.format.json).toHaveBeenCalledTimes(1);
  });

  it('should use the correct error log path for every environment', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.transports.File).toHaveBeenCalledWith({
      filename: mockCommonConfig.paths.errorLog,
      level: LoggerLevel.ERROR,
    });
  });

  it('should use the correct combined log path for every environment', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.transports.File).toHaveBeenCalledWith({
      filename: mockCommonConfig.paths.combinedLog,
    });
  });

  it('should use two file transports for every environment', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.transports.File).toHaveBeenCalledTimes(2);
  });

  it('should use the console transport when enableConsole is true', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.transports.Console).toHaveBeenCalled();
  });

  it('should not use the console transport when enableConsole is false', () => {
    WinstonLogger.create(mockProductionConfig);

    expect(mockWinston.transports.Console).not.toHaveBeenCalled();
  });

  it('should use the correct format for the console transport when enableConsole is true', () => {
    WinstonLogger.create(mockCommonConfig);

    expect(mockWinston.format.combine).toHaveBeenCalledTimes(2);
    expect(mockWinston.format.colorize).toHaveBeenCalled();
    expect(mockWinston.format.simple).toHaveBeenCalled();
  });

  it('should not call the extra format functions when enableConsole is false', () => {
    WinstonLogger.create(mockProductionConfig);

    expect(mockWinston.format.combine).toHaveBeenCalledTimes(1);
    expect(mockWinston.format.colorize).not.toHaveBeenCalled();
    expect(mockWinston.format.simple).not.toHaveBeenCalled();
  });
});
