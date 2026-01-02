const db = require('./config/database');

(async () => {
  try {
    console.log('\n=== voucher_no가 null인 전표 삭제 ===\n');

    const [result] = await db.query(`
      DELETE FROM general_vouchers
      WHERE company_id = 1
      AND voucher_no IS NULL
    `);

    console.log('삭제된 전표 수:', result.affectedRows, '건\n');

    // 삭제 후 확인
    const [remaining] = await db.query(`
      SELECT COUNT(*) as count
      FROM general_vouchers
      WHERE company_id = 1
      AND voucher_no IS NULL
    `);

    console.log('남은 null 전표:', remaining[0].count, '건');

    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
})();
