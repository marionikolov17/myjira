import { ActorContext, IRepository } from '@/common/interfaces';
import { QueryOptions } from '@/common/query';
import { Project } from './project.schema';
import {
  ActorMembershipFilter,
  CreateProjectParams,
  ListProjectsResult,
  UpdateProjectParams,
} from './project.types';
import { CreateProjectRequestParams, UpdateProjectRequestParams } from './project.schema';

export interface IProjectRepository extends IRepository {
  createProject(params: CreateProjectParams): Promise<Project>;
  findProjects(
    options: QueryOptions,
    actorMembershipFilter?: ActorMembershipFilter,
  ): Promise<ListProjectsResult>;
  getProjectById(projectId: string): Promise<Project | null>;
  updateProject(projectId: string, params: UpdateProjectParams): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
}

export interface IProjectService {
  createProject(actor: ActorContext, params: CreateProjectRequestParams): Promise<Project>;
  listProjects(actor: ActorContext, options: QueryOptions): Promise<ListProjectsResult>;
  getProjectById(actor: ActorContext, projectId: string): Promise<Project>;
  updateProject(
    actor: ActorContext,
    projectId: string,
    params: UpdateProjectRequestParams,
  ): Promise<Project>;
  deleteProject(actor: ActorContext, projectId: string): Promise<void>;
}
