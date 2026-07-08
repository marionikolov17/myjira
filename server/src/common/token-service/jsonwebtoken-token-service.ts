import jwt from 'jsonwebtoken';
import { AuthenticationError } from '@/common/errors';
import { JsonwebtokenTokenServiceConfig } from './jsonwebtoken-token-service.types';
import { ITokenService } from './token-service.interface';
import { GenerateTokenPayload, TokenPayload, TokenPayloadSchema } from './token-service.schema';

export class JsonwebtokenTokenService implements ITokenService {
  private constructor(
    private readonly secretKey: string,
    private readonly expiresIn: number,
  ) {}

  public static create(config: JsonwebtokenTokenServiceConfig): JsonwebtokenTokenService {
    return new JsonwebtokenTokenService(config.secretKey, config.expiresIn);
  }

  public generateToken(payload: GenerateTokenPayload): string {
    return jwt.sign(payload, this.secretKey, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
    });
  }

  public verifyToken(token: string): TokenPayload {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.secretKey, { algorithms: ['HS256'] });
    } catch {
      throw new AuthenticationError();
    }

    const parsedPayload = TokenPayloadSchema.safeParse(decoded);
    if (!parsedPayload.success) {
      throw new AuthenticationError();
    }

    return parsedPayload.data;
  }
}
