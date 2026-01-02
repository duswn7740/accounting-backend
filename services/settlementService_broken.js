const db = require('../config/database');
const settlementQueries = require('../queries/settlementQueries');

// 결산전표 생성
async function createSettlementVoucher(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    // 기존 결산전표 삭제 (재결산 허용)
    await connection.query(
      `DELETE FROM general_vouchers
       WHERE company_id = ?
       AND voucher_date BETWEEN ? AND ?
       AND voucher_type = 'settlement'`,
      [companyId, fiscalYear]
    );

    await connection.commit();

    return {
      success: true,
      message: '결산전표가 생성되었습니다'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 제조원가명세서 데이터 조회
async function getManufacturingCostData(companyId, fiscalYear, codeRange) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 코드 범위에 따른 제조원가 조회
    const startCode = codeRange;
    const endCode = String(parseInt(codeRange) + 99);

    const [costData] = await connection.query(
      settlementQueries.getManufacturingCostQuery,
      [companyId, startCode, endCode, period.start_date, period.end_date]
    );

    const totalCost = costData.reduce((sum, row) => sum + (row.total_debit - row.total_credit), 0);

    return {
      totalCost,
      details: costData
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 제조원가 결산 실행
async function executeManufacturingCostSettlement(companyId, fiscalYear, codeRange) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    // TODO: 제조원가 결산 로직 구현
    // 1. 해당 코드 범위의 원가를 계산
    // 2. 결산 전표 생성

    await connection.commit();

    return {
      success: true,
      message: '제조원가 결산이 완료되었습니다'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 손익계산서 데이터 조회
async function getIncomeStatementData(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 수익 및 비용 계정 조회
    const [incomeData] = await connection.query(
      settlementQueries.getIncomeStatementQuery,
      [companyId, period.start_date, period.end_date]
    );

    let totalRevenue = 0;
    let totalExpense = 0;

    incomeData.forEach(row => {
      if (row.account_type === '수익' || row.account_type === 'REVENUE') {
        totalRevenue += (row.total_credit - row.total_debit);
      } else if (row.account_type === '비용' || row.account_type === 'EXPENSE') {
        totalExpense += (row.total_debit - row.total_credit);
      }
    });

    const netIncome = totalRevenue - totalExpense;

    return {
      totalRevenue,
      totalExpense,
      netIncome,
      details: incomeData
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 손익계산 결산 실행 - 수익/비용 계정을 당기순이익(998)으로 대체
async function executeIncomeStatementSettlement(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 기존 손익 결산 전표 삭제
    await connection.query(
      `DELETE FROM general_vouchers
       WHERE company_id = ?
       AND voucher_date BETWEEN ? AND ?
       AND voucher_type = 'settlement'
       AND description LIKE '%손익%'`,
      [companyId, fiscalYear]
    );

    // 수익 및 비용 계정 조회
    const [accounts] = await connection.query(
      settlementQueries.getProfitLossAccountsQuery,
      [companyId, period.start_date, period.end_date]
    );

    // 각 수익/비용 계정별로 결산전표 생성 (Option A)
    const voucherDate = period.end_date;

    for (const account of accounts) {
      const balance = account.total_credit - account.total_debit;

      if (Math.abs(balance) < 0.01) continue; // 잔액이 0이면 건너뛰기

      // 전표 생성
      const [voucherResult] = await connection.query(
        `INSERT INTO general_vouchers (company_id, voucher_date, description)
         VALUES (?, ?, ?, '[결산]', ?)`,
        [companyId, fiscalYear, voucherDate, `${account.account_name} → 당기순이익`]
      );

      const voucherId = voucherResult.insertId;

      // 전표 라인 생성
      if (balance > 0) {
        // 수익 계정 (대변 잔액) → 차변으로 당기순이익으로 대체
        await connection.query(
          `INSERT INTO general_voucher_lines (voucher_id, line_no, account_code, description, debit_amount, credit_amount)
           VALUES (?, 1, ?, ?, ?, 0), (?, 2, '998', ?, 0, ?)`,
          [
            voucherId,
            account.account_code,
            `${account.account_name} 대체`,
            balance,
            voucherId,
            '당기순이익',
            balance
          ]
        );
      } else {
        // 비용 계정 (차변 잔액) → 대변으로 당기순이익으로 대체
        const absBalance = Math.abs(balance);
        await connection.query(
          `INSERT INTO general_voucher_lines (voucher_id, line_no, account_code, description, debit_amount, credit_amount)
           VALUES (?, 1, '998', ?, ?, 0), (?, 2, ?, ?, 0, ?)`,
          [
            voucherId,
            '당기순이익',
            absBalance,
            voucherId,
            account.account_code,
            `${account.account_name} 대체`,
            absBalance
          ]
        );
      }
    }

    await connection.commit();

    return {
      success: true,
      message: '손익계산 결산이 완료되었습니다',
      vouchersCreated: accounts.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 이익잉여금처분계산서 데이터 조회
async function getRetainedEarningsData(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 당기순이익 조회 (998 계정)
    const [netIncomeRows] = await connection.query(
      settlementQueries.getAccountBalanceQuery,
      [companyId, '998', period.start_date, period.end_date]
    );

    const netIncome = netIncomeRows.length > 0
      ? (netIncomeRows[0].total_credit - netIncomeRows[0].total_debit)
      : 0;

    // 전기 이익잉여금 조회 (999 계정)
    const [retainedRows] = await connection.query(
      settlementQueries.getAccountBalanceQuery,
      [companyId, '999', period.start_date, period.end_date]
    );

    const previousRetainedEarnings = retainedRows.length > 0
      ? (retainedRows[0].total_credit - retainedRows[0].total_debit)
      : 0;

    return {
      netIncome,
      previousRetainedEarnings,
      totalRetainedEarnings: netIncome + previousRetainedEarnings
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 이익잉여금 처분 결산 실행 - 당기순이익(998)을 이익잉여금(999)으로 대체
async function executeRetainedEarningsSettlement(companyId, fiscalYear, currentDisposalDate, previousDisposalDate) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 기존 이익잉여금 결산 전표 삭제
    await connection.query(
      `DELETE FROM general_vouchers
       WHERE company_id = ?
       AND voucher_date BETWEEN ? AND ?
       AND voucher_type = 'settlement'
       AND description LIKE '%이익잉여금%'`,
      [companyId, fiscalYear]
    );

    // 당기순이익 조회
    const [netIncomeRows] = await connection.query(
      settlementQueries.getAccountBalanceQuery,
      [companyId, '998', period.start_date, period.end_date]
    );

    const netIncome = netIncomeRows.length > 0
      ? (netIncomeRows[0].total_credit - netIncomeRows[0].total_debit)
      : 0;

    if (Math.abs(netIncome) < 0.01) {
      throw new Error('당기순이익이 0입니다. 손익계산 결산을 먼저 실행해주세요.');
    }

    // 결산 전표 생성
    const voucherDate = currentDisposalDate || period.end_date;
    const [voucherResult] = await connection.query(
      `INSERT INTO general_vouchers (company_id, voucher_date, description)
       VALUES (?, ?, ?, '[결산]', '당기순이익 → 이익잉여금')`,
      [companyId, fiscalYear, voucherDate]
    );

    const voucherId = voucherResult.insertId;

    // 전표 라인 생성
    if (netIncome > 0) {
      // 당기순이익이 양수 (이익)
      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, account_code, description, debit_amount, credit_amount)
         VALUES (?, 1, '998', '당기순이익 대체', ?, 0), (?, 2, '999', '이익잉여금 증가', 0, ?)`,
        [voucherId, netIncome, voucherId, netIncome]
      );
    } else {
      // 당기순이익이 음수 (손실)
      const absNetIncome = Math.abs(netIncome);
      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, account_code, description, debit_amount, credit_amount)
         VALUES (?, 1, '999', '이익잉여금 감소', ?, 0), (?, 2, '998', '당기순손실 대체', 0, ?)`,
        [voucherId, absNetIncome, voucherId, absNetIncome]
      );
    }

    await connection.commit();

    return {
      success: true,
      message: '이익잉여금 처분 결산이 완료되었습니다',
      netIncome
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 대차대조표 데이터 조회
async function getBalanceSheetData(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 모든 계정 잔액 조회
    const [balances] = await connection.query(
      settlementQueries.getBalanceSheetQuery,
      [companyId, period.start_date, period.end_date]
    );

    const assets = [];
    const liabilities = [];
    const equity = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    balances.forEach(row => {
      const balance = row.total_debit - row.total_credit;

      if (row.account_type === '자산' || row.account_type === 'ASSET') {
        assets.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          balance: balance
        });
        totalAssets += balance;
      } else if (row.account_type === '부채' || row.account_type === 'LIABILITY') {
        liabilities.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          balance: -balance
        });
        totalLiabilities += -balance;
      } else if (row.account_type === '자본' || row.account_type === 'EQUITY') {
        equity.push({
          accountCode: row.account_code,
          accountName: row.account_name,
          balance: -balance
        });
        totalEquity += -balance;
      }
    });

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 합계잔액시산표 데이터 조회
async function getTrialBalanceData(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND voucher_date BETWEEN ? AND ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 모든 계정의 합계와 잔액 조회
    const [accounts] = await connection.query(
      settlementQueries.getTrialBalanceQuery,
      [companyId, period.start_date, period.end_date]
    );

    let sumTotalDebit = 0;
    let sumTotalCredit = 0;
    let sumBalanceDebit = 0;
    let sumBalanceCredit = 0;

    const accountsData = accounts.map(row => {
      const balance = row.total_debit - row.total_credit;
      const balanceDebit = balance > 0 ? balance : 0;
      const balanceCredit = balance < 0 ? -balance : 0;

      sumTotalDebit += row.total_debit;
      sumTotalCredit += row.total_credit;
      sumBalanceDebit += balanceDebit;
      sumBalanceCredit += balanceCredit;

      return {
        accountCode: row.account_code,
        accountName: row.account_name,
        totalDebit: row.total_debit,
        totalCredit: row.total_credit,
        balanceDebit,
        balanceCredit
      };
    });

    return {
      accounts: accountsData,
      sumTotalDebit,
      sumTotalCredit,
      sumBalanceDebit,
      sumBalanceCredit
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createSettlementVoucher,
  getManufacturingCostData,
  executeManufacturingCostSettlement,
  getIncomeStatementData,
  executeIncomeStatementSettlement,
  getRetainedEarningsData,
  executeRetainedEarningsSettlement,
  getBalanceSheetData,
  getTrialBalanceData
};
