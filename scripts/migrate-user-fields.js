const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables if .env file exists
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'memomind',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Adding user fields (role, team_id, address)...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-user-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✓ Migration completed successfully!');
    console.log('✓ Added columns: role, team_id, address');
    console.log('✓ Created indexes on role and team_id');
    console.log('✓ Updated existing users with default role');
    
    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('role', 'team_id', 'address')
      ORDER BY column_name
    `);
    
    console.log('\nVerification - New columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})${row.column_default ? ` DEFAULT ${row.column_default}` : ''}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✓ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
