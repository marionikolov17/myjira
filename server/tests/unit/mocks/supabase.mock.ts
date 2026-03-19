import { jest } from '@jest/globals';

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
