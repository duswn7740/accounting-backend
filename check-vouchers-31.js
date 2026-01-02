const db = require('./config/database');

(async () => {
  try {
    const [rows] = await db.query(
      `SELECT voucher_id, voucher_no, DATE(voucher_date) as date_only, voucher_date, status, total_debit, total_credit, description
       FROM general_vouchers
       WHERE company_id = 1
       AND (DATE(voucher_date) = '2024-12-31' OR voucher_date >= '2024-12-31 00:00:00' AND voucher_date <= '2024-12-31 23:59:59')
       ORDER BY voucher_no`
    );

    console.log('\n=== 2024-12-31 전표 목록 ===');
    console.table(rows);
    console.log('\n총 전표 개수:', rows.length);

    // 전표번호별로 정리
    console.log('\n전표번호 상세:');
    rows.forEach(row => {
      console.log(`voucher_no: ${row.voucher_no}, voucher_date: ${row.voucher_date}, date_only: ${row.date_only}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
})();
