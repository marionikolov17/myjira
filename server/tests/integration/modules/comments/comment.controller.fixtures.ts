import express, { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { ProjectRoleName } from '@/modules/project-roles';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { IProjectRepository, ProjectRepository } from '@/modules/projects';
import { IIssueRepository, IssueRepository } from '@/modules/issues';
import { Comment, CommentRepository, CommentService, ICommentRepository } from '@/modules/comments';
import { CommentController } from '@/modules/comments/comment.controller';

import { silentLogger } from '../../fixtures/logger.fixtures';
import {
  buildTestUsers,
  fetchPersistedUsers,
  userToActorContext,
} from '../../fixtures/actor-context.fixtures';
import { seedProject } from '../../fixtures/projects.fixtures';
import { seedProjectMembership } from '../../fixtures/project-members.fixtures';
import { fetchProjectRoleIdByName } from '../../fixtures/project-roles.fixtures';
import { seedIssue } from '../../fixtures/issues.fixtures';

export const SECRET_KEY = 'comments-test-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers = buildTestUsers('comments-');

export interface CommentsTestContext {
  app: Application;
  tokenService: ITokenService;
  commentRepository: ICommentRepository;
  issueRepository: IIssueRepository;
  projectRepository: IProjectRepository;
  projectMemberRepository: IProjectMemberRepository;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
}

/**
 * Builds a comments test app whose request pipeline mirrors production: the
 * global passive authentication middleware runs before the comments router,
 * which is mounted under `/api/v1/projects/:projectId/issues/:issueId/comments`
 * with `mergeParams: true` so it sees both `projectId` and `issueId` path
 * parameters.
 *
 * NB! The exposed repositories and token service are the SAME instances
 * injected into the authentication middleware and the comment service.
 * Spy on them to inject failures.
 */
export function createCommentsTestContext(): CommentsTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);
  const projectMemberRepository = new ProjectMemberRepository(prisma, silentLogger);
  const projectRepository = new ProjectRepository(prisma, silentLogger);
  const issueRepository = new IssueRepository(prisma, silentLogger);
  const commentRepository = new CommentRepository(prisma, silentLogger);

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

  const commentService = new CommentService(
    commentRepository,
    issueRepository,
    authorizationGuard,
    silentLogger,
  );

  const commentController = new CommentController(commentService);

  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(authenticationMiddleware);
  app.use('/api/v1/projects/:projectId/issues/:issueId/comments', commentController.router);
  app.use(errorMiddleware);

  return {
    app,
    tokenService,
    commentRepository,
    issueRepository,
    projectRepository,
    projectMemberRepository,
    userRepository,
    workspaceRoleRepository,
  };
}

export interface SeededComment {
  id: string;
  issueId: string;
  creatorId: string;
  body: string;
}

/**
 * Seeds a comment row directly via Prisma (bypassing the controller/service).
 */
export async function seedComment(params: {
  issueId: string;
  creatorId: string;
  body: string;
}): Promise<SeededComment> {
  const row = await prisma.comment.create({
    data: {
      issueId: params.issueId,
      creatorId: params.creatorId,
      body: params.body,
    },
    select: {
      id: true,
      issueId: true,
      creatorId: true,
      body: true,
    },
  });
  return {
    id: row.id,
    issueId: row.issueId,
    creatorId: row.creatorId,
    body: row.body,
  };
}

export async function wipeCommentGraph(): Promise<void> {
  await prisma.comment.deleteMany();
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
export interface CommentWorkspaceActors {
  workspaceOwnerActor: ActorContext;
  workspaceAdminActor: ActorContext;
  workspaceDeveloperActor: ActorContext;
  projectOwnerRoleId: string;
  projectAdminRoleId: string;
  developerRoleId: string;
}

export async function loadCommentWorkspaceActors(): Promise<CommentWorkspaceActors> {
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
  };
}

export interface SeededCommentIssue {
  projectId: string;
  issueId: string;
  projectOwnerActor: ActorContext;
  projectAdminActor: ActorContext;
  projectDeveloperActor: ActorContext;
}

/**
 * Seeds a target project with the three standard memberships (Owner / Admin /
 * Developer), seeds an issue in it, and returns the corresponding project-
 * scoped actors. Does not wipe existing rows — callers own lifecycle via
 * `wipeCommentGraph`.
 */
export async function seedStandardCommentIssue(
  actors: CommentWorkspaceActors,
): Promise<SeededCommentIssue> {
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

  const issue = await seedIssue({
    projectId: project.id,
    creatorId: workspaceOwnerActor.userId,
    assigneeId: workspaceOwnerActor.userId,
    title: 'Target issue',
    description: 'target desc',
  });

  return {
    projectId: project.id,
    issueId: issue.id,
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

export type { Comment };
