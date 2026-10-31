import type { FilterOption } from '@/components/common/MultiSelectFilter';
import type { WorkspaceRoleName } from '@/lib/api/schemas';

export const USER_STATUS_OPTIONS: FilterOption[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'Pending' },
];

export const ASSIGNABLE_ROLE_NAMES: WorkspaceRoleName[] = ['Admin', 'Developer'];
