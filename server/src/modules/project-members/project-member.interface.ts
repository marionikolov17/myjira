import { ActorContext, IRepository } from '@/common/interfaces';
import { ProjectMemberExpanded, ProjectMemberWithRole } from './project-member.schema';
import { AddProjectMemberParams, UpdateProjectMemberRoleParams } from './project-member.types';

export interface CreateProjectMemberParams {
  projectId: string;
  userId: string;
  projectRoleId: string;
}

export interface IProjectMemberRepository extends IRepository {
  getProjectMembersByUserId(userId: string): Promise<ProjectMemberWithRole[]>;
  getProjectMemberByUserAndProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberWithRole | null>;
  createProjectMember(params: CreateProjectMemberParams): Promise<ProjectMemberExpanded>;
  listProjectMembers(projectId: string): Promise<ProjectMemberExpanded[]>;
  getProjectMemberById(memberId: string, projectId: string): Promise<ProjectMemberExpanded | null>;
  updateProjectMemberRole(memberId: string, projectRoleId: string): Promise<ProjectMemberExpanded>;
  deleteProjectMember(memberId: string): Promise<void>;
}

export interface IProjectMemberService {
  addProjectMember(
    actor: ActorContext,
    projectId: string,
    params: AddProjectMemberParams,
  ): Promise<ProjectMemberExpanded>;
  listProjectMembers(actor: ActorContext, projectId: string): Promise<ProjectMemberExpanded[]>;
  updateProjectMemberRole(
    actor: ActorContext,
    projectId: string,
    memberId: string,
    params: UpdateProjectMemberRoleParams,
  ): Promise<ProjectMemberExpanded>;
  removeProjectMember(actor: ActorContext, projectId: string, memberId: string): Promise<void>;
}
