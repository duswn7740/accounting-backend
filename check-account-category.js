const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAccountCategory() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // accounts 테이블 확인
    const [accounts] = await connection.query(
      "SELECT account_code, account_name, account_type, account_category FROM accounts WHERE company_id = 1 AND account_code = '103'"
    );
    console.log('accounts 테이블 (보통예금):', accounts[0]);

    // system_accounts 테이블 확인
    const [systemAccounts] = await connection.query(
      "SELECT account_code, account_name, account_type, account_category FROM system_accounts WHERE account_code = '103'"
    );
    console.log('system_accounts 테이블 (보통예금):', systemAccounts[0]);

  } finally {
    await connection.end();
  }
}

checkAccountCategory().catch(console.error);
