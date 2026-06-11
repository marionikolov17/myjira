import { LoginParams } from './auth.schema';

export interface IAuthService {
  login(params: LoginParams): Promise<string>;
}
