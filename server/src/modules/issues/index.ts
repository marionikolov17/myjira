import { logger } from '@/common/logger';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';
import { projectRepository } from '@/modules/projects/project.repository';
import { projectMemberRepository } from '@/modules/project-members';
import { IssueController } from './issue.controller';
import { IssueService } from './issue.service';
import { issueRepository } from './issue.repository';
import { issuesQueryConfig } from './issue.query-config';

export * from './issue.schema';
export * from './issue.interface';
export * from './issue.types';
export * from './issue.repository';
export * from './issue.service';
export * from './issue.query-config';

const issueService = new IssueService(
  issueRepository,
  projectRepository,
  projectMemberRepository,
  authorizationGuard,
  logger,
);

const issueController = new IssueController(issueService, queryParser, issuesQueryConfig);

export { issueService, issueController };
