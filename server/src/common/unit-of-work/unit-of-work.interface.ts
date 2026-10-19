import { IProjectRepository } from '@/modules/projects/project.interface';
import { IProjectMemberRepository } from '@/modules/project-members';

export interface TransactionalRepos {
  projects: IProjectRepository;
  projectMembers: IProjectMemberRepository;
}

export interface IUnitOfWork {
  run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
