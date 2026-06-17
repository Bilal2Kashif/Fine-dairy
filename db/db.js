require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
});

async function getPool() {
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    console.error('DB wake-up failed, retrying in 3s...', err.message);
    await new Promise(res => setTimeout(res, 3000));
  }
  return pool;
}

module.exports = { getPool };