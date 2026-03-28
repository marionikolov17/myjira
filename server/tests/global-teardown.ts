import './setup';
import { cleanupSchemas } from './utils/schema-cleanup';

export default async function globalTeardown(): Promise<void> {
  await cleanupSchemas();
}
