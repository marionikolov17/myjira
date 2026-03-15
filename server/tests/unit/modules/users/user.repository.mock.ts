import { jest } from '@jest/globals';
import { UserSchema } from '@/modules/users';
import { ILogger } from '@/common/logger';

const FIXED_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const FIXED_WORKSPACE_ROLE_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export const mockLogger: jest.Mocked<ILogger> = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
};

export const mockCreateUserParams = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  hashedPassword: 'hashedPassword',
  workspaceRoleId: FIXED_WORKSPACE_ROLE_ID,
};

export const mockDatabaseUser = {
  id: FIXED_USER_ID,
  name: mockCreateUserParams.name,
  email: mockCreateUserParams.email,
  workspace_role_id: FIXED_WORKSPACE_ROLE_ID,
  created_at: FIXED_DATE,
  updated_at: FIXED_DATE,
};
export const mockUser = UserSchema.parse(mockDatabaseUser);

interface SupabaseResponse {
  data: unknown;
  error: unknown;
}

export type MockSupabaseClient = Record<string, jest.Mock> & {
  then: (resolve: (value: SupabaseResponse) => void) => Promise<void>;
};

export function createMockSupabaseClient(
  data: unknown = null,
  error: unknown = null,
): MockSupabaseClient {
  const response: SupabaseResponse = { data, error };

  const client = {} as MockSupabaseClient;

  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'gt',
    'lt',
    'gte',
    'lte',
    'single',
    'maybeSingle',
    'order',
    'limit',
    'range',
  ];

  for (const method of methods) {
    client[method] = jest.fn().mockReturnValue(client);
  }

  client.then = (resolve) => Promise.resolve(response).then(resolve);

  return client;
}
