import { Pool, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';

let pool: Pool | null = null;
let initialized = false;

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
        : { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  if (!initialized) {
    await initDatabase();
  }
  const p = getPool();
  return p.query<T>(text, params);
}

export async function initDatabase() {
  if (initialized) return;
  const p = getPool();
  try {
    // Check if site_settings table exists
    const res = await p.query("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_settings')");
    const exists = res.rows[0]?.exists;
    if (!exists) {
      console.log('Initializing database schema and seed data...');
      
      // Try multiple path resolutions to ensure it works under vitest, local next dev, and serverless envs
      const possibleDirs = [
        path.join(process.cwd(), 'db'),
        path.join(process.cwd(), 'storefront/db'),
        path.join(__dirname, '../db'),
        path.join(__dirname, '../../db')
      ];
      
      let schemaSql = '';
      let seedSql = '';
      let loaded = false;
      
      for (const dir of possibleDirs) {
        try {
          const schemaPath = path.join(dir, 'schema.sql');
          const seedPath = path.join(dir, 'seed.sql');
          if (fs.existsSync(schemaPath) && fs.existsSync(seedPath)) {
            schemaSql = fs.readFileSync(schemaPath, 'utf8');
            seedSql = fs.readFileSync(seedPath, 'utf8');
            loaded = true;
            break;
          }
        } catch {}
      }
      
      if (!loaded) {
        throw new Error('Could not locate schema.sql and seed.sql files.');
      }
      
      await p.query(schemaSql);
      await p.query(seedSql);
      console.log('Database initialized successfully.');
    }
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Do not set initialized to true so that it retries on next request
  }
}
