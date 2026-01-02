const db = require('./config/database');

async function fixTable() {
  try {
    console.log('기존 테이블 삭제 중...');
    await db.query('DROP TABLE IF EXISTS carry_forward_balances');
    console.log('✅ 기존 테이블 삭제 완료');

    console.log('\n새 테이블 생성 중...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS carry_forward_balances (
        balance_id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        fiscal_year INT NOT NULL COMMENT '이월 대상 회계기수 (예: 2기로 이월하면 fiscal_year=2)',
        account_id INT NULL COMMENT '계정과목 ID (계정별 이월잔액)',
        client_id INT NULL COMMENT '거래처 ID (거래처별 이월잔액)',
        debit_balance DECIMAL(15, 2) DEFAULT 0 COMMENT '차변 잔액',
        credit_balance DECIMAL(15, 2) DEFAULT 0 COMMENT '대변 잔액',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
        UNIQUE KEY unique_account_balance (company_id, fiscal_year, account_id, client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='이월잔액'
    `);
    console.log('✅ 새 테이블 생성 완료');

    // 테이블 구조 확인
    const [columns] = await db.query("DESCRIBE carry_forward_balances");
    console.log('\n테이블 구조:');
    console.table(columns);

    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
}

fixTable();
