import { jest } from '@jest/globals';
import { ILogger } from '@/common/logger';

export const mockLogger: jest.Mocked<ILogger> = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
};
