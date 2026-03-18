const path = require('path');
const pool = require('../config/db');
const migrate = require('node-pg-migrate').default;

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

    if (retries === 0) {
        throw new Error("Could not connect to database after 5 attempts");
    }

    console.log('Starting database initialization...');
    console.log('Starting database migrations...');
    
    await migrate({
      databaseUrl: {
        host: process.env.DB_HOST,
        port: 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      dir: path.join(__dirname, 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      log: (msg) => console.log(msg),
    });

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
};

runMigrations();