import type { ProjectRoleName } from '@/lib/api/schemas';
import { PROJECT_ROLE_ORDER } from '@/features/roles/labels';

/** Project roles that can be changed via the members UI (Owner is fixed). */
export const EDITABLE_PROJECT_ROLE_NAMES: ProjectRoleName[] = ['ProjectAdmin', 'Developer'];

export { PROJECT_ROLE_ORDER };
