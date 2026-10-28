import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/lib/api/schemas'

/**
 * Maps VALIDATION_ERROR field details onto matching RHF fields and suppresses the toast.
 * Any other error (or validation errors with no matching field) is surfaced as a toast.
 */
export function handleFormError<T extends FieldValues>(error: unknown, form: UseFormReturn<T>): void {
  if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
    const knownFields = new Set(Object.keys(form.getValues()))
    const fields = error.details?.fields ?? []
    let mapped = 0

    for (const field of fields) {
      if (knownFields.has(field.name)) {
        form.setError(field.name as Path<T>, { type: 'server', message: field.message }, { shouldFocus: mapped === 0 })
        mapped += 1
      }
    }

    if (mapped > 0) return
  }

  toast.error(getErrorMessage(error))
}

export function notifyError(error: unknown): void {
  toast.error(getErrorMessage(error))
}
