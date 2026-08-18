const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const config = DATABASE_URL
  ? { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    };

if (DATABASE_URL) {
  console.log('Using DATABASE_URL');
} else {
  console.log('Using individual DB params');
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  const client = new Client(config);
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations (
        version TEXT PRIMARY KEY,
        name TEXT,
        statements TEXT[]
      );
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.split('_')[0];
      const { rows } = await client.query('SELECT 1 FROM supabase_migrations WHERE version = $1', [version]);
      if (rows.length > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
      await client.query('INSERT INTO supabase_migrations (version, name) VALUES ($1, $2)', [version, file]);
      console.log(`Applied ${file}`);
    }

    console.log('All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
