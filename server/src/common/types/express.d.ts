import { ActorContext } from '@/common/interfaces';

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
    }
  }
}

export {};
