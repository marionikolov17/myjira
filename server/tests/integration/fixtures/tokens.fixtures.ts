import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';

/**
 * Mints an already-expired token for the given claims by signing with a
 * token service whose expiry is in the past. `expiresInSeconds` is the
 * positive TTL used by the subject fixture; this helper negates it so the
 * resulting token is immediately expired.
 */
export function createExpiredToken(params: {
  secretKey: string;
  expiresInSeconds: number;
  userId: string;
  workspaceRoleId: string;
}): string {
  const { secretKey, expiresInSeconds, userId, workspaceRoleId } = params;

  const expiredTokenService = JsonwebtokenTokenService.create({
    secretKey,
    expiresIn: -expiresInSeconds,
  });

  return expiredTokenService.generateToken({ userId, workspaceRoleId });
}

/**
 * Mints a token signed with a secret the middleware does not recognize, so
 * verification fails.
 */
export function createTokenWithWrongSecret(params: {
  wrongSecretKey: string;
  expiresInSeconds: number;
  userId: string;
  workspaceRoleId: string;
}): string {
  const { wrongSecretKey, expiresInSeconds, userId, workspaceRoleId } = params;

  const wrongSecretTokenService = JsonwebtokenTokenService.create({
    secretKey: wrongSecretKey,
    expiresIn: expiresInSeconds,
  });

  return wrongSecretTokenService.generateToken({ userId, workspaceRoleId });
}
