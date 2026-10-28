'use client'

import { useAuthStore } from '@/stores/authStore'
import { can, type Action, type AuthzContext } from './can'

export function useActor() {
  return useAuthStore((state) => state.actor)
}

export function useCan(action: Action, context: AuthzContext = {}): boolean {
  const actor = useActor()
  return can(actor, action, context)
}
