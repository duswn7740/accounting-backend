const db = require('../config/database');
const settlementQueries = require('../queries/settlementQueries');

// 결산전표 데이터 조회
async function getSettlementVoucherData(companyId, fiscalYear) {
  const connection = await db.getConnection();

  try {
    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 1. 매출액 조회 (수익 계정 중 금액이 있는 것만)
    // general_vouchers와 sales_purchase_voucher_lines 모두 조회
    const [revenues] = await connection.query(`
      SELECT
        a.account_name as accountName,
        COALESCE(SUM(CASE
          WHEN l.debit_credit = '대변' THEN l.amount
          WHEN l.debit_credit = '차변' THEN -l.amount
          ELSE 0
        END), 0) as amount
      FROM accounts a
      INNER JOIN sales_purchase_voucher_lines l ON a.account_id = l.account_id
      INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
      WHERE a.company_id = ?
        AND a.account_type = '수익'
        AND v.company_id = ?
        AND v.voucher_date BETWEEN ? AND ?
      GROUP BY a.account_id, a.account_name
      HAVING amount > 0
      ORDER BY a.account_code
    `, [companyId, companyId, period.start_date, period.end_date]);

    const totalRevenue = revenues.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    // 2. 재고 관련 조회
    // 기초 재고 (전기 이월 잔액)
    // 130: 상품(상업), 131: 제품(제조업-완제품), 132: 재료(제조업), 133: 재공품(제조업-미완성품)
    const [beginningInventory] = await connection.query(`
      SELECT
        SUM(CASE WHEN a.account_code = '130' THEN COALESCE(cf.debit_balance, 0) - COALESCE(cf.credit_balance, 0) ELSE 0 END) as beginningProductInventory,
        SUM(CASE WHEN a.account_code = '132' THEN COALESCE(cf.debit_balance, 0) - COALESCE(cf.credit_balance, 0) ELSE 0 END) as beginningMaterialInventory,
        SUM(CASE WHEN a.account_code = '131' THEN COALESCE(cf.debit_balance, 0) - COALESCE(cf.credit_balance, 0) ELSE 0 END) as beginningFinishedGoodsInventory,
        SUM(CASE WHEN a.account_code = '133' THEN COALESCE(cf.debit_balance, 0) - COALESCE(cf.credit_balance, 0) ELSE 0 END) as beginningWorkInProgress
      FROM accounts a
      LEFT JOIN carry_forward_balances cf ON a.account_id = cf.account_id
        AND cf.company_id = ?
        AND cf.fiscal_year = ?
        AND cf.client_id IS NULL
      WHERE a.company_id = ?
    `, [companyId, fiscalYear, companyId]);

    // 당기 매입액 (매입 전표에서 차변 발생액)
    // 130: 상품 (상업-도소매업)
    // 131: 제품 (제조업-완제품)
    // 132: 재료/원재료 (제조업)
    // 133: 재공품 (제조업-미완성품, 일반적으로 매입이 아닌 제조과정에서 발생)
    const [purchases] = await connection.query(`
      SELECT
        COALESCE(SUM(CASE WHEN a.account_code = '130' AND l.debit_credit = '차변' THEN l.amount ELSE 0 END), 0) as productPurchases,
        COALESCE(SUM(CASE WHEN a.account_code = '132' AND l.debit_credit = '차변' THEN l.amount ELSE 0 END), 0) as materialPurchases
      FROM sales_purchase_vouchers v
      INNER JOIN sales_purchase_voucher_lines l ON v.voucher_id = l.voucher_id
      INNER JOIN accounts a ON l.account_id = a.account_id
      WHERE v.company_id = ?
        AND v.voucher_date BETWEEN ? AND ?
        AND v.voucher_type IN ('매입', '면세매입')
        AND a.company_id = ?
    `, [companyId, period.start_date, period.end_date, companyId]);

    // 3. 노무비 (500번대 중 급여 관련, 금액 있는 경우)
    const [laborDetails] = await connection.query(`
      SELECT
        a.account_name as accountName,
        COALESCE(SUM(CASE
          WHEN l.debit_credit = '차변' THEN l.amount
          WHEN l.debit_credit = '대변' THEN -l.amount
          ELSE 0
        END), 0) as amount
      FROM accounts a
      INNER JOIN sales_purchase_voucher_lines l ON a.account_id = l.account_id
      INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
      WHERE a.company_id = ?
        AND a.account_code LIKE '51%'
        AND v.company_id = ?
        AND v.voucher_date BETWEEN ? AND ?
      GROUP BY a.account_id, a.account_name
      HAVING amount > 0
      ORDER BY a.account_code
    `, [companyId, companyId, period.start_date, period.end_date]);

    const laborCost = laborDetails.reduce((sum, l) => sum + parseFloat(l.amount), 0);

    // 4. 경비 (500번대 중 급여 제외, 금액 있는 경우)
    const [overheadDetails] = await connection.query(`
      SELECT
        a.account_name as accountName,
        COALESCE(SUM(CASE
          WHEN l.debit_credit = '차변' THEN l.amount
          WHEN l.debit_credit = '대변' THEN -l.amount
          ELSE 0
        END), 0) as amount
      FROM accounts a
      INNER JOIN sales_purchase_voucher_lines l ON a.account_id = l.account_id
      INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
      WHERE a.company_id = ?
        AND a.account_code LIKE '5%'
        AND a.account_code NOT LIKE '51%'
        AND v.company_id = ?
        AND v.voucher_date BETWEEN ? AND ?
      GROUP BY a.account_id, a.account_name
      HAVING amount > 0
      ORDER BY a.account_code
    `, [companyId, companyId, period.start_date, period.end_date]);

    const overheadCost = overheadDetails.reduce((sum, o) => sum + parseFloat(o.amount), 0);

    // 5. 판매비와관리비 (금액 있는 경우)
    const [expenseDetails] = await connection.query(`
      SELECT
        a.account_name as accountName,
        COALESCE(SUM(CASE
          WHEN l.debit_credit = '차변' THEN l.amount
          WHEN l.debit_credit = '대변' THEN -l.amount
          ELSE 0
        END), 0) as amount
      FROM accounts a
      INNER JOIN sales_purchase_voucher_lines l ON a.account_id = l.account_id
      INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
      WHERE a.company_id = ?
        AND a.account_type = '비용'
        AND a.account_code NOT LIKE '5%'
        AND v.company_id = ?
        AND v.voucher_date BETWEEN ? AND ?
      GROUP BY a.account_id, a.account_name
      HAVING amount > 0
      ORDER BY a.account_code
    `, [companyId, companyId, period.start_date, period.end_date]);

    const operatingExpenses = expenseDetails.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // 6. 결산전표에서 기말 재고액 조회
    const [settlementVouchers] = await connection.query(`
      SELECT v.description, vl.debit_amount
      FROM general_vouchers v
      INNER JOIN general_voucher_lines vl ON v.voucher_id = vl.voucher_id
      WHERE v.company_id = ?
        AND v.description LIKE '[결산] 기말%'
        AND vl.debit_amount > 0
    `, [companyId]);

    let endingProductInventory = 0;
    let endingMaterialInventory = 0;
    let endingFinishedGoodsInventory = 0;
    let endingWorkInProgress = 0;

    settlementVouchers.forEach(row => {
      if (row.description.includes('상품')) {
        endingProductInventory = parseFloat(row.debit_amount) || 0;
      } else if (row.description.includes('원재료') || row.description.includes('재료')) {
        endingMaterialInventory = parseFloat(row.debit_amount) || 0;
      } else if (row.description.includes('제품')) {
        endingFinishedGoodsInventory = parseFloat(row.debit_amount) || 0;
      } else if (row.description.includes('재공품')) {
        endingWorkInProgress = parseFloat(row.debit_amount) || 0;
      }
    });

    return {
      success: true,
      revenues,
      totalRevenue: parseFloat(totalRevenue) || 0,
      beginningProductInventory: parseFloat(beginningInventory[0]?.beginningProductInventory) || 0,
      beginningMaterialInventory: parseFloat(beginningInventory[0]?.beginningMaterialInventory) || 0,
      beginningFinishedGoodsInventory: parseFloat(beginningInventory[0]?.beginningFinishedGoodsInventory) || 0,
      beginningWorkInProgress: parseFloat(beginningInventory[0]?.beginningWorkInProgress) || 0,
      productPurchases: parseFloat(purchases[0]?.productPurchases) || 0,
      materialPurchases: parseFloat(purchases[0]?.materialPurchases) || 0,
      laborDetails,
      laborCost: parseFloat(laborCost) || 0,
      overheadDetails,
      overheadCost: parseFloat(overheadCost) || 0,
      expenseDetails,
      operatingExpenses: parseFloat(operatingExpenses) || 0,
      inventory: {
        endingProductInventory,
        endingMaterialInventory,
        endingFinishedGoodsInventory,
        endingWorkInProgress
      }
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 결산전표 생성
async function createSettlementVoucher(companyId, fiscalYear, inventory) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 회계기수 정보 조회
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];
    const voucherDate = new Date(period.end_date); // 회계기간 마지막 날 (12/31)

    // 기존 결산전표 삭제 (재결산 허용)
    // voucher_type이 '5'(결차) 또는 '6'(결대)이고 description이 '결산전표 자동생성'인 전표만 삭제
    const [deleteResult] = await connection.query(
      `DELETE gv FROM general_vouchers gv
       INNER JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id
       WHERE gv.company_id = ?
       AND gvl.voucher_type IN ('5', '6')
       AND gvl.description = '결산전표 자동생성'`,
      [companyId]
    );

    // 재고 관련 계정 조회
    const [accounts] = await connection.query(
      `SELECT account_id, account_code, account_name
       FROM accounts
       WHERE company_id = ?
       AND account_name IN ('상품', '원재료', '제품')`,
      [companyId]
    );

    const accountMap = {};
    accounts.forEach(acc => {
      accountMap[acc.account_name] = acc;
    });

    const vouchersToCreate = [];

    // 1. 기말 상품 재고액 전표 생성
    if (inventory.endingProductInventory && inventory.endingProductInventory > 0) {
      const productAccount = accountMap['상품'];
      if (productAccount) {
        vouchersToCreate.push({
          account: productAccount,
          amount: inventory.endingProductInventory,
          description: '[결산] 기말 상품 재고액'
        });
      }
    }

    // 2. 기말 원재료 재고액 전표 생성
    if (inventory.endingMaterialInventory && inventory.endingMaterialInventory > 0) {
      const materialAccount = accountMap['원재료'];
      if (materialAccount) {
        vouchersToCreate.push({
          account: materialAccount,
          amount: inventory.endingMaterialInventory,
          description: '[결산] 기말 원재료 재고액'
        });
      }
    }

    // 3. 기말 제품 재고액 전표 생성
    if (inventory.endingFinishedGoodsInventory && inventory.endingFinishedGoodsInventory > 0) {
      const goodsAccount = accountMap['제품'];
      if (goodsAccount) {
        vouchersToCreate.push({
          account: goodsAccount,
          amount: inventory.endingFinishedGoodsInventory,
          description: '[결산] 기말 제품 재고액'
        });
      }
    }

    // 전표번호 생성 - 일반전표와 동일한 로직 사용 (라인이 있는 전표만 카운트)
    const datePart = voucherDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const voucherNoPattern = `${datePart}-%`; // 20241230-%

    const sql = 'SELECT MAX(CAST(SUBSTRING_INDEX(gv.voucher_no, \'-\', -1) AS UNSIGNED)) as max_no ' +
                'FROM general_vouchers gv ' +
                'INNER JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id ' +
                'WHERE gv.company_id = ? ' +
                'AND gv.voucher_no LIKE ?';

    const [maxVoucherResult] = await connection.query(sql, [
      companyId,
      voucherNoPattern
    ]);

    const maxNo = maxVoucherResult[0].max_no || 0;
    let voucherNo = maxNo + 1;

    // 전표 생성
    for (const voucher of vouchersToCreate) {
      // 전표번호 생성 (형식: YYYYMMDD-###)
      const datePart = voucherDate.toISOString().split('T')[0].replace(/-/g, '');
      const voucherNoStr = `${datePart}-${String(voucherNo).padStart(3, '0')}`;

      // 일반전표 헤더 생성 (created_by는 시스템 사용자 ID 1로 설정)
      const [voucherResult] = await connection.query(
        `INSERT INTO general_vouchers (company_id, voucher_date, voucher_no, description, created_by, created_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [companyId, voucherDate, voucherNoStr, voucher.description]
      );

      const voucherId = voucherResult.insertId;

      voucherNo++;

      // 전표 라인 생성 (결산 차변: 재고 계정)
      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, voucher_type, account_id, debit_amount, credit_amount, description)
         VALUES (?, ?, '5', ?, ?, 0, '결산전표 자동생성')`,
        [voucherId, 1, voucher.account.account_id, voucher.amount]
      );

      // 전표 라인 생성 (결산 대변: 매출원가 등 - 일단 임시로 동일 계정에 대변 처리)
      // TODO: 실제로는 매출원가 계정으로 처리해야 함
      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, voucher_type, account_id, debit_amount, credit_amount, description)
         VALUES (?, ?, '6', ?, 0, ?, '결산전표 자동생성')`,
        [voucherId, 2, voucher.account.account_id, voucher.amount]
      );
    }

    await connection.commit();

    return {
      success: true,
      message: `결산전표 ${vouchersToCreate.length}건이 생성되었습니다`
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 기존 손익 결산 전표 삭제 (수익/비용 계정 → 당기순이익 전표만)
    // 전표 헤더의 description이 '[결산] 수익계정 → 당기순이익' 또는 '[결산] 비용계정 → 당기순이익'인 전표만 삭제
    await connection.query(
      `DELETE FROM general_vouchers
       WHERE company_id = ?
       AND (description = '[결산] 수익계정 → 당기순이익'
            OR description = '[결산] 비용계정 → 당기순이익')`,
      [companyId]
    );

    // 수익 및 비용 계정 조회
    const [accounts] = await connection.query(
      settlementQueries.getProfitLossAccountsQuery,
      [companyId, companyId, companyId, period.start_date, period.end_date]
    );

    // 각 수익/비용 계정별로 결산전표 생성 (Option A)
    const voucherDate = new Date(period.end_date);

    // 998 계정의 account_id 조회
    const [[account998]] = await connection.query(
      'SELECT account_id FROM accounts WHERE company_id = ? AND account_code = ?',
      [companyId, '998']
    );

    if (!account998) {
      throw new Error('998(당기순이익) 계정을 찾을 수 없습니다.');
    }

    // 전표번호 생성을 위한 준비
    const datePart = voucherDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const voucherNoPattern = `${datePart}-%`; // 20241230-%

    const sql = 'SELECT MAX(CAST(SUBSTRING_INDEX(gv.voucher_no, \'-\', -1) AS UNSIGNED)) as max_no ' +
                'FROM general_vouchers gv ' +
                'INNER JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id ' +
                'WHERE gv.company_id = ? ' +
                'AND gv.voucher_no LIKE ?';

    const [maxVoucherResult] = await connection.query(sql, [
      companyId,
      voucherNoPattern
    ]);

    const maxNo = maxVoucherResult[0].max_no || 0;
    let voucherNo = maxNo + 1;

    // 수익/비용 계정을 분리하고 계정 정보 조회
    const revenues = [];
    const expenses = [];

    for (const account of accounts) {
      const balance = account.total_credit - account.total_debit;

      if (Math.abs(balance) < 0.01) continue; // 잔액이 0이면 건너뛰기

      // 해당 계정의 account_id 조회
      const [[accountInfo]] = await connection.query(
        'SELECT account_id FROM accounts WHERE company_id = ? AND account_code = ?',
        [companyId, account.account_code]
      );

      if (!accountInfo) continue;

      if (balance > 0) {
        revenues.push({ ...account, balance, account_id: accountInfo.account_id });
      } else {
        expenses.push({ ...account, balance: Math.abs(balance), account_id: accountInfo.account_id });
      }
    }

    // 수익 계정 결산 전표 생성 (하나의 전표로 통합)
    if (revenues.length > 0) {
      const datePart = voucherDate.toISOString().split('T')[0].replace(/-/g, '');
      const voucherNoStr = `${datePart}-${String(voucherNo).padStart(3, '0')}`;
      const totalRevenue = revenues.reduce((sum, acc) => sum + acc.balance, 0);

      // 전표 생성
      const [voucherResult] = await connection.query(
        `INSERT INTO general_vouchers (company_id, voucher_date, voucher_no, description, created_by)
         VALUES (?, ?, ?, '[결산] 수익계정 → 당기순이익', 1)`,
        [companyId, voucherDate, voucherNoStr]
      );

      const voucherId = voucherResult.insertId;
      voucherNo++;

      // 전표 라인 생성 (수익 계정들은 결차, 당기순이익은 결대)
      let lineNo = 1;
      const lineValues = [];

      for (const revenue of revenues) {
        lineValues.push([
          voucherId,
          lineNo++,
          '5', // 결차
          revenue.balance,
          null, // description_code
          revenue.account_id,
          null, // client_id
          revenue.balance,
          0,
          `결산전표 ${revenue.account_name} 대체`,
          null, // department_code
          null  // project_code
        ]);
      }

      // 당기순이익 대변 라인 추가
      lineValues.push([
        voucherId,
        lineNo,
        '6', // 결대
        totalRevenue,
        null, // description_code
        account998.account_id,
        null, // client_id
        0,
        totalRevenue,
        '결산전표 당기순이익',
        null, // department_code
        null  // project_code
      ]);

      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, voucher_type, amount, description_code, account_id, client_id, debit_amount, credit_amount, description, department_code, project_code)
         VALUES ?`,
        [lineValues]
      );
    }

    // 비용 계정 결산 전표 생성 (하나의 전표로 통합)
    if (expenses.length > 0) {
      const datePart = voucherDate.toISOString().split('T')[0].replace(/-/g, '');
      const voucherNoStr = `${datePart}-${String(voucherNo).padStart(3, '0')}`;
      const totalExpense = expenses.reduce((sum, acc) => sum + acc.balance, 0);

      // 전표 생성
      const [voucherResult] = await connection.query(
        `INSERT INTO general_vouchers (company_id, voucher_date, voucher_no, description, created_by)
         VALUES (?, ?, ?, '[결산] 비용계정 → 당기순이익', 1)`,
        [companyId, voucherDate, voucherNoStr]
      );

      const voucherId = voucherResult.insertId;
      voucherNo++;

      // 전표 라인 생성 (당기순이익은 결차, 비용 계정들은 결대)
      let lineNo = 1;
      const lineValues = [];

      // 당기순이익 차변 라인 추가
      lineValues.push([
        voucherId,
        lineNo++,
        '5', // 결차
        totalExpense,
        null, // description_code
        account998.account_id,
        null, // client_id
        totalExpense,
        0,
        '결산전표 당기순이익',
        null, // department_code
        null  // project_code
      ]);

      for (const expense of expenses) {
        lineValues.push([
          voucherId,
          lineNo++,
          '6', // 결대
          expense.balance,
          null, // description_code
          expense.account_id,
          null, // client_id
          0,
          expense.balance,
          `결산전표 ${expense.account_name} 대체`,
          null, // department_code
          null  // project_code
        ]);
      }

      await connection.query(
        `INSERT INTO general_voucher_lines (voucher_id, line_no, voucher_type, amount, description_code, account_id, client_id, debit_amount, credit_amount, description, department_code, project_code)
         VALUES ?`,
        [lineValues]
      );
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
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

    // 전기이월 이익잉여금 조회 (999 계정)
    const [retainedRows] = await connection.query(
      settlementQueries.getAccountBalanceQuery,
      [companyId, '999', period.start_date, period.end_date]
    );

    const previousRetainedEarnings = retainedRows.length > 0
      ? (retainedRows[0].total_credit - retainedRows[0].total_debit)
      : 0;

    // 날짜를 YYYY-MM-DD 형식으로 변환 (시간 부분 제거)
    const formatDateOnly = (date) => {
      if (!date) return null;
      const d = new Date(date);
      // +9시간 보정된 날짜에서 날짜 부분만 추출
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      netIncome,
      previousRetainedEarnings,
      totalRetainedEarnings: netIncome + previousRetainedEarnings,
      currentDisposalDate: formatDateOnly(period.current_disposal_date),
      previousDisposalDate: formatDateOnly(period.previous_disposal_date)
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// 이익잉여금 처분일 저장
async function executeRetainedEarningsSettlement(companyId, fiscalYear, currentDisposalDate, previousDisposalDate) {
  const connection = await db.getConnection();

  try {
    // 빈 문자열을 null로 변환 (DATE 타입은 빈 문자열을 받을 수 없음)
    const currentDate = currentDisposalDate && currentDisposalDate.trim() !== '' ? currentDisposalDate : null;
    const previousDate = previousDisposalDate && previousDisposalDate.trim() !== '' ? previousDisposalDate : null;

    // 유효성 검사
    if (!currentDate) {
      throw new Error('당기 처분예정일은 필수입니다.');
    }

    // 2기 이상인 경우 전기 처분확정일도 필수
    if (fiscalYear > 1 && !previousDate) {
      throw new Error('2기 이상은 전기 처분확정일도 필수입니다.');
    }

    // 날짜를 Date 객체로 변환하고 +9시간 (한국 시간대)
    const adjustDateForKorea = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      // UTC 시간으로 저장되지만, 한국 시간대로 +9시간 조정
      date.setHours(date.getHours() + 9);
      return date;
    };

    const adjustedCurrentDate = adjustDateForKorea(currentDate);
    const adjustedPreviousDate = previousDate ? adjustDateForKorea(previousDate) : null;

    // fiscal_periods 테이블에 처분일 업데이트
    await connection.query(
      `UPDATE fiscal_periods
       SET current_disposal_date = ?, previous_disposal_date = ?
       WHERE company_id = ? AND fiscal_year = ?`,
      [adjustedCurrentDate, adjustedPreviousDate, companyId, fiscalYear]
    );

    return {
      success: true,
      message: '처분일이 저장되었습니다.'
    };
  } catch (error) {
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
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
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length === 0) {
      throw new Error('회계기수를 찾을 수 없습니다.');
    }

    const period = periods[0];

    // 모든 계정의 합계와 잔액 조회 (이월잔액 포함)
    const [accounts] = await connection.query(
      settlementQueries.getTrialBalanceQuery,
      [companyId, fiscalYear, companyId, period.start_date, period.end_date]
    );

    let sumOpeningDebit = 0;
    let sumOpeningCredit = 0;
    let sumTotalDebit = 0;
    let sumTotalCredit = 0;
    let sumBalanceDebit = 0;
    let sumBalanceCredit = 0;

    const accountsData = accounts.map(row => {
      const openingDebit = parseFloat(row.opening_debit) || 0;
      const openingCredit = parseFloat(row.opening_credit) || 0;
      const totalDebit = parseFloat(row.total_debit) || 0;
      const totalCredit = parseFloat(row.total_credit) || 0;

      // 기말잔액 = 기초잔액 + 당기발생액
      const balance = (openingDebit - openingCredit) + (totalDebit - totalCredit);
      const balanceDebit = balance > 0 ? balance : 0;
      const balanceCredit = balance < 0 ? -balance : 0;

      sumOpeningDebit += openingDebit;
      sumOpeningCredit += openingCredit;
      sumTotalDebit += totalDebit;
      sumTotalCredit += totalCredit;
      sumBalanceDebit += balanceDebit;
      sumBalanceCredit += balanceCredit;

      return {
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        accountCategory: row.account_category,
        openingDebit,
        openingCredit,
        totalDebit,
        totalCredit,
        balanceDebit,
        balanceCredit
      };
    });

    return {
      accounts: accountsData,
      sumOpeningDebit,
      sumOpeningCredit,
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
  getSettlementVoucherData,
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
