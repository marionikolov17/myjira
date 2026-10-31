export { createUserInputSchema, type CreateUserInput } from '@/lib/api/schemas';

export const USER_SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: 'email', label: 'Email (A–Z)' },
  { value: '-email', label: 'Email (Z–A)' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
] as const;

export type UserSort = (typeof USER_SORT_OPTIONS)[number]['value'];
export const USER_SORT_VALUES = USER_SORT_OPTIONS.map((option) => option.value) as unknown as [
  UserSort,
  ...UserSort[],
];

export const USERS_PAGE_SIZE = 12;
