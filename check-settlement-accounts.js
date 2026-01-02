const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSettlementAccounts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 결차/결대 계정 확인
    const [accounts] = await connection.query(
      "SELECT account_code, account_name, account_type FROM system_accounts WHERE account_name LIKE '%결%'"
    );
    console.log('결산 관련 계정:', accounts);
  } finally {
    await connection.end();
  }
}

checkSettlementAccounts().catch(console.error);
