import { WorkspaceRoleName } from '@/modules/workspace-roles/workspace-role.schema';
import { ProjectRoleName } from '@/modules/project-roles/project-role.schema';

export interface ActorWorkspaceRole {
  id: string;
  name: WorkspaceRoleName;
}

export interface ActorProjectRole {
  projectId: string;
  projectRoleId: string;
  projectRoleName: ProjectRoleName;
}

export interface ActorContext {
  userId: string;
  workspaceRole: ActorWorkspaceRole;
  projectRoles: ActorProjectRole[];
}
