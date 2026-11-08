import { logger } from '@/common/logger';
import { authorizationGuard } from '@/common/authorization';
import { issueRepository } from '@/modules/issues/issue.repository';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { commentRepository } from './comment.repository';

export * from './comment.schema';
export * from './comment.interface';
export * from './comment.types';
export * from './comment.repository';
export * from './comment.service';

const commentService = new CommentService(
  commentRepository,
  issueRepository,
  authorizationGuard,
  logger,
);

const commentController = new CommentController(commentService);

export { commentService, commentController };
