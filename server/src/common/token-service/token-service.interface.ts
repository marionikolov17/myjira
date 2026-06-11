import { GenerateTokenPayload, TokenPayload } from './token-service.schema';

export interface ITokenService {
  generateToken(payload: GenerateTokenPayload): string;
  verifyToken(token: string): TokenPayload;
}
