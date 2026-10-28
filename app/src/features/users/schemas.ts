export { createUserInputSchema, type CreateUserInput } from '@/lib/api/schemas';

export const USER_SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
] as const;
