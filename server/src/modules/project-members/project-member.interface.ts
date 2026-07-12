import { IRepository } from '@/common/interfaces';
import { ProjectMemberWithRole } from './project-member.schema';

export interface IProjectMemberRepository extends IRepository {
  getProjectMembersByUserId(userId: string): Promise<ProjectMemberWithRole[]>;
}
