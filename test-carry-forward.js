const db = require('./config/database');

async function testCarryForward() {
  try {
    // 1. 회사 조회
    const [companies] = await db.query('SELECT company_id, company_name FROM companies LIMIT 1');
    if (companies.length === 0) {
      console.log('❌ 회사 데이터가 없습니다.');
      process.exit(1);
    }
    const companyId = companies[0].company_id;
    console.log(`✅ 회사: ${companies[0].company_name} (ID: ${companyId})`);

    // 2. 계정과목 조회
    const [accounts] = await db.query(
      'SELECT account_id, account_code, account_name FROM accounts WHERE company_id = ? LIMIT 3',
      [companyId]
    );
    console.log(`✅ 계정과목 ${accounts.length}개 조회됨`);
    console.table(accounts);

    // 3. 거래처 조회
    const [clients] = await db.query(
      'SELECT client_id, client_code, client_name FROM clients WHERE company_id = ? LIMIT 2',
      [companyId]
    );
    console.log(`✅ 거래처 ${clients.length}개 조회됨`);
    console.table(clients);

    // 4. 기존 이월잔액 데이터 삭제
    await db.query('DELETE FROM carry_forward_balances WHERE company_id = ?', [companyId]);
    console.log('✅ 기존 이월잔액 데이터 삭제 완료');

    // 5. 테스트 데이터 삽입 - 계정별 이월잔액
    if (accounts.length > 0) {
      for (let i = 0; i < Math.min(2, accounts.length); i++) {
        await db.query(
          `INSERT INTO carry_forward_balances
           (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
           VALUES (?, ?, ?, NULL, ?, ?)`,
          [companyId, 1, accounts[i].account_id, 1000000 + (i * 100000), 500000 + (i * 50000)]
        );
        console.log(`✅ 계정별 이월잔액 추가: ${accounts[i].account_name} (차변: ${1000000 + (i * 100000)}, 대변: ${500000 + (i * 50000)})`);
      }
    }

    // 6. 테스트 데이터 삽입 - 거래처별 이월잔액
    if (accounts.length > 0 && clients.length > 0) {
      await db.query(
        `INSERT INTO carry_forward_balances
         (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [companyId, 1, accounts[0].account_id, clients[0].client_id, 3000000, 1000000]
      );
      console.log(`✅ 거래처별 이월잔액 추가: ${accounts[0].account_name} - ${clients[0].client_name} (차변: 3000000, 대변: 1000000)`);
    }

    // 7. 입력된 데이터 확인
    const [result] = await db.query(
      `SELECT
        cfb.*,
        a.account_code,
        a.account_name,
        c.client_code,
        c.client_name
      FROM carry_forward_balances cfb
      LEFT JOIN accounts a ON cfb.account_id = a.account_id
      LEFT JOIN clients c ON cfb.client_id = c.client_id
      WHERE cfb.company_id = ?
      ORDER BY cfb.balance_id`,
      [companyId]
    );

    console.log('\n📊 입력된 이월잔액 데이터:');
    console.table(result);

    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
}

testCarryForward();
