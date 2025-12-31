const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env' });

// Create pool with fallback values
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'memomind',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function migrate() {
  try {
    console.log('Connecting to database...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-user-settings-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\nExecuting migration script...');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✓ User settings table created');
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error executing migration:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
