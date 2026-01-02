const db = require('./config/database');

(async () => {
  try {
    console.log('\n=== 전표번호 형식 변환 시작 ===\n');

    // 하이픈이 없는 전표번호(001, 002 등)를 찾아서 YYYYMMDD-001 형식으로 변경
    const [vouchers] = await db.query(`
      SELECT voucher_id, voucher_no, voucher_date
      FROM general_vouchers
      WHERE voucher_no NOT LIKE '%-%'
      AND LENGTH(voucher_no) <= 3
      ORDER BY voucher_date, voucher_no
    `);

    console.log(`변환할 전표 수: ${vouchers.length}\n`);

    for (const voucher of vouchers) {
      // voucher_date를 YYYYMMDD 형식으로 변환
      const date = new Date(voucher.voucher_date);
      // UTC 시간에 9시간 추가 (한국 시간)
      date.setHours(date.getHours() + 9);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      const newVoucherNo = `${dateStr}-${voucher.voucher_no}`;

      console.log(`전표 ${voucher.voucher_id}: "${voucher.voucher_no}" → "${newVoucherNo}"`);

      await db.query(
        'UPDATE general_vouchers SET voucher_no = ? WHERE voucher_id = ?',
        [newVoucherNo, voucher.voucher_id]
      );
    }

    console.log(`\n변환 완료! 총 ${vouchers.length}건 업데이트됨\n`);
    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
})();
