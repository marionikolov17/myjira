import { API_BASE_URL } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';
import { createHttpTransport } from './httpTransport';
import type { Transport } from './types';

const getToken = () => useAuthStore.getState().token;

export const transport: Transport = createHttpTransport({ baseUrl: API_BASE_URL, getToken });

export * from './types';
export * from './queryString';
