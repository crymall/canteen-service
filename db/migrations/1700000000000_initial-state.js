const fs = require('fs');
const path = require('path');

exports.up = (pgm) => {
  const schemaPath = path.join(__dirname, '../legacy/schema.sql');
  const seedsPath = path.join(__dirname, '../legacy/seeds.sql');
  
  const schemaSql = fs.readFileSync(schemaPath, { encoding: 'utf8' });
  const seedsSql = fs.readFileSync(seedsPath, { encoding: 'utf8' });

  pgm.sql(schemaSql);
  pgm.sql(seedsSql);
};

exports.down = false;