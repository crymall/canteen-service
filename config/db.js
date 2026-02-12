var pg = require('pg');
var dotenv = require('dotenv');

dotenv.config();

var { Pool } = pg;

var pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

module.exports = pool;