'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { useMe } from '@/features/auth/queries';
import { useAuthStore } from '@/stores/authStore';
import { FullScreenLoader } from './FullScreenLoader';
import { useAuthHydrated } from './useAuthHydrated';

/**
 * Redirects anonymous users to /login and keeps the persisted actor in sync with /users/me.
 * A 401 anywhere clears the store (see queryClient), which drops the token and lands here.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((state) => state.token);
  const actor = useAuthStore((state) => state.actor);
  const setSession = useAuthStore((state) => state.setSession);
  const me = useMe();

  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);

  useEffect(() => {
    if (me.data) setSession({ actor: me.data, status: 'authenticated' });
  }, [me.data, setSession]);

  if (!hydrated || !token) return <FullScreenLoader />;
  if (!actor && me.error) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  if (!actor) return <FullScreenLoader />;

  return <>{children}</>;
}
