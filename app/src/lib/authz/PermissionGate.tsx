'use client';

import type { ReactNode } from 'react';
import type { Action } from './can';
import { useCan } from './useCan';

type PermissionGateProps = {
  action: Action;
  projectId?: string;
  fallback?: ReactNode;
  children: ReactNode | ((allowed: boolean) => ReactNode);
};

/** Hides children when the actor lacks permission, or passes `allowed` to a render function for disabled states. */
export function PermissionGate({
  action,
  projectId,
  fallback = null,
  children,
}: PermissionGateProps) {
  const allowed = useCan(action, { projectId });
  if (typeof children === 'function') return <>{children(allowed)}</>;
  return <>{allowed ? children : fallback}</>;
}
