import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/schemas';
import { useAuthStore } from '@/stores/authStore';

export function makeQueryClient(): QueryClient {
  const handleAuthError = (error: unknown) => {
    if (isApiError(error) && error.code === 'AUTHENTICATION_REQUIRED') {
      useAuthStore.getState().clear();
      client.clear();
    }
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAuthError }),
    mutationCache: new MutationCache({ onError: handleAuthError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });

  return client;
}
