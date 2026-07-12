import { ActorContext } from '@/common/interfaces';
import { TokenPayload } from '@/common/token-service';

export interface IActorContextService {
  buildActorContext(payload: TokenPayload): Promise<ActorContext>;
}
