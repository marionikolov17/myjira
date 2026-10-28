'use client'

import type { LucideIcon } from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type SelectOption<V extends string> = { value: V; label: string; icon?: LucideIcon }

type OptionSelectProps<V extends string> = {
  value: V
  options: ReadonlyArray<SelectOption<V>>
  onChange: (value: V) => void
  ariaLabel: string
  disabled?: boolean
  size?: 'sm' | 'default'
  className?: string
  id?: string
  invalid?: boolean
}

export function OptionSelect<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  size = 'default',
  className,
  id,
  invalid,
}: OptionSelectProps<V>) {
  const items = options.map((option) => ({ value: option.value, label: option.label }))
  const selected = options.find((option) => option.value === value)
  const SelectedIcon = selected?.icon

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null && next !== value) onChange(next as V)
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={ariaLabel} aria-invalid={invalid || undefined}>
        {SelectedIcon && <SelectedIcon aria-hidden="true" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => {
            const Icon = option.icon
            return (
              <SelectItem key={option.value} value={option.value}>
                {Icon && <Icon aria-hidden="true" />}
                {option.label}
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
