import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schemaPath = path.join(__dirname, 'schema.sql');
const seedsPath = path.join(__dirname, 'seeds.sql');

const schemaSql = fs.readFileSync(schemaPath, { encoding: 'utf8' });
const seedsSql = fs.readFileSync(seedsPath, { encoding: 'utf8' });

const runMigrations = async () => {
  try {
    let retries = 5;
    while (retries) {
      try {
        await pool.query('SELECT NOW()');
        break;
      } catch (err) {
        console.log(`Database not ready, retrying in 5s... (${retries} left)`);
        retries -= 1;
        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    console.log('Starting database initialization...');

    console.log('Building tables...');
    await pool.query(schemaSql);
    console.log('Tables created.');

    console.log('Seeding data...');
    await pool.query(seedsSql);
    console.log('Data seeded.');

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
};

runMigrations();