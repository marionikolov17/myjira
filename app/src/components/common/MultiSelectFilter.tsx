'use client';

import { ChevronDownIcon, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type FilterOption = { value: string; label: string; icon?: LucideIcon };

type MultiSelectFilterProps = {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const toggle = (value: string, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" aria-label={`Filter by ${label.toLowerCase()}`} />
        }
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {selected.length}
            <span className="sr-only"> selected</span>
          </Badge>
        )}
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.length === 0 && <DropdownMenuItem disabled>No options</DropdownMenuItem>}
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, checked)}
                closeOnClick={false}
              >
                {Icon && <Icon aria-hidden="true" />}
                <span className="truncate">{option.label}</span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onChange([])}>Clear selection</DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
