import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger } from '@/common/logger';
import { ProjectRepository } from '@/modules/projects/project.repository';
import { ProjectMemberRepository } from '@/modules/project-members';
import { IUnitOfWork, TransactionalRepos } from './unit-of-work.interface';

export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: ILogger,
  ) {}

  public run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repos: TransactionalRepos = {
        projects: new ProjectRepository(tx, this.logger),
        projectMembers: new ProjectMemberRepository(tx, this.logger),
      };

      return work(repos);
    });
  }
}
