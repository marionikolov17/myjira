import { getMigrationSql } from '../utils/migration-loader';
import { IPgClient } from './pg-client.interface';
import { quoteIdent } from '../utils/quote-ident';
import { ISchemaManager } from './schema-manager.interface';

const SCHEMA_PREFIX = 'test_';
export function getTestSchema(): string {
  return `${SCHEMA_PREFIX}${process.env['JEST_WORKER_ID'] ?? '0'}`;
}

export async function dropOrphanedSchemas(pgClient: IPgClient): Promise<void> {
  const result = await pgClient.query<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1`,
    [`${SCHEMA_PREFIX}%`],
  );

  for (const row of result.rows) {
    try {
      await pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(row.schema_name)} CASCADE`);
    } catch (error) {
      console.error(
        `Failed to drop schema ${quoteIdent(row.schema_name)}: ${(error as Error).message}`,
      );
    }
  }
}

export class SchemaManager implements ISchemaManager {
  constructor(private readonly pgClient: IPgClient) {}

  public async recreateSchema(schema: string): Promise<void> {
    await this.pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
    await this.pgClient.query(`CREATE SCHEMA ${quoteIdent(schema)}`);

    const migrationSql = getMigrationSql(schema);
    await this.pgClient.query(migrationSql);

    await this.pgClient.query(`NOTIFY pgrst, 'reload schema'`);
  }

  public async truncateSchema(schema: string): Promise<void> {
    const result = await this.pgClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [schema],
    );

    const tables = result.rows.map((row) => `${quoteIdent(schema)}.${quoteIdent(row.tablename)}`);

    if (tables.length > 0) {
      await this.pgClient.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
    }
  }

  public async dropSchema(schema: string): Promise<void> {
    await this.pgClient.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
  }
}

export function createSchemaManager(pgClient: IPgClient): ISchemaManager {
  return new SchemaManager(pgClient);
}
