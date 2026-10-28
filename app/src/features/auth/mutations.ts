'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { authClient } from '@/lib/api/client/auth';
import type { LoginInput } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores/authStore';

export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await authClient.login(input);
      setSession({ token: data.token, actor: null, status: 'authenticating' });
      const { data: actor } = await authClient.getCurrentUser();
      return actor;
    },
    onSuccess: (actor) => {
      queryClient.setQueryData(queryKeys.me(), actor);
      setSession({ actor, status: 'authenticated' });
    },
    onError: () => clear(),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clear = useAuthStore((state) => state.clear);

  return useCallback(() => {
    clear();
    queryClient.clear();
    router.replace('/login');
  }, [clear, queryClient, router]);
}
