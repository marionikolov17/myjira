import { ActorContext, IRepository } from '@/common/interfaces';
import { QueryOptions } from '@/common/query';
import { Issue, CreateIssueRequestParams, UpdateIssueRequestParams } from './issue.schema';
import { CreateIssueParams, ListIssuesResult, UpdateIssueParams } from './issue.types';

export interface IIssueRepository extends IRepository {
  createIssue(params: CreateIssueParams): Promise<Issue>;
  findIssues(options: QueryOptions, projectId: string): Promise<ListIssuesResult>;
  getIssueById(issueId: string, projectId: string): Promise<Issue | null>;
  updateIssue(issueId: string, params: UpdateIssueParams): Promise<Issue>;
  deleteIssue(issueId: string): Promise<void>;
}

export interface IIssueService {
  createIssue(
    actor: ActorContext,
    projectId: string,
    params: CreateIssueRequestParams,
  ): Promise<Issue>;
  listIssues(
    actor: ActorContext,
    projectId: string,
    options: QueryOptions,
  ): Promise<ListIssuesResult>;
  getIssueById(actor: ActorContext, projectId: string, issueId: string): Promise<Issue>;
  updateIssue(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    params: UpdateIssueRequestParams,
  ): Promise<Issue>;
  deleteIssue(actor: ActorContext, projectId: string, issueId: string): Promise<void>;
}
