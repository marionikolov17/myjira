'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/authStore';

/** True once the persisted auth session has been read from localStorage (always false on the server). */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}
