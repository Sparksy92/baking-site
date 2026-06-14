import { Pool, QueryResult, QueryResultRow } from 'pg';
import { SCHEMA_SQL, SEED_SQL } from './db-schema';

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 2, // Tighten pool size for serverless environment
      idleTimeoutMillis: 5000, // Close idle connections quickly
      connectionTimeoutMillis: 5000, // Fail fast if DB is unreachable
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

export async function initDatabase(force: boolean = false) {
  const p = getPool();
  
  // If not forced, check if site_settings table already exists
  if (!force) {
    try {
      const res = await p.query("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_settings')");
      const exists = res.rows[0]?.exists;
      if (exists) {
        console.log('Database already initialized. site_settings table exists. Ensuring media_assets table exists...');
        await p.query(`
          CREATE TABLE IF NOT EXISTS media_assets (
              id SERIAL PRIMARY KEY,
              url TEXT NOT NULL,
              pathname TEXT,
              filename TEXT,
              alt_text TEXT,
              content_type TEXT,
              size_bytes INTEGER,
              source TEXT DEFAULT 'vercel_blob',
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        return { success: true, message: 'Database already initialized. Verified media_assets table exists.' };
      }
    } catch (err) {
      console.log('Error checking table existence, proceeding with init:', err);
    }
  }

  console.log('Initializing database schema and seed data...');
  
  await p.query(SCHEMA_SQL);
  await p.query(SEED_SQL);
  console.log('Database initialized successfully.');
  return { success: true, message: 'Database initialized successfully.' };
}
