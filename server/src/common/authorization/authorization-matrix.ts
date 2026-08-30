import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-members';
import { AuthorizationAction, AuthorizationScope } from './authorization.types';

export interface AuthorizationMatrix {
  [AuthorizationScope.Workspace]: Partial<Record<AuthorizationAction, WorkspaceRoleName[]>>;
  [AuthorizationScope.Project]: Partial<Record<AuthorizationAction, ProjectRoleName[]>>;
}

export const authorizationMatrix: AuthorizationMatrix = {
  [AuthorizationScope.Workspace]: {
    createUser: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    updateUserRole: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    createProject: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
  },
  [AuthorizationScope.Project]: {
    addProjectMember: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProjectRole: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProject: [ProjectRoleName.PROJECT_OWNER],
    createIssue: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    assignIssue: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    updateIssueStatus: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    createSubtask: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    assignSubtask: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
    updateSubtaskStatus: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
  },
};
