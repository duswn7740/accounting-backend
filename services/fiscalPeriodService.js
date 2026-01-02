const db = require('../config/database');
const carryForwardModel = require('../models/carryForwardModel');

// 마감 후 이월 처리
async function carryForwardBalances(companyId, fromFiscalYear) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. 다음 회계기수 확인 및 자동 생성
    let [nextPeriods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fromFiscalYear + 1]
    );

    // 다음 회계기수가 없으면 자동 생성
    if (nextPeriods.length === 0) {
      // 현재 회계기수 정보 조회
      const [currentPeriods] = await connection.query(
        'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
        [companyId, fromFiscalYear]
      );

      if (currentPeriods.length === 0) {
        throw new Error('이월할 회계기수를 찾을 수 없습니다.');
      }

      const currentPeriod = currentPeriods[0];
      const currentEndDate = new Date(currentPeriod.end_date);

      // 다음 회계기수 시작일 = 현재 회계기수 종료일 + 1일
      const nextStartDate = new Date(currentEndDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);

      // 다음 회계기수 종료일 = 시작일로부터 1년 후 - 1일
      const nextEndDate = new Date(nextStartDate);
      nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
      nextEndDate.setDate(nextEndDate.getDate() - 1);

      // 날짜를 YYYY-MM-DD 형식으로 변환
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 다음 회계기수 생성
      await connection.query(
        `INSERT INTO fiscal_periods (company_id, fiscal_year, start_date, end_date, is_closed)
         VALUES (?, ?, ?, ?, FALSE)`,
        [companyId, fromFiscalYear + 1, formatDate(nextStartDate), formatDate(nextEndDate)]
      );

      console.log(`✅ ${fromFiscalYear + 1}기 회계기수 자동 생성: ${formatDate(nextStartDate)} ~ ${formatDate(nextEndDate)}`);

      // 생성된 회계기수 다시 조회
      [nextPeriods] = await connection.query(
        'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
        [companyId, fromFiscalYear + 1]
      );
    }

    // 2. 이월할 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fromFiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];
    const startDate = period.start_date;
    const endDate = period.end_date;

    // 3. 기존 이월잔액 삭제 (재이월을 위해)
    await connection.query(
      'DELETE FROM carry_forward_balances WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fromFiscalYear + 1]
    );

    // 4. 계정별 잔액 계산 및 이월
    // 일반전표 + 매입매출전표의 계정별 집계
    console.log(`📊 계정별 잔액 계산 시작 - 기간: ${startDate} ~ ${endDate}`);
    const [accountBalances] = await connection.query(
      `SELECT
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(SUM(gvl.debit_amount), 0) + COALESCE(SUM(CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(gvl.credit_amount), 0) + COALESCE(SUM(CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END), 0) as total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT gvl.account_id, gvl.debit_amount, gvl.credit_amount
        FROM general_voucher_lines gvl
        INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
        WHERE gv.company_id = ?
          AND gv.voucher_date BETWEEN ? AND ?
      ) gvl ON a.account_id = gvl.account_id
      LEFT JOIN (
        SELECT spvl.account_id, spvl.debit_credit, spvl.amount
        FROM sales_purchase_voucher_lines spvl
        INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
        WHERE spv.company_id = ?
          AND spv.voucher_date BETWEEN ? AND ?
          AND spv.is_active = TRUE
      ) spvl ON a.account_id = spvl.account_id
      WHERE a.company_id = ?
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
      HAVING (total_debit - total_credit) != 0`,
      [companyId, startDate, endDate, companyId, startDate, endDate, companyId]
    );

    console.log(`📊 계정별 잔액 조회 결과: ${accountBalances.length}개 계정`);
    accountBalances.forEach(acc => {
      console.log(`  - ${acc.account_code} ${acc.account_name} (${acc.account_type}): 차변=${acc.total_debit}, 대변=${acc.total_credit}`);
    });

    let accountCount = 0;

    // 자산, 부채, 자본 계정만 이월 (수익/비용은 손익계정으로 정산)
    for (const account of accountBalances) {
      // account_type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
      console.log(`  🔍 계정 타입 확인: "${account.account_type}" (타입: ${typeof account.account_type})`);
      if (['ASSET', 'LIABILITY', 'EQUITY', '자산', '부채', '자본'].includes(account.account_type)) {
        const balance = parseFloat(account.total_debit) - parseFloat(account.total_credit);
        const debitBalance = balance > 0 ? balance : 0;
        const creditBalance = balance < 0 ? -balance : 0;

        console.log(`  ✅ 이월: ${account.account_code} ${account.account_name} - 차변잔액=${debitBalance}, 대변잔액=${creditBalance}`);

        await connection.query(
          `INSERT INTO carry_forward_balances
           (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
           VALUES (?, ?, ?, NULL, ?, ?)`,
          [companyId, fromFiscalYear + 1, account.account_id, debitBalance, creditBalance]
        );

        accountCount++;
      } else {
        console.log(`  ⏭️  건너뜀: ${account.account_code} ${account.account_name} (${account.account_type})`);
      }
    }

    // 5. 거래처별 잔액 계산 및 이월
    console.log(`\n📊 거래처별 잔액 계산 시작`);
    const [clientBalances] = await connection.query(
      `SELECT
        a.account_id,
        c.client_id,
        c.client_code,
        c.client_name,
        COALESCE(SUM(gvl.debit_amount), 0) + COALESCE(SUM(CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(gvl.credit_amount), 0) + COALESCE(SUM(CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END), 0) as total_credit
      FROM clients c
      CROSS JOIN accounts a
      LEFT JOIN (
        SELECT gvl.account_id, gvl.client_id, gvl.debit_amount, gvl.credit_amount
        FROM general_voucher_lines gvl
        INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
        WHERE gv.company_id = ?
          AND gv.voucher_date BETWEEN ? AND ?
      ) gvl ON c.client_id = gvl.client_id AND a.account_id = gvl.account_id
      LEFT JOIN (
        SELECT spvl.account_id, spvl.client_id, spvl.debit_credit, spvl.amount
        FROM sales_purchase_voucher_lines spvl
        INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
        WHERE spv.company_id = ?
          AND spv.voucher_date BETWEEN ? AND ?
          AND spv.is_active = TRUE
      ) spvl ON c.client_id = spvl.client_id AND a.account_id = spvl.account_id
      WHERE c.company_id = ?
        AND a.company_id = ?
      GROUP BY a.account_id, c.client_id, c.client_code, c.client_name
      HAVING (total_debit - total_credit) != 0`,
      [companyId, startDate, endDate, companyId, startDate, endDate, companyId, companyId]
    );

    console.log(`📊 거래처별 잔액 조회 결과: ${clientBalances.length}개`);

    let clientCount = 0;

    for (const clientBalance of clientBalances) {
      const balance = parseFloat(clientBalance.total_debit) - parseFloat(clientBalance.total_credit);
      const debitBalance = balance > 0 ? balance : 0;
      const creditBalance = balance < 0 ? -balance : 0;

      console.log(`  ✅ 거래처이월: ${clientBalance.client_code} ${clientBalance.client_name} - 차변잔액=${debitBalance}, 대변잔액=${creditBalance}`);

      await connection.query(
        `INSERT INTO carry_forward_balances
         (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [companyId, fromFiscalYear + 1, clientBalance.account_id, clientBalance.client_id, debitBalance, creditBalance]
      );

      clientCount++;
    }

    await connection.commit();

    return {
      success: true,
      accountCount,
      clientCount,
      message: `${fromFiscalYear}기 → ${fromFiscalYear + 1}기 이월 완료`
    };

  } catch (error) {
    await connection.rollback();
    console.error('이월 처리 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 회계기수 마감
async function closeFiscalPeriod(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. 회계기수 확인
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    if (period.is_closed) {
      throw new Error('이미 마감된 회계기수입니다.');
    }

    // 2. 마감 처리
    await connection.query(
      'UPDATE fiscal_periods SET is_closed = TRUE WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    await connection.commit();

    return {
      success: true,
      message: `${fiscalYear}기 마감 완료`
    };

  } catch (error) {
    await connection.rollback();
    console.error('마감 처리 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 회계기수 마감 취소
async function reopenFiscalPeriod(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. 회계기수 확인
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    if (!period.is_closed) {
      throw new Error('마감되지 않은 회계기수입니다.');
    }

    // 2. 마감 취소 처리
    await connection.query(
      'UPDATE fiscal_periods SET is_closed = FALSE WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    await connection.commit();

    return {
      success: true,
      message: `${fiscalYear}기 마감 취소 완료`
    };

  } catch (error) {
    await connection.rollback();
    console.error('마감 취소 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  carryForwardBalances,
  closeFiscalPeriod,
  reopenFiscalPeriod
};
