import { Pool, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';

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
        console.log('Database already initialized. site_settings table exists.');
        return { success: true, message: 'Database already initialized.' };
      }
    } catch (err) {
      console.log('Error checking table existence, proceeding with init:', err);
    }
  }

  console.log('Initializing database schema and seed data...');
  
  const possibleDirs = [
    path.join(process.cwd(), 'db'),
    path.join(process.cwd(), 'storefront/db'),
    path.join(process.cwd(), '.next/server/db'), // fallback for Vercel bundling
  ];
  
  let schemaSql = '';
  let seedSql = '';
  let loaded = false;
  let triedPaths: string[] = [];
  
  for (const dir of possibleDirs) {
    try {
      const schemaPath = path.join(dir, 'schema.sql');
      const seedPath = path.join(dir, 'seed.sql');
      triedPaths.push(schemaPath);
      if (fs.existsSync(schemaPath) && fs.existsSync(seedPath)) {
        schemaSql = fs.readFileSync(schemaPath, 'utf8');
        seedSql = fs.readFileSync(seedPath, 'utf8');
        loaded = true;
        break;
      }
    } catch {}
  }
  
  if (!loaded) {
    throw new Error(`Could not locate schema.sql and seed.sql files. Tried paths: ${triedPaths.join(', ')}`);
  }
  
  // Split statements by semicolon if needed, or run as a single query since pg allows multiple statements in one query string
  await p.query(schemaSql);
  await p.query(seedSql);
  console.log('Database initialized successfully.');
  return { success: true, message: 'Database initialized successfully.' };
}
