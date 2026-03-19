import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LoggerLevel } from '@/common/logger/logger.types';
import { NodeEnv } from '@/config/env.types';

const mockLoggerInstance = { mock: true };
jest.mock('@/common/logger/create-logger', () => ({
  createLogger: jest.fn().mockReturnValue(mockLoggerInstance),
}));

function mockEnv(nodeEnv: NodeEnv) {
  jest.doMock('@/config/env', () => ({
    env: { NODE_ENV: nodeEnv },
  }));
}

describe('logger', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should export the logger instance returned by createLogger', async () => {
    mockEnv(NodeEnv.DEVELOPMENT);

    const { logger } = await import('@/common/logger/logger');

    expect(logger).toBe(mockLoggerInstance);
  });

  it('should use correct logger configuration for development environment', async () => {
    mockEnv(NodeEnv.DEVELOPMENT);

    const { SERVICE_NAME, PATHS } = await import('@/common/logger/logger');
    const { createLogger } = await import('@/common/logger/create-logger');

    expect(createLogger).toHaveBeenCalledWith({
      level: LoggerLevel.DEBUG,
      enableConsole: true,
      serviceName: SERVICE_NAME,
      paths: PATHS,
    });
  });

  it('should use correct logger configuration for production environment', async () => {
    mockEnv(NodeEnv.PRODUCTION);

    const { SERVICE_NAME, PATHS } = await import('@/common/logger/logger');
    const { createLogger } = await import('@/common/logger/create-logger');

    expect(createLogger).toHaveBeenCalledWith({
      level: LoggerLevel.HTTP,
      enableConsole: false,
      serviceName: SERVICE_NAME,
      paths: PATHS,
    });
  });

  it('should use correct logger configuration for test environment', async () => {
    mockEnv(NodeEnv.TEST);

    const { SERVICE_NAME, PATHS } = await import('@/common/logger/logger');
    const { createLogger } = await import('@/common/logger/create-logger');

    expect(createLogger).toHaveBeenCalledWith({
      level: LoggerLevel.HTTP,
      enableConsole: false,
      serviceName: SERVICE_NAME,
      paths: PATHS,
    });
  });
});
