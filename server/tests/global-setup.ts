import './setup';
import { cleanupSchemas } from './utils/schema-cleanup';

export default async function globalSetup(): Promise<void> {
  await cleanupSchemas();
}
