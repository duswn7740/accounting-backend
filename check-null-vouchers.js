const db = require('./config/database');

(async () => {
  try {
    console.log('\n=== voucher_no가 null인 전표 조회 ===\n');

    const [nullVouchers] = await db.query(`
      SELECT gv.voucher_id, gv.voucher_no, gv.voucher_date, gv.description, gv.created_at,
             COUNT(gvl.line_id) as line_count
      FROM general_vouchers gv
      LEFT JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id
      WHERE gv.company_id = 1
      AND gv.voucher_no IS NULL
      GROUP BY gv.voucher_id
      ORDER BY gv.created_at DESC
    `);

    console.log('voucher_no가 null인 전표:', nullVouchers.length, '건\n');
    console.table(nullVouchers);

    if (nullVouchers.length > 0) {
      console.log('\n이 전표들을 삭제하시겠습니까? (y/n)');
      console.log('삭제하려면 다음 쿼리를 실행하세요:');
      console.log('DELETE FROM general_vouchers WHERE company_id = 1 AND voucher_no IS NULL;');
    }

    console.log('\n=== 최근 생성된 전표 (전표번호 포함) ===\n');
    const [recentVouchers] = await db.query(`
      SELECT gv.voucher_id, gv.voucher_no, gv.voucher_date, gv.description, gv.created_at,
             COUNT(gvl.line_id) as line_count
      FROM general_vouchers gv
      LEFT JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id
      WHERE gv.company_id = 1
      GROUP BY gv.voucher_id
      ORDER BY gv.created_at DESC
      LIMIT 10
    `);

    console.table(recentVouchers);

    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
})();
