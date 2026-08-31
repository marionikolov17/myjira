import { ActorContext } from '@/common/interfaces';
import { AuthorizationMatrix, AuthorizationScope } from '@/common/authorization';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-members';

export const USER_ID = '11111111-1111-1111-1111-111111111111';
export const WORKSPACE_ROLE_ID = '22222222-2222-2222-2222-222222222222';
export const PROJECT_ID = '44444444-4444-4444-4444-444444444444';
export const OTHER_PROJECT_ID = '99999999-9999-9999-9999-999999999999';
export const PROJECT_ROLE_ID = '55555555-5555-5555-5555-555555555555';

type ActorProjectRole = ActorContext['projectRoles'][number];

interface BuildMockActorParams {
  workspaceRoleName?: WorkspaceRoleName;
  projectRoles?: ActorProjectRole[];
}

export function buildMockActor({
  workspaceRoleName = WorkspaceRoleName.DEVELOPER,
  projectRoles = [],
}: BuildMockActorParams = {}): ActorContext {
  return {
    userId: USER_ID,
    workspaceRole: {
      id: WORKSPACE_ROLE_ID,
      name: workspaceRoleName,
    },
    projectRoles,
  };
}

export function buildMockProjectRole(
  projectRoleName: ProjectRoleName,
  projectId: string = PROJECT_ID,
): ActorProjectRole {
  return {
    projectId,
    projectRoleId: PROJECT_ROLE_ID,
    projectRoleName,
  };
}

// `updateUserRole` and `updateProjectRole` are intentionally omitted so tests can
// exercise deny-by-default for unconfigured actions.
export const testAuthorizationMatrix: AuthorizationMatrix = {
  [AuthorizationScope.Workspace]: {
    createUser: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
  },
  [AuthorizationScope.Project]: {
    addProjectMember: [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    createIssue: [
      ProjectRoleName.PROJECT_OWNER,
      ProjectRoleName.PROJECT_ADMIN,
      ProjectRoleName.DEVELOPER,
    ],
  },
};
