import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActorContext } from '@/lib/api/schemas';

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated';

type AuthState = {
  token: string | null;
  actor: ActorContext | null;
  status: AuthStatus;
  setSession: (session: Partial<Pick<AuthState, 'token' | 'actor' | 'status'>>) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      actor: null,
      status: 'anonymous',
      setSession: (session) => set(session),
      clear: () => set({ token: null, actor: null, status: 'anonymous' }),
    }),
    {
      name: 'myjira.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, actor, status }) => ({ token, actor, status }),
    },
  ),
);
