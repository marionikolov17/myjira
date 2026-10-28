import type { AddProjectMemberInput, UpdateProjectMemberRoleInput } from '@/lib/api/schemas';
import { transport } from '@/lib/api/transport';

export const membersClient = {
  add: (projectId: string, input: AddProjectMemberInput) =>
    transport.addProjectMember(projectId, input),
  list: (projectId: string) => transport.listProjectMembers(projectId),
  updateRole: (projectId: string, memberId: string, input: UpdateProjectMemberRoleInput) =>
    transport.updateProjectMemberRole(projectId, memberId, input),
  remove: (projectId: string, memberId: string) =>
    transport.removeProjectMember(projectId, memberId),
};
