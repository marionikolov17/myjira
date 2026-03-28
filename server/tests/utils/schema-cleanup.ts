import { createPgClient } from '../lib';
import { dropOrphanedSchemas } from '../lib/schema-manager';

export async function cleanupSchemas(): Promise<void> {
  const pgClient = createPgClient();
  await pgClient.connect();
  await dropOrphanedSchemas(pgClient);
  await pgClient.end();
}
