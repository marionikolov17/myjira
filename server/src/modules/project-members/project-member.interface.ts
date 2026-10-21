import { IRepository } from '@/common/interfaces';
import { ProjectMemberWithRole, ProjectRoleName } from './project-member.schema';

export interface CreateProjectMemberParams {
  projectId: string;
  userId: string;
  projectRoleId: string;
}

export interface IProjectMemberRepository extends IRepository {
  getProjectMembersByUserId(userId: string): Promise<ProjectMemberWithRole[]>;
  createProjectMember(params: CreateProjectMemberParams): Promise<void>;
  getProjectRoleIdByName(name: ProjectRoleName): Promise<string>;
}
