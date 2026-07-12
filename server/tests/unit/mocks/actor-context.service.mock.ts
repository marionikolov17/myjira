import { jest } from '@jest/globals';
import { IActorContextService } from '@/modules/auth/actor-context.interface';

export function createMockActorContextService(): jest.Mocked<IActorContextService> {
  return {
    buildActorContext: jest.fn(),
  };
}
