import express, { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { ProjectRoleName } from '@/modules/project-roles';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { IProjectRepository, ProjectRepository } from '@/modules/projects';
import {
  IIssueRepository,
  IssueRepository,
  IssueService,
  IssueStatus,
  IssuePriority,
  issuesQueryConfig,
} from '@/modules/issues';
import { IssueController } from '@/modules/issues/issue.controller';

import { silentLogger } from '../../fixtures/logger.fixtures';
import {
  buildTestUsers,
  fetchPersistedUsers,
  userToActorContext,
} from '../../fixtures/actor-context.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import { seedProjectMembership } from '../../fixtures/project-members.fixtures';
import { fetchProjectRoleIdByName } from '../../fixtures/project-roles.fixtures';

export const SECRET_KEY = 'issues-test-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers = buildTestUsers('issues-');

export interface IssuesTestContext {
  app: Application;
  tokenService: ITokenService;
  issueRepository: IIssueRepository;
  projectRepository: IProjectRepository;
  projectMemberRepository: IProjectMemberRepository;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
}

/**
 * Builds an issues test app whose request pipeline mirrors production: the
 * global passive authentication middleware runs before the issues router,
 * which is mounted under `/api/v1/projects/:projectId/issues` with
 * `mergeParams: true` so it sees `req.params.projectId`.
 *
 * NB! The exposed repositories and token service are the SAME instances
 * injected into the authentication middleware and the issue service.
 * Spy on them to inject failures.
 */
export function createIssuesTestContext(): IssuesTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);
  const projectMemberRepository = new ProjectMemberRepository(prisma, silentLogger);
  const projectRepository = new ProjectRepository(prisma, silentLogger);
  const issueRepository = new IssueRepository(prisma, silentLogger);

  const tokenService = JsonwebtokenTokenService.create({
    secretKey: SECRET_KEY,
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
  });

  const actorContextService = new ActorContextService(
    userRepository,
    workspaceRoleRepository,
    projectMemberRepository,
    silentLogger,
  );

  const authenticationMiddleware = createAuthenticationMiddleware({
    tokenService,
    actorContextService,
  });

  const issueService = new IssueService(
    issueRepository,
    projectRepository,
    projectMemberRepository,
    authorizationGuard,
    silentLogger,
  );

  const issueController = new IssueController(issueService, queryParser, issuesQueryConfig);

  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(authenticationMiddleware);
  app.use('/api/v1/projects/:projectId/issues', issueController.router);
  app.use(errorMiddleware);

  return {
    app,
    tokenService,
    issueRepository,
    projectRepository,
    projectMemberRepository,
    userRepository,
    workspaceRoleRepository,
  };
}

export interface SeededIssue {
  id: string;
  projectId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
}

/**
 * Seeds an issue row directly via Prisma (bypassing the controller/service).
 */
export async function seedIssue(params: {
  projectId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string;
  status?: IssueStatus;
  priority?: IssuePriority;
}): Promise<SeededIssue> {
  const row = await prisma.issue.create({
    data: {
      projectId: params.projectId,
      creatorId: params.creatorId,
      assigneeId: params.assigneeId,
      title: params.title,
      description: params.description,
      status: params.status ?? IssueStatus.ToDo,
      priority: params.priority ?? IssuePriority.Medium,
    },
    select: {
      id: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      title: true,
      description: true,
      status: true,
      priority: true,
    },
  });
  return {
    id: row.id,
    projectId: row.projectId,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
    title: row.title,
    description: row.description,
    status: row.status as IssueStatus,
    priority: row.priority as IssuePriority,
  };
}

export async function wipeIssueGraph(): Promise<void> {
  await prisma.issue.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
}

export async function wipeUsers(): Promise<void> {
  await prisma.user.deleteMany();
}

/**
 * Workspace-scoped actors + project role ids resolved from the seeded
 * `testUsers` matrix. Call after `createTestUsers(testUsers)`.
 */
export interface IssueWorkspaceActors {
  workspaceOwnerActor: ActorContext;
  workspaceAdminActor: ActorContext;
  workspaceDeveloperActor: ActorContext;
  projectOwnerRoleId: string;
  projectAdminRoleId: string;
  developerRoleId: string;
  /** Convenience: the Workspace Admin's user id (a project member after seeding). */
  memberAssigneeUserId: string;
}

export async function loadIssueWorkspaceActors(): Promise<IssueWorkspaceActors> {
  const [owner, admin, developer] = await fetchPersistedUsers(testUsers);
  if (!owner || !admin || !developer) {
    throw new Error('Expected seeded users to exist');
  }

  return {
    workspaceOwnerActor: userToActorContext(owner, []),
    workspaceAdminActor: userToActorContext(admin, []),
    workspaceDeveloperActor: userToActorContext(developer, []),
    projectOwnerRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_OWNER),
    projectAdminRoleId: await fetchProjectRoleIdByName(ProjectRoleName.PROJECT_ADMIN),
    developerRoleId: await fetchProjectRoleIdByName(ProjectRoleName.DEVELOPER),
    memberAssigneeUserId: admin.id,
  };
}

export interface SeededIssueProject {
  projectId: string;
  projectOwnerActor: ActorContext;
  projectAdminActor: ActorContext;
  projectDeveloperActor: ActorContext;
}

/**
 * Seeds a target project with the three standard memberships (Owner / Admin /
 * Developer) and returns the corresponding project-scoped actors. Does not
 * wipe existing rows — callers own lifecycle via `wipeIssueGraph`.
 */
export async function seedStandardIssueProject(
  actors: IssueWorkspaceActors,
): Promise<SeededIssueProject> {
  const {
    workspaceOwnerActor,
    workspaceAdminActor,
    workspaceDeveloperActor,
    projectOwnerRoleId,
    projectAdminRoleId,
    developerRoleId,
  } = actors;

  const project = await seedProject(workspaceOwnerActor.userId, 'Target', 'Target desc');

  await seedProjectMembership(
    project.id,
    workspaceOwnerActor.userId,
    ProjectRoleName.PROJECT_OWNER,
  );
  await seedProjectMembership(
    project.id,
    workspaceAdminActor.userId,
    ProjectRoleName.PROJECT_ADMIN,
  );
  await seedProjectMembership(
    project.id,
    workspaceDeveloperActor.userId,
    ProjectRoleName.DEVELOPER,
  );

  return {
    projectId: project.id,
    projectOwnerActor: {
      ...workspaceOwnerActor,
      projectRoles: [
        {
          projectId: project.id,
          projectRoleId: projectOwnerRoleId,
          projectRoleName: ProjectRoleName.PROJECT_OWNER,
        },
      ],
    },
    projectAdminActor: {
      ...workspaceAdminActor,
      projectRoles: [
        {
          projectId: project.id,
          projectRoleId: projectAdminRoleId,
          projectRoleName: ProjectRoleName.PROJECT_ADMIN,
        },
      ],
    },
    projectDeveloperActor: {
      ...workspaceDeveloperActor,
      projectRoles: [
        {
          projectId: project.id,
          projectRoleId: developerRoleId,
          projectRoleName: ProjectRoleName.DEVELOPER,
        },
      ],
    },
  };
}
