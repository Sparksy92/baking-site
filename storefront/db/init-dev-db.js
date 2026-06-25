const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
} catch (err) {
  console.warn("Could not read .env file:", err.message);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

async function main() {
  console.log("Connecting to:", connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to database.");

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

    console.log("Running schema.sql...");
    await client.query(schemaSql);
    console.log("Schema initialized.");

    console.log("Running seed.sql...");
    await client.query(seedSql);
    console.log("Database seeded successfully.");
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    await client.end();
  }
}

main();
