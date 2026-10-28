import { API_BASE_URL, USE_MOCKS } from '@/config/env';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/api/mocks/fixtures';
import { useAuthStore } from '@/stores/authStore';
import { createHttpTransport } from './httpTransport';
import { createMockTransport } from './mockTransport';
import type { Transport } from './types';

const getToken = () => useAuthStore.getState().token;

export const transport: Transport = USE_MOCKS
  ? createMockTransport({ getToken })
  : createHttpTransport({ baseUrl: API_BASE_URL, getToken });

/** Sign-in hints for the login screen; null once the real transport is live. */
export const demoCredentials = USE_MOCKS
  ? { accounts: DEMO_ACCOUNTS, password: DEMO_PASSWORD }
  : null;

export type { Transport } from './types';
export { serializeListQuery, parseListQuery } from './queryString';
