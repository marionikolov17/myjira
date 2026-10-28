import type { LoginInput } from '@/lib/api/schemas'
import { transport } from '@/lib/api/transport'

export { demoCredentials } from '@/lib/api/transport'

export const authClient = {
  login: (input: LoginInput) => transport.login(input),
  getCurrentUser: () => transport.getCurrentUser(),
}
