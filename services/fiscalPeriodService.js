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
    // 전기이월 + 일반전표 + 매입매출전표의 계정별 집계
    // 각 데이터소스를 먼저 집계한 후 합산하여 중복 계산 방지
    const [accountBalances] = await connection.query(
      `SELECT
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(cf.debit_balance, 0) + COALESCE(gvl.total_debit, 0) + COALESCE(spvl.total_debit, 0) as total_debit,
        COALESCE(cf.credit_balance, 0) + COALESCE(gvl.total_credit, 0) + COALESCE(spvl.total_credit, 0) as total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, debit_balance, credit_balance
        FROM carry_forward_balances
        WHERE company_id = ? AND fiscal_year = ? AND client_id IS NULL
      ) cf ON a.account_id = cf.account_id
      LEFT JOIN (
        SELECT gvl.account_id,
               SUM(gvl.debit_amount) as total_debit,
               SUM(gvl.credit_amount) as total_credit
        FROM general_voucher_lines gvl
        INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
        WHERE gv.company_id = ?
          AND gv.voucher_date BETWEEN ? AND ?
        GROUP BY gvl.account_id
      ) gvl ON a.account_id = gvl.account_id
      LEFT JOIN (
        SELECT spvl.account_id,
               SUM(CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END) as total_debit,
               SUM(CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END) as total_credit
        FROM sales_purchase_voucher_lines spvl
        INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
        WHERE spv.company_id = ?
          AND spv.voucher_date BETWEEN ? AND ?
          AND spv.is_active = TRUE
        GROUP BY spvl.account_id
      ) spvl ON a.account_id = spvl.account_id
      WHERE a.company_id = ?
      HAVING (total_debit - total_credit) != 0`,
      [companyId, fromFiscalYear, companyId, startDate, endDate, companyId, startDate, endDate, companyId]
    );

    let accountCount = 0;

    // 자산, 부채, 자본 계정만 이월 (수익/비용은 손익계정으로 정산)
    for (const account of accountBalances) {
      if (['ASSET', 'LIABILITY', 'EQUITY', '자산', '부채', '자본'].includes(account.account_type)) {
        const balance = parseFloat(account.total_debit) - parseFloat(account.total_credit);
        const debitBalance = balance > 0 ? balance : 0;
        const creditBalance = balance < 0 ? -balance : 0;

        await connection.query(
          `INSERT INTO carry_forward_balances
           (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
           VALUES (?, ?, ?, NULL, ?, ?)`,
          [companyId, fromFiscalYear + 1, account.account_id, debitBalance, creditBalance]
        );

        accountCount++;
      }
    }

    // 5. 거래처별 잔액 계산 및 이월
    // 전기이월 + 일반전표 + 매입매출전표의 거래처별 집계
    // 각 데이터소스를 먼저 집계한 후 합산하여 중복 계산 방지
    const [clientBalances] = await connection.query(
      `SELECT
        combined.account_id,
        combined.client_id,
        c.client_code,
        c.client_name,
        SUM(combined.debit_amount) as total_debit,
        SUM(combined.credit_amount) as total_credit
      FROM (
        -- 전기이월 잔액
        SELECT account_id, client_id, debit_balance as debit_amount, credit_balance as credit_amount
        FROM carry_forward_balances
        WHERE company_id = ? AND fiscal_year = ? AND client_id IS NOT NULL

        UNION ALL

        -- 일반전표 거래
        SELECT gvl.account_id, gvl.client_id, gvl.debit_amount, gvl.credit_amount
        FROM general_voucher_lines gvl
        INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
        WHERE gv.company_id = ?
          AND gv.voucher_date BETWEEN ? AND ?
          AND gvl.client_id IS NOT NULL

        UNION ALL

        -- 매입매출전표 거래
        SELECT spvl.account_id, spvl.client_id,
               CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
               CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount
        FROM sales_purchase_voucher_lines spvl
        INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
        WHERE spv.company_id = ?
          AND spv.voucher_date BETWEEN ? AND ?
          AND spv.is_active = TRUE
          AND spvl.client_id IS NOT NULL
      ) combined
      INNER JOIN clients c ON combined.client_id = c.client_id
      GROUP BY combined.account_id, combined.client_id, c.client_code, c.client_name
      HAVING (total_debit - total_credit) != 0`,
      [companyId, fromFiscalYear, companyId, startDate, endDate, companyId, startDate, endDate]
    );

    let clientCount = 0;

    for (const clientBalance of clientBalances) {
      const balance = parseFloat(clientBalance.total_debit) - parseFloat(clientBalance.total_credit);
      const debitBalance = balance > 0 ? balance : 0;
      const creditBalance = balance < 0 ? -balance : 0;

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
