import { IAppError, IErrorDetails } from './error.interface';

export abstract class AppError extends Error implements IAppError {
  public readonly code: string;
  public readonly status: number;
  public details?: IErrorDetails;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}
