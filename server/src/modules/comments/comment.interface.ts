import { ActorContext, IRepository } from '@/common/interfaces';
import { Comment, CreateCommentRequestParams } from './comment.schema';
import { CreateCommentParams } from './comment.types';

export interface ICommentRepository extends IRepository {
  createComment(params: CreateCommentParams): Promise<Comment>;
  getCommentsByIssueId(issueId: string): Promise<Comment[]>;
  getCommentById(commentId: string, issueId: string): Promise<Comment | null>;
  deleteComment(commentId: string): Promise<void>;
}

export interface ICommentService {
  listComments(actor: ActorContext, projectId: string, issueId: string): Promise<Comment[]>;
  createComment(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    params: CreateCommentRequestParams,
  ): Promise<Comment>;
  deleteComment(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    commentId: string,
  ): Promise<void>;
}
