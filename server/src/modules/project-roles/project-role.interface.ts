import { IRepository } from '@/common/interfaces';
import { ProjectRole, ProjectRoleName } from './project-role.schema';

export interface IProjectRoleRepository extends IRepository {
  getProjectRoles(): Promise<ProjectRole[]>;
  getProjectRoleById(id: string): Promise<ProjectRole | null>;
  getProjectRoleIdByName(name: ProjectRoleName): Promise<string>;
}
