import { ActorContext } from '@/common/interfaces';
import { Project } from '@/modules/projects/project.schema';
import { ProjectRole, ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import {
  AddProjectMemberParams,
  ProjectMemberExpanded,
  UpdateProjectMemberRoleParams,
} from '@/modules/project-members';

export const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
export const OTHER_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
export const UNKNOWN_PROJECT_ROLE_ID = '33333333-3333-3333-3333-333333333333';

export const PROJECT_OWNER_ROLE_ID = '44444444-4444-4444-4444-444444444444';
export const PROJECT_ADMIN_ROLE_ID = '55555555-5555-5555-5555-555555555555';
export const DEVELOPER_ROLE_ID = '66666666-6666-6666-6666-666666666666';

export const ACTOR_USER_ID = '77777777-7777-7777-7777-777777777777';
export const TARGET_USER_ID = '88888888-8888-8888-8888-888888888888';

export const PROJECT_OWNER_MEMBER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const PROJECT_ADMIN_MEMBER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const DEVELOPER_MEMBER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

export const WORKSPACE_ROLE_ID = '99999999-9999-9999-9999-999999999999';

const BASE_DATE = new Date('2026-01-01T00:00:00.000Z');

export const project: Project = {
  id: PROJECT_ID,
  name: 'Sample project',
  description: 'Sample description',
  creatorId: ACTOR_USER_ID,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const projectOwnerRole: ProjectRole = {
  id: PROJECT_OWNER_ROLE_ID,
  name: ProjectRoleName.PROJECT_OWNER,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const projectAdminRole: ProjectRole = {
  id: PROJECT_ADMIN_ROLE_ID,
  name: ProjectRoleName.PROJECT_ADMIN,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const developerProjectRole: ProjectRole = {
  id: DEVELOPER_ROLE_ID,
  name: ProjectRoleName.DEVELOPER,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

function buildActor(
  workspaceRoleName: WorkspaceRoleName,
  projectRoles: ActorContext['projectRoles'] = [],
): ActorContext {
  return {
    userId: ACTOR_USER_ID,
    workspaceRole: { id: WORKSPACE_ROLE_ID, name: workspaceRoleName },
    projectRoles,
  };
}

export const workspaceOwnerActor: ActorContext = buildActor(WorkspaceRoleName.OWNER);
export const workspaceAdminActor: ActorContext = buildActor(WorkspaceRoleName.ADMIN);
export const workspaceDeveloperActor: ActorContext = buildActor(WorkspaceRoleName.DEVELOPER);

export const projectOwnerActor: ActorContext = buildActor(WorkspaceRoleName.DEVELOPER, [
  {
    projectId: PROJECT_ID,
    projectRoleId: PROJECT_OWNER_ROLE_ID,
    projectRoleName: ProjectRoleName.PROJECT_OWNER,
  },
]);

export const projectAdminActor: ActorContext = buildActor(WorkspaceRoleName.DEVELOPER, [
  {
    projectId: PROJECT_ID,
    projectRoleId: PROJECT_ADMIN_ROLE_ID,
    projectRoleName: ProjectRoleName.PROJECT_ADMIN,
  },
]);

export const projectDeveloperActor: ActorContext = buildActor(WorkspaceRoleName.DEVELOPER, [
  {
    projectId: PROJECT_ID,
    projectRoleId: DEVELOPER_ROLE_ID,
    projectRoleName: ProjectRoleName.DEVELOPER,
  },
]);

export const addDeveloperInput: AddProjectMemberParams = {
  userId: TARGET_USER_ID,
  projectRoleId: DEVELOPER_ROLE_ID,
};

export const addProjectAdminInput: AddProjectMemberParams = {
  userId: TARGET_USER_ID,
  projectRoleId: PROJECT_ADMIN_ROLE_ID,
};

export const addProjectOwnerInput: AddProjectMemberParams = {
  userId: TARGET_USER_ID,
  projectRoleId: PROJECT_OWNER_ROLE_ID,
};

export const addUnknownRoleInput: AddProjectMemberParams = {
  userId: TARGET_USER_ID,
  projectRoleId: UNKNOWN_PROJECT_ROLE_ID,
};

export const updateToDeveloperInput: UpdateProjectMemberRoleParams = {
  projectRoleId: DEVELOPER_ROLE_ID,
};

export const updateToProjectAdminInput: UpdateProjectMemberRoleParams = {
  projectRoleId: PROJECT_ADMIN_ROLE_ID,
};

export const updateToProjectOwnerInput: UpdateProjectMemberRoleParams = {
  projectRoleId: PROJECT_OWNER_ROLE_ID,
};

export const updateToUnknownRoleInput: UpdateProjectMemberRoleParams = {
  projectRoleId: UNKNOWN_PROJECT_ROLE_ID,
};

export const createdDeveloperMember: ProjectMemberExpanded = {
  id: DEVELOPER_MEMBER_ID,
  projectId: PROJECT_ID,
  user: { id: TARGET_USER_ID, name: 'Target User', email: 'target@example.com' },
  projectRole: { id: DEVELOPER_ROLE_ID, name: ProjectRoleName.DEVELOPER },
};

export const createdProjectAdminMember: ProjectMemberExpanded = {
  id: PROJECT_ADMIN_MEMBER_ID,
  projectId: PROJECT_ID,
  user: { id: TARGET_USER_ID, name: 'Target User', email: 'target@example.com' },
  projectRole: { id: PROJECT_ADMIN_ROLE_ID, name: ProjectRoleName.PROJECT_ADMIN },
};

export const projectOwnerMember: ProjectMemberExpanded = {
  id: PROJECT_OWNER_MEMBER_ID,
  projectId: PROJECT_ID,
  user: { id: ACTOR_USER_ID, name: 'Owner User', email: 'owner@example.com' },
  projectRole: { id: PROJECT_OWNER_ROLE_ID, name: ProjectRoleName.PROJECT_OWNER },
};

export const projectAdminMember: ProjectMemberExpanded = {
  id: PROJECT_ADMIN_MEMBER_ID,
  projectId: PROJECT_ID,
  user: { id: TARGET_USER_ID, name: 'Admin User', email: 'admin@example.com' },
  projectRole: { id: PROJECT_ADMIN_ROLE_ID, name: ProjectRoleName.PROJECT_ADMIN },
};

export const developerMember: ProjectMemberExpanded = {
  id: DEVELOPER_MEMBER_ID,
  projectId: PROJECT_ID,
  user: { id: TARGET_USER_ID, name: 'Dev User', email: 'dev@example.com' },
  projectRole: { id: DEVELOPER_ROLE_ID, name: ProjectRoleName.DEVELOPER },
};

/**
 * A member row whose `user.id` equals the actor's — used for self-mutation
 * tests. We only need to flip the `user.id` of an existing fixture.
 */
export const selfDeveloperMember: ProjectMemberExpanded = {
  ...developerMember,
  user: { ...developerMember.user, id: ACTOR_USER_ID },
};

export const updatedToProjectAdminMember: ProjectMemberExpanded = {
  ...developerMember,
  projectRole: { id: PROJECT_ADMIN_ROLE_ID, name: ProjectRoleName.PROJECT_ADMIN },
};
