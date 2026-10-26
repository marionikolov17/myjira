import express, { Application } from 'express';

import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { IProjectRoleRepository, ProjectRoleRepository } from '@/modules/project-roles';
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
import { Issue } from '@/modules/issues/issue.schema';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { buildTestUsers } from '../../fixtures/actor-context.fixtures';

export const SECRET_KEY = 'issues-test-secret-key';
export const WRONG_SECRET_KEY = 'issues-test-wrong-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers = buildTestUsers('issues-');

export interface IssuesTestContext {
  app: Application;
  tokenService: ITokenService;
  issueRepository: IIssueRepository;
  projectRepository: IProjectRepository;
  projectMemberRepository: IProjectMemberRepository;
  projectRoleRepository: IProjectRoleRepository;
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
  const projectRoleRepository = new ProjectRoleRepository(prisma, silentLogger);
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
    projectRoleRepository,
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

/**
 * Loads an issue (with its expanded relations) directly from the DB — used by
 * the integration-test assertions to prove persisted state.
 */
export async function fetchIssueWithRelations(
  issueId: string,
): Promise<(Issue & { creatorId: string; assigneeId: string }) | null> {
  const row = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as IssueStatus,
    priority: row.priority as IssuePriority,
    projectId: row.projectId,
    creator: row.creator,
    assignee: row.assignee,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
  };
}
