import { jest } from '@jest/globals';
import { ILogger } from '@/common/logger';

export function createMockLogger(): jest.Mocked<ILogger> {
  return {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
  };
}
