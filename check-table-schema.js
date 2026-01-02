const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // general_vouchers 테이블 스키마
    const [columns1] = await connection.query(
      "SHOW COLUMNS FROM general_vouchers"
    );
    console.log('=== general_vouchers 테이블 ===');
    columns1.forEach(col => {
      console.log(`${col.Field}: ${col.Type}, Null=${col.Null}, Key=${col.Key}, Default=${col.Default}, Extra=${col.Extra}`);
    });

    console.log('\n=== general_voucher_lines 테이블 ===');
    const [columns2] = await connection.query(
      "SHOW COLUMNS FROM general_voucher_lines"
    );
    columns2.forEach(col => {
      console.log(`${col.Field}: ${col.Type}, Null=${col.Null}, Key=${col.Key}, Default=${col.Default}, Extra=${col.Extra}`);
    });

  } finally {
    await connection.end();
  }
}

checkSchema().catch(console.error);
