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
    
    // Read SQL files
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    const filesSqlPath = path.join(__dirname, 'init-db-files.sql');
    const filesSql = fs.readFileSync(filesSqlPath, 'utf8');
    
    console.log('\nExecuting SQL scripts...');
    
    // Execute main SQL
    await pool.query(sql);
    console.log('✓ Main tables created');
    
    // Execute files SQL
    await pool.query(filesSql);
    console.log('✓ File management tables created');
    
    console.log('\n✅ Database initialized successfully!');
    console.log('\nTables created:');
    console.log('  - users');
    console.log('  - notes');
    console.log('  - files');
    console.log('  - directories');
    console.log('\nIndexes created:');
    console.log('  - idx_notes_user_id');
    console.log('  - idx_users_email');
    console.log('  - idx_files_user_id');
    console.log('  - idx_files_directory_path');
    console.log('  - idx_files_file_type');
    console.log('  - idx_directories_user_id');
    console.log('  - idx_directories_path');
    console.log('  - idx_directories_parent_path');
    
  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
