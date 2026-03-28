import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createTestSupabaseClient(
  schema: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SupabaseClient<any, any, string, any, any> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_ANON_KEY'];

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.test');
  }

  return createClient(url, key, {
    db: { schema },
  });
}
