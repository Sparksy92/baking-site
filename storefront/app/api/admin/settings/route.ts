import { NextResponse, NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Run self-healing updates on site_settings
    await query(`
      INSERT INTO site_settings (key, value) VALUES
      ('brand_name', 'The Artisan Bakery'),
      ('brand_tagline', 'Fresh baking, pantry goods & handmade home and body care'),
      ('brand_abbreviation', 'SSH'),
      ('contact_email', 'hello@theartisanbakery.test'),
      ('etransfer_email', 'payments@theartisanbakery.test')
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value
      WHERE site_settings.value = 'Automated Brand' 
         OR site_settings.value = '' 
         OR site_settings.value = 'Homestead'
         OR site_settings.value LIKE '%Cedar%'
         OR site_settings.value LIKE '%homestead care%';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'The Artisan Bakery', 'The Artisan Bakery') 
      WHERE value LIKE '%The Artisan Bakery%';
    `);
    
    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'Example Store', 'The Artisan Bakery') 
      WHERE value LIKE '%Example Store%';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'Homestead Homestead', 'Homestead') 
      WHERE value LIKE '%Homestead Homestead%';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'hello@theartisanbakery.test', 'hello@theartisanbakery.test') 
      WHERE key = 'contact_email';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'hello@theartisanbakery.test', 'payments@theartisanbakery.test') 
      WHERE key = 'etransfer_email' OR key = 'payment_instructions';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'payments@example.com', 'payments@theartisanbakery.test') 
      WHERE value LIKE '%payments@example.com%';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REGEXP_REPLACE(value, '[a-zA-Z0-9._%+-]+@cedar(and)?sage(homestead)?\\.(ca|com)', 'hello@theartisanbakery.test', 'g') 
      WHERE value ~ '@cedar(and)?sage(homestead)?\\.(ca|com)';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'family-run homestead kitchen', 'family-run kitchen')
      WHERE key = 'about_content' AND value LIKE '%family-run homestead kitchen%';
    `);

    await query(`
      UPDATE site_settings 
      SET value = REPLACE(value, 'small-batch homestead kitchen', 'small-batch kitchen')
      WHERE key = 'about_content' AND value LIKE '%small-batch homestead kitchen%';
    `);

    // 2. Fetch and clean settings in memory for safety
    const res = await query('SELECT key, value FROM site_settings');
    const cleanedRows = res.rows.map(r => {
      let val = r.value || '';
      if (typeof val === 'string') {
        val = val.replace(/Cedar\s*&\s*Sage/gi, 'The Artisan Bakery');
        val = val.replace(/Cedar\s+and\s+Sage/gi, 'The Artisan Bakery');
        val = val.replace(/Homestead\s+Homestead/gi, 'Homestead');
        
        // Self-healing email domain replacements
        val = val.replace(/[a-zA-Z0-9._%+-]+@cedar(?:and)?sage(?:homestead)?\.(?:ca|com)/gi, (match: string) => {
          if (match.toLowerCase().includes('payment') || match.toLowerCase().includes('etransfer')) {
            return 'payments@theartisanbakery.test';
          }
          return 'hello@theartisanbakery.test';
        });

        // Clean homestead kitchen duplications
        val = val.replace(/family-run homestead kitchen/gi, 'family-run kitchen');
        val = val.replace(/small-batch homestead kitchen/gi, 'small-batch kitchen');
      }

      // Explicit taglines and brand names healing in-memory
      if (r.key === 'brand_tagline' && (val === 'Homestead' || val.toLowerCase().includes('homestead care') || val.toLowerCase().includes('cedar'))) {
        val = 'Fresh baking, pantry goods & handmade home and body care';
      }
      if (r.key === 'brand_name' && (val === 'Automated Brand' || val.toLowerCase().includes('cedar'))) {
        val = 'The Artisan Bakery';
      }

      return { ...r, value: val };
    });

    return NextResponse.json(cleanedRows);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json(); // Array of { key, value }
    if (!Array.isArray(body)) {
      return NextResponse.json({ detail: 'Invalid payload format' }, { status: 400 });
    }

    for (const item of body) {
      const { key, value } = item;
      const sql = `
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = $2
      `;
      await query(sql, [key, value]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
