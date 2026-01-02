const db = require('./config/database');

(async () => {
  try {
    const [rows] = await db.query(
      `SELECT voucher_id, voucher_no, voucher_date, status, total_debit, total_credit, description
       FROM general_vouchers
       WHERE company_id = 1 AND voucher_date = '2024-12-17'
       ORDER BY voucher_no`
    );

    console.log('\n=== 2024-12-17 전표 목록 ===');
    console.table(rows);
    console.log('\n총 전표 개수:', rows.length);

    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
})();
