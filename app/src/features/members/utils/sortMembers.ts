import type { ProjectMember } from '@/lib/api/schemas';
import { PROJECT_ROLE_ORDER } from '@/lib/labels/roles';

/** Sort by project-role rank, then display name. */
export function sortProjectMembers(members: ProjectMember[]): ProjectMember[] {
  return [...members].sort(
    (a, b) =>
      (PROJECT_ROLE_ORDER[a.projectRole.name] ?? 99) -
        (PROJECT_ROLE_ORDER[b.projectRole.name] ?? 99) || a.user.name.localeCompare(b.user.name),
  );
}
