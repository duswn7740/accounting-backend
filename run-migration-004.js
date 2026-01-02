const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/004_create_carry_forward_balances.sql'),
      'utf8'
    );

    console.log('마이그레이션 실행 중...');
    await db.query(sql);
    console.log('✅ carry_forward_balances 테이블 생성 완료');

    // 테이블 확인
    const [tables] = await db.query("SHOW TABLES LIKE 'carry_forward_balances'");
    console.log('테이블 존재 여부:', tables.length > 0 ? '✅ 존재함' : '❌ 없음');

    if (tables.length > 0) {
      const [columns] = await db.query("DESCRIBE carry_forward_balances");
      console.log('\n테이블 구조:');
      console.table(columns);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

runMigration();
