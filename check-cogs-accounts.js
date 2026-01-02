const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCOGSAccounts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 매출원가 관련 계정 확인
    const [accounts] = await connection.query(
      "SELECT account_code, account_name, account_type FROM accounts WHERE company_id = 1 AND account_name LIKE '%매출원가%'"
    );
    console.log('매출원가 관련 계정:', accounts);
  } finally {
    await connection.end();
  }
}

checkCOGSAccounts().catch(console.error);
