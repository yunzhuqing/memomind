const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'memomind',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-conversations-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await client.query(sql);
    console.log('✅ Conversations table created successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

runMigration();
