const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQuery() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.query(
      "SELECT account_code, account_name, account_type, account_category FROM accounts WHERE company_id = 1 AND account_code = '103'"
    );
    console.log('Raw query result:', rows[0]);
    console.log('Keys:', Object.keys(rows[0]));
  } finally {
    await connection.end();
  }
}

testQuery().catch(console.error);
