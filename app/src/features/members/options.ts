import type { ProjectRoleName } from '@/lib/api/schemas';

/** Project roles that can be changed via the members UI (Owner is fixed). */
export const EDITABLE_PROJECT_ROLE_NAMES: ProjectRoleName[] = ['ProjectAdmin', 'Developer'];
