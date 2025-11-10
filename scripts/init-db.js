const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function initDatabase() {
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\nExecuting SQL script...');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('\n✅ Database initialized successfully!');
    console.log('\nTables created:');
    console.log('  - users');
    console.log('  - notes');
    console.log('\nIndexes created:');
    console.log('  - idx_notes_user_id');
    console.log('  - idx_users_email');
    
  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
