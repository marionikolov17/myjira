import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ValidationError } from '@/common/errors';
import { ActorContext } from '@/common/interfaces';
import { IProjectMemberService } from './project-member.interface';
import {
  AddProjectMemberRequestParamsSchema,
  UpdateProjectMemberRoleRequestParamsSchema,
} from './project-member.schema';

const DISALLOWED_LIST_QUERY_PARAMS = ['page', 'pageSize', 'sort'] as const;

const ProjectIdPathSchema = z.object({ projectId: z.uuid() });
const MemberIdPathSchema = z.object({ memberId: z.uuid() });

export class ProjectMemberController {
  public readonly router: Router;

  constructor(private readonly projectMemberService: IProjectMemberService) {
    this.router = Router({ mergeParams: true });
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/', requireAuthenticationMiddleware, this.addProjectMember.bind(this));
    this.router.get('/', requireAuthenticationMiddleware, this.listProjectMembers.bind(this));
    this.router.patch(
      '/:memberId',
      requireAuthenticationMiddleware,
      this.updateProjectMemberRole.bind(this),
    );
    this.router.delete(
      '/:memberId',
      requireAuthenticationMiddleware,
      this.removeProjectMember.bind(this),
    );
  }

  private async addProjectMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = AddProjectMemberRequestParamsSchema.parse(body);

      const member = await this.projectMemberService.addProjectMember(
        req.actor as ActorContext,
        projectId,
        validatedParams,
      );

      res.status(201).json({ data: member });
    } catch (error) {
      next(error);
    }
  }

  private async listProjectMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);

      assertNoListQueryParameters(req.query);

      const members = await this.projectMemberService.listProjectMembers(
        req.actor as ActorContext,
        projectId,
      );

      res.status(200).json({ data: members });
    } catch (error) {
      next(error);
    }
  }

  private async updateProjectMemberRole(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { memberId } = parseMemberIdParam(req);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = UpdateProjectMemberRoleRequestParamsSchema.parse(body);

      const member = await this.projectMemberService.updateProjectMemberRole(
        req.actor as ActorContext,
        projectId,
        memberId,
        validatedParams,
      );

      res.status(200).json({ data: member });
    } catch (error) {
      next(error);
    }
  }

  private async removeProjectMember(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { memberId } = parseMemberIdParam(req);

      await this.projectMemberService.removeProjectMember(
        req.actor as ActorContext,
        projectId,
        memberId,
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

function parseProjectIdParam(req: Request): { projectId: string } {
  const parsed = ProjectIdPathSchema.parse({ projectId: req.params['projectId'] });
  return parsed;
}

function parseMemberIdParam(req: Request): { memberId: string } {
  const parsed = MemberIdPathSchema.parse({ memberId: req.params['memberId'] });
  return parsed;
}

function assertNoListQueryParameters(query: Request['query']): void {
  const offending: { name: string; message: string }[] = [];

  for (const name of DISALLOWED_LIST_QUERY_PARAMS) {
    if (query[name] !== undefined) {
      offending.push({ name, message: `The '${name}' query parameter is not supported` });
    }
  }

  for (const key of Object.keys(query)) {
    if (key.startsWith('filter[') || key === 'filter') {
      offending.push({ name: key, message: `The '${key}' query parameter is not supported` });
    }
  }

  if (offending.length > 0) {
    throw new ValidationError(offending);
  }
}
