'use client';

import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api/schemas';
import { EmptyState } from './EmptyState';

type ErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
};

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={className}>
      <EmptyState icon={TriangleAlertIcon} title={title} description={getErrorMessage(error)}>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
            Retry
          </Button>
        )}
      </EmptyState>
    </div>
  );
}
