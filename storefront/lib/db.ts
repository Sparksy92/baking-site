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
        console.log('Ensuring all multi-goal Oven Fund, contact, and brand settings exist in site_settings...');
        await p.query(`
          INSERT INTO site_settings (key, value) VALUES
          ('contact_email', 'hello@sageandsweetgrass.ca'),
          ('etransfer_email', 'payments@sageandsweetgrass.ca'),
          ('oven_fund_title', 'Commercial Oven Upgrade Fund — Phase 1'),
          ('oven_fund_goal', '2500'),
          ('oven_fund_current_amount', '1620'),
          ('oven_fund_description', 'Help us prepare for a commercial stone-deck baking oven by funding the first-stage upgrade: electrical preparation, oven stand, baking trays, proofing tools, and the first deposit toward increased baking capacity.'),
          ('oven_fund_title_2', 'Outdoor Wood-Fired Brick Oven'),
          ('oven_fund_goal_2', '5000'),
          ('oven_fund_current_amount_2', '750'),
          ('oven_fund_description_2', 'Build a traditional outdoor clay wood-fired brick oven and workbench prep area in the garden for seasonal community baking runs, rustic sourdough, flatbreads, and future workshops.'),
          ('brand_name', 'Sage & Sweetgrass Homestead'),
          ('brand_tagline', 'Fresh baking, pantry goods & handmade homestead care'),
          ('brand_abbreviation', 'SSH')
          ON CONFLICT (key) DO NOTHING;
        `);
        
        // Reset brand name/tagline/abbreviation if they are currently set to test values ('Automated Brand') or empty or legacy names
        await p.query(`
          INSERT INTO site_settings (key, value) VALUES
          ('brand_name', 'Sage & Sweetgrass Homestead'),
          ('brand_tagline', 'Fresh baking, pantry goods & handmade homestead care'),
          ('brand_abbreviation', 'SSH')
          ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value
          WHERE site_settings.value = 'Automated Brand' 
             OR site_settings.value = '' 
             OR site_settings.value LIKE '%Cedar%';
        `);
        // Migrate legacy "Cedar & Sage" settings and emails to "Sage & Sweetgrass Homestead" and correct domains
        await p.query(`
          UPDATE site_settings 
          SET value = REPLACE(value, 'Cedar & Sage', 'Sage & Sweetgrass Homestead') 
          WHERE value LIKE '%Cedar & Sage%';
          UPDATE site_settings 
          SET value = REPLACE(value, 'Cedar and Sage', 'Sage & Sweetgrass Homestead') 
          WHERE value LIKE '%Cedar and Sage%';
          UPDATE site_settings 
          SET value = REPLACE(value, 'kirstinsparks@hotmail.com', 'hello@sageandsweetgrass.ca') 
          WHERE key = 'contact_email';
          UPDATE site_settings 
          SET value = REPLACE(value, 'kirstinsparks@hotmail.com', 'payments@sageandsweetgrass.ca') 
          WHERE key = 'etransfer_email' OR key = 'payment_instructions';
          UPDATE site_settings 
          SET value = REPLACE(value, 'payments@example.com', 'payments@sageandsweetgrass.ca') 
          WHERE value LIKE '%payments@example.com%';
          UPDATE site_settings 
          SET value = REGEXP_REPLACE(value, '[a-zA-Z0-9._%+-]+@cedar(and)?sage(homestead)?\.(ca|com)', 'hello@sageandsweetgrass.ca', 'g') 
          WHERE value ~ '@cedar(and)?sage(homestead)?\.(ca|com)';
        `);
        return { success: true, message: 'Database already initialized. Verified media_assets table, migrated legacy setting names, and ensured multi-goal settings.' };
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
