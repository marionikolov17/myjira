import { Paginated } from '@/common/query';
import { Project } from './project.schema';

/*
==============================
Repository Project Types
==============================
*/

export interface CreateProjectParams {
  name: string;
  description: string;
  creatorId: string;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
}

export type ListProjectsResult = Paginated<Project>;

export type ActorMembershipFilter = { userId: string } | undefined;
