import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { USER_STATUSES, type WorkspaceRoleName } from '@/lib/api/schemas';

export const USER_STATUS_OPTIONS: FilterOption[] = USER_STATUSES.map((status) => ({
  value: status,
  label: status,
}));

export const ASSIGNABLE_ROLE_NAMES: WorkspaceRoleName[] = ['Admin', 'Developer'];
