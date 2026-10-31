'use client';

import { XIcon } from 'lucide-react';
import { MultiSelectFilter, type FilterOption } from '@/components/common/MultiSelectFilter';
import { Button } from '@/components/ui/button';

type FilterBarShellProps<TKey extends string> = {
  ariaLabel: string;
  keys: readonly TKey[];
  labels: Record<TKey, string>;
  optionsFor: Record<TKey, FilterOption[]>;
  values: Record<TKey, string[]>;
  onChange: (key: TKey, next: string[]) => void;
  onClear: () => void;
};

export function FilterBarShell<TKey extends string>({
  ariaLabel,
  keys,
  labels,
  optionsFor,
  values,
  onChange,
  onClear,
}: FilterBarShellProps<TKey>) {
  const active = keys.some((key) => values[key].length > 0);

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {keys.map((key) => (
        <MultiSelectFilter
          key={key}
          label={labels[key]}
          options={optionsFor[key]}
          selected={values[key]}
          onChange={(next) => onChange(key, next)}
        />
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
