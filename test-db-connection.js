const { Pool } = require('pg');

const connectionString = 'postgresql://postgres.bpndogwvjibhbipfdkgw:Y%2Fpzi%25U%24QhG5X.d@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  try {
    console.log('Attempting to connect to database...');
    console.log('Connection string:', connectionString.replace(/:([^:@]{1,10})@/, ':****@'));

    const client = await pool.connect();
    console.log('✅ Successfully connected to database!');

    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query successful:', result.rows[0]);

    // Check existing tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('📋 Existing tables:', tables.rows.map(r => r.table_name));

    client.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection error:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
