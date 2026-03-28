import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { quoteIdent } from './quote-ident';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

export function getMigrationSql(schema: string): string {
  const files = getMigrationSqlFiles();

  let sql = readMigrationSqlFiles(files);

  sql = rewriteSchemaReferences(sql, schema);

  return sql;
}

function getMigrationSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readMigrationSqlFiles(files: string[]): string {
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8')).join('\n');
}

function rewriteSchemaReferences(sql: string, schema: string): string {
  const quotedSchema = quoteIdent(schema);
  return sql
    .replaceAll('"public".', `${quotedSchema}.`)
    .replace(/\bpublic\./g, `${quotedSchema}.`)
    .replace(/SCHEMA\s+"public"/gi, `SCHEMA ${quotedSchema}`);
}
