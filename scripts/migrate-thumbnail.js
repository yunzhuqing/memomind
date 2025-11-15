const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Running migration: add thumbnail_key column...');
    
    // Read and execute the SQL file
    const sqlFile = fs.readFileSync(
      path.join(__dirname, 'add-thumbnail-column.sql'),
      'utf8'
    );
    
    await client.query(sqlFile);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added thumbnail_key column to files table');
    console.log('   - Created index on thumbnail_key');
    
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
