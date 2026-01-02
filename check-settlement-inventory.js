const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkInventoryTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // settlement로 시작하는 테이블 확인
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'settlement%'"
    );
    console.log('Settlement 관련 테이블:', tables);

  } finally {
    await connection.end();
  }
}

checkInventoryTable().catch(console.error);
