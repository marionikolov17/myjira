import { ActorContext } from '@/common/interfaces';
import { Project } from '@/modules/projects/project.schema';
import { ProjectMemberWithRole } from '@/modules/project-members';
import { ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import {
  CreateIssueRequestParams,
  Issue,
  IssuePriority,
  IssueStatus,
  UpdateIssueRequestParams,
} from '@/modules/issues';

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';

export const ACTOR_USER_ID = '33333333-3333-4333-8333-333333333333';
export const MEMBER_USER_ID = '44444444-4444-4444-8444-444444444444';
export const NON_MEMBER_USER_ID = '55555555-5555-4555-8555-555555555555';

export const ISSUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export const PROJECT_OWNER_ROLE_ID = '66666666-6666-4666-8666-666666666666';
export const PROJECT_ADMIN_ROLE_ID = '77777777-7777-4777-8777-777777777777';
export const DEVELOPER_ROLE_ID = '88888888-8888-4888-8888-888888888888';
export const WORKSPACE_ROLE_ID = '99999999-9999-4999-8999-999999999999';
export const PROJECT_MEMBER_ROW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const BASE_DATE = new Date('2026-01-01T00:00:00.000Z');

export const project: Project = {
  id: PROJECT_ID,
  name: 'Sample project',
  description: 'Sample description',
  creatorId: ACTOR_USER_ID,
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

export const memberProjectMember: ProjectMemberWithRole = {
  id: PROJECT_MEMBER_ROW_ID,
  projectId: PROJECT_ID,
  userId: MEMBER_USER_ID,
  projectRoleId: DEVELOPER_ROLE_ID,
  projectRole: { id: DEVELOPER_ROLE_ID, name: ProjectRoleName.DEVELOPER },
};

export const createIssueInputNoAssignee: CreateIssueRequestParams = {
  title: 'Checkout crashes on empty cart',
  description: 'Reproduces on prod when the user submits with no items.',
};

export const createIssueInputWithMemberAssignee: CreateIssueRequestParams = {
  title: 'Checkout crashes on empty cart',
  description: 'Reproduces on prod when the user submits with no items.',
  assigneeId: MEMBER_USER_ID,
};

export const createIssueInputWithNonMemberAssignee: CreateIssueRequestParams = {
  title: 'Checkout crashes on empty cart',
  description: 'Reproduces on prod when the user submits with no items.',
  assigneeId: NON_MEMBER_USER_ID,
};

export const createIssueInputWithPriority: CreateIssueRequestParams = {
  title: 'Checkout crashes on empty cart',
  description: 'Reproduces on prod when the user submits with no items.',
  priority: IssuePriority.High,
};

export const updateIssueTitleInput: UpdateIssueRequestParams = {
  title: 'Updated title',
};

export const updateIssueWithMemberAssigneeInput: UpdateIssueRequestParams = {
  assigneeId: MEMBER_USER_ID,
};

export const updateIssueWithNonMemberAssigneeInput: UpdateIssueRequestParams = {
  assigneeId: NON_MEMBER_USER_ID,
};

export const createdIssue: Issue = {
  id: ISSUE_ID,
  title: 'Checkout crashes on empty cart',
  description: 'Reproduces on prod when the user submits with no items.',
  status: IssueStatus.ToDo,
  priority: IssuePriority.Medium,
  projectId: PROJECT_ID,
  creator: {
    id: ACTOR_USER_ID,
    name: 'Actor',
    email: 'actor@example.com',
  },
  assignee: {
    id: ACTOR_USER_ID,
    name: 'Actor',
    email: 'actor@example.com',
  },
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const updatedIssue: Issue = {
  ...createdIssue,
  title: 'Updated title',
};
