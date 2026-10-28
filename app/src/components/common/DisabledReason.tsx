'use client';

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type DisabledReasonProps = {
  disabled: boolean;
  reason: string;
  children: ReactNode;
};

/** Wraps a disabled control so its explanation is still reachable by hover and keyboard focus. */
export function DisabledReason({ disabled, reason, children }: DisabledReasonProps) {
  if (!disabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} className="inline-flex rounded-lg" aria-label={reason} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
