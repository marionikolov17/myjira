'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PencilIcon } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type InlineEditTextProps = {
  value: string;
  schema: z.ZodType<string, string>;
  onSave: (next: string) => Promise<unknown>;
  canEdit: boolean;
  label: string;
  as?: 'h1' | 'h2';
  className?: string;
};

type FormValues = { value: string };

/** Heading that turns into an input on click; Enter/blur saves, Escape cancels. */
export function InlineEditText({
  value,
  schema,
  onSave,
  canEdit,
  label,
  as: Heading = 'h1',
  className,
}: InlineEditTextProps) {
  const [editing, setEditing] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(z.object({ value: schema })),
    values: { value },
  });
  const error = form.formState.errors.value;

  const stop = () => {
    form.reset({ value });
    setEditing(false);
  };

  const submit = form.handleSubmit(async ({ value: next }) => {
    if (next === value) return stop();
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      stop();
    }
  });

  const headingClass = cn('text-2xl font-semibold tracking-tight text-balance', className);

  if (!canEdit) return <Heading className={headingClass}>{value}</Heading>;

  if (!editing) {
    return (
      <Heading className={headingClass}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group -mx-1.5 inline-flex max-w-full items-center gap-2 rounded-lg px-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Edit ${label}: ${value}`}
        >
          <span className="min-w-0 break-words">{value}</span>
          <PencilIcon
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        </button>
      </Heading>
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-2xl">
      <Field data-invalid={Boolean(error) || undefined}>
        <Input
          autoFocus
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          className="h-10 text-lg font-semibold"
          disabled={form.formState.isSubmitting}
          onKeyDown={onKeyDown}
          {...form.register('value', { onBlur: () => void submit() })}
        />
        <FieldError errors={[error]} />
      </Field>
    </form>
  );
}
