const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVouchers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 결산 전표 확인
    const [vouchers] = await connection.query(
      `SELECT * FROM general_vouchers
       WHERE company_id = 1
       AND description LIKE '[결산]%'
       ORDER BY voucher_date DESC, voucher_id DESC
       LIMIT 10`
    );
    
    console.log('결산 전표 개수:', vouchers.length);
    
    for (const v of vouchers) {
      console.log('---');
      console.log('전표 ID:', v.voucher_id);
      console.log('일자:', v.voucher_date);
      console.log('설명:', v.description);
      
      // 전표 라인 조회
      const [lines] = await connection.query(
        `SELECT vl.*, a.account_name
         FROM general_voucher_lines vl
         JOIN accounts a ON vl.account_id = a.account_id
         WHERE vl.voucher_id = ?`,
        [v.voucher_id]
      );
      
      lines.forEach(l => {
        console.log(`  ${l.account_name}: 차변=${l.debit_amount}, 대변=${l.credit_amount}, 적요=${l.description}`);
      });
    }

  } finally {
    await connection.end();
  }
}

checkVouchers().catch(console.error);
