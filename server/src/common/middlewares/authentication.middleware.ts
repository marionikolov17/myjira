import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ITokenService, TokenPayload } from '@/common/token-service';
import type { IActorContextService } from '@/modules/auth/actor-context.interface';
import { AuthenticationError } from '@/common/errors';

const BEARER_SCHEME = 'Bearer';

export interface AuthenticationMiddlewareDependencies {
  tokenService: ITokenService;
  actorContextService: IActorContextService;
}

export function createAuthenticationMiddleware(
  dependencies: AuthenticationMiddlewareDependencies,
): RequestHandler {
  const { tokenService, actorContextService } = dependencies;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      next();
      return;
    }

    const payload = verifyTokenOrNull(tokenService, token);
    if (!payload) {
      next();
      return;
    }

    try {
      req.actor = await actorContextService.buildActorContext(payload);
    } catch (error) {
      if (!(error instanceof AuthenticationError)) {
        next(error);
        return;
      }
    }

    next();
  };
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  if (scheme?.toLowerCase() !== BEARER_SCHEME.toLowerCase() || !token) {
    return null;
  }

  return token;
}

function verifyTokenOrNull(tokenService: ITokenService, token: string): TokenPayload | null {
  try {
    return tokenService.verifyToken(token);
  } catch {
    return null;
  }
}
