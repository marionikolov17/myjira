import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { USER_STATUSES } from '@/lib/api/schemas';

export const USER_STATUS_OPTIONS: FilterOption[] = USER_STATUSES.map((status) => ({
  value: status,
  label: status,
}));
