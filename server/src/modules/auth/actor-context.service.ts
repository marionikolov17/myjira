import { ActorContext } from '@/common/interfaces';
import { AuthenticationError } from '@/common/errors';
import { ILogger } from '@/common/logger';
import { TokenPayload } from '@/common/token-service';
import { IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository } from '@/modules/project-members';
import { IActorContextService } from './actor-context.interface';

export class ActorContextService implements IActorContextService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly workspaceRoleRepository: IWorkspaceRoleRepository,
    private readonly projectMemberRepository: IProjectMemberRepository,
    private readonly logger: ILogger,
  ) {}

  public async buildActorContext(payload: TokenPayload): Promise<ActorContext> {
    const user = await this.userRepository.getUserById(payload.userId);
    if (!user) {
      this.logger.error('Cannot build actor context: user no longer exists', {
        userId: payload.userId,
      });
      throw new AuthenticationError();
    }

    const workspaceRole = await this.workspaceRoleRepository.getWorkspaceRoleById(
      payload.workspaceRoleId,
    );
    if (!workspaceRole) {
      this.logger.error('Cannot build actor context: workspace role not found', {
        userId: payload.userId,
        workspaceRoleId: payload.workspaceRoleId,
      });
      throw new AuthenticationError();
    }

    const projectMembers = await this.projectMemberRepository.getProjectMembersByUserId(user.id);

    return {
      userId: user.id,
      workspaceRole: {
        id: workspaceRole.id,
        name: workspaceRole.name,
      },
      projectRoles: projectMembers.map((member) => ({
        projectId: member.projectId,
        projectRoleId: member.projectRole.id,
        projectRoleName: member.projectRole.name,
      })),
    };
  }
}
