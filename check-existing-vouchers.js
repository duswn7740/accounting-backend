const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkExistingVouchers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 12월 11일과 16일 전표 확인
    const [vouchers] = await connection.query(
      `SELECT v.voucher_id, v.voucher_date, v.voucher_no, v.description,
              vl.line_id, vl.line_no, vl.voucher_type, vl.debit_amount, vl.credit_amount, vl.description as line_desc,
              a.account_name
       FROM general_vouchers v
       INNER JOIN general_voucher_lines vl ON v.voucher_id = vl.voucher_id
       LEFT JOIN accounts a ON vl.account_id = a.account_id
       WHERE v.company_id = 1
       AND (DAY(v.voucher_date) = 11 OR DAY(v.voucher_date) = 16)
       ORDER BY v.voucher_date, v.voucher_id, vl.line_no`
    );
    
    console.log('12월 11일과 16일 전표:');
    vouchers.forEach(v => {
      console.log(`날짜: ${v.voucher_date}, 전표번호: ${v.voucher_no}, Line: ${v.line_no}, Type: ${v.voucher_type}, 차변: ${v.debit_amount}, 대변: ${v.credit_amount}, 계정: ${v.account_name}, 적요: ${v.line_desc}`);
    });

  } finally {
    await connection.end();
  }
}

checkExistingVouchers().catch(console.error);
