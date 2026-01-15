const db = require('../config/database');
const queries = require('../queries/ledgerQueries');
const carryForwardModel = require('./carryForwardModel');

// 날짜 범위 파싱 함수
function parseDateRange(startMonth, startDay, endMonth, endDay) {
  const year = new Date().getFullYear();

  // 시작 날짜
  const start = `${year}-${String(startMonth).padStart(2, '0')}-${String(startDay || 1).padStart(2, '0')}`;

  // 종료 날짜
  let end;
  if (!endDay) {
    // 종료일 미입력: 해당 월 마지막 날
    const lastDay = new Date(year, endMonth, 0).getDate();
    end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  }

  return { start, end };
}

// 계정코드 범위 파싱 함수
function parseAccountCodeRange(startCode, endCode) {
  const start = startCode || '101';  // 기본: 101 (가장 작은 계정코드)
  const end = endCode || '999';      // 기본: 999 (가장 큰 계정코드)

  return { start, end };
}

// 계정별 원장 조회
async function getAccountLedger(companyId, filters) {
  const {
    startMonth,
    startDay,
    endMonth,
    endDay,
    startAccountCode,
    endAccountCode,
    fiscalYear
  } = filters;

  // 날짜 범위 계산 - 사용자 입력이 있으면 우선 사용
  let dateRange;
  const hasUserDateInput = startMonth || endMonth;

  if (hasUserDateInput && fiscalYear) {
    // 사용자가 날짜를 입력한 경우 - 회계기수의 연도와 결합
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      const year = new Date(periods[0].start_date).getFullYear();
      const sMonth = startMonth || 1;
      const sDay = startDay || 1;
      const eMonth = endMonth || 12;
      let eDay = endDay;
      if (!eDay) {
        eDay = new Date(year, eMonth, 0).getDate();
      }

      dateRange = {
        start: `${year}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`,
        end: `${year}-${String(eMonth).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else if (fiscalYear) {
    // 사용자 입력 없이 fiscalYear만 있는 경우 - 회계기수 전체 기간
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      dateRange = {
        start: periods[0].start_date,
        end: periods[0].end_date
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else {
    // fiscalYear가 없으면 기본 날짜 범위 계산
    dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
  }

  // 계정코드 범위 계산
  const accountCodeRange = parseAccountCodeRange(startAccountCode, endAccountCode);

  const [rows] = await db.query(
    queries.GET_ACCOUNT_LEDGER_ALL,
    [
      // 일반전표 메인 쿼리
      companyId,
      dateRange.start,
      dateRange.end,
      // 일반전표 서브쿼리
      companyId,
      dateRange.start,
      dateRange.end,
      accountCodeRange.start,
      accountCodeRange.end,
      // 매입매출전표 메인 쿼리
      companyId,
      dateRange.start,
      dateRange.end,
      // 매입매출전표 서브쿼리
      companyId,
      dateRange.start,
      dateRange.end,
      accountCodeRange.start,
      accountCodeRange.end
    ]
  );

  // 이월 데이터 계산 (조회 시작일 이전 데이터 합산)
  if (hasUserDateInput && fiscalYear) {
    // 사용자가 기간을 지정한 경우 - 조회 시작일 이전 데이터를 이월로 계산
    const [periods] = await db.query(
      'SELECT start_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      const fiscalStartDate = periods[0].start_date;
      const queryStartDate = dateRange.start;

      // 회계기수 시작일부터 조회 시작일 전날까지의 데이터를 이월로 계산
      const previousEndDate = new Date(queryStartDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const prevEndStr = previousEndDate.toISOString().split('T')[0];

      // 전기이월 잔액 조회
      const [carryForwards] = await db.query(
        `SELECT
          cfb.account_id,
          a.account_code,
          a.account_name,
          cfb.debit_balance,
          cfb.credit_balance
        FROM carry_forward_balances cfb
        INNER JOIN accounts a ON cfb.account_id = a.account_id
        WHERE cfb.company_id = ?
          AND cfb.fiscal_year = ?
          AND cfb.client_id IS NULL
          AND a.account_code BETWEEN ? AND ?
        ORDER BY a.account_code ASC`,
        [companyId, fiscalYear, accountCodeRange.start, accountCodeRange.end]
      );

      // 조회 시작일 이전의 거래 합계 조회 (일반전표 + 매입매출전표)
      const [previousTotals] = await db.query(
        `SELECT
          account_id,
          account_code,
          account_name,
          SUM(debit_amount) as total_debit,
          SUM(credit_amount) as total_credit
        FROM (
          SELECT
            l.account_id,
            a.account_code,
            a.account_name,
            l.debit_amount,
            l.credit_amount
          FROM general_voucher_lines l
          INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
          INNER JOIN accounts a ON l.account_id = a.account_id
          WHERE v.company_id = ?
            AND v.voucher_date >= ? AND v.voucher_date <= ?
            AND a.account_code BETWEEN ? AND ?

          UNION ALL

          SELECT
            l.account_id,
            a.account_code,
            a.account_name,
            CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END as debit_amount,
            CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END as credit_amount
          FROM sales_purchase_voucher_lines l
          INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
          INNER JOIN accounts a ON l.account_id = a.account_id
          WHERE v.company_id = ?
            AND v.voucher_date >= ? AND v.voucher_date <= ?
            AND a.account_code BETWEEN ? AND ?
            AND v.is_active = TRUE
        ) combined
        GROUP BY account_id, account_code, account_name`,
        [
          companyId, fiscalStartDate, prevEndStr, accountCodeRange.start, accountCodeRange.end,
          companyId, fiscalStartDate, prevEndStr, accountCodeRange.start, accountCodeRange.end
        ]
      );

      // 전기이월 + 이전 거래를 합산하여 이월 라인 생성
      const carryForwardMap = {};
      carryForwards.forEach(cf => {
        carryForwardMap[cf.account_id] = {
          account_id: cf.account_id,
          account_code: cf.account_code,
          account_name: cf.account_name,
          debit: parseFloat(cf.debit_balance) || 0,
          credit: parseFloat(cf.credit_balance) || 0
        };
      });

      previousTotals.forEach(pt => {
        if (!carryForwardMap[pt.account_id]) {
          carryForwardMap[pt.account_id] = {
            account_id: pt.account_id,
            account_code: pt.account_code,
            account_name: pt.account_name,
            debit: 0,
            credit: 0
          };
        }
        carryForwardMap[pt.account_id].debit += parseFloat(pt.total_debit) || 0;
        carryForwardMap[pt.account_id].credit += parseFloat(pt.total_credit) || 0;
      });

      // 이월 라인 생성 (잔액이 있는 경우만)
      const carryForwardLines = Object.values(carryForwardMap)
        .filter(cf => cf.debit !== cf.credit)
        .map(cf => {
          const balance = cf.debit - cf.credit;
          return {
            voucher_id: null,
            voucher_date: queryStartDate,
            voucher_type: 'carry_forward',
            voucher_no: '이월',
            line_no: 0,
            debit_credit: balance > 0 ? '차변' : '대변',
            account_id: cf.account_id,
            account_code: cf.account_code,
            account_name: cf.account_name,
            amount: Math.abs(balance),
            description_code: null,
            description: '이월',
            client_code: null,
            client_name: null
          };
        })
        .sort((a, b) => a.account_code.localeCompare(b.account_code));

      // 이월 라인을 결과 맨 앞에 추가
      rows.unshift(...carryForwardLines);
    }
  } else if (fiscalYear) {
    // 사용자 입력 없이 전체 기간 조회 - 기존 전기이월만 표시
    const [periods] = await db.query(
      'SELECT start_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      const fiscalStartDate = periods[0].start_date;

      // 전기이월 데이터 조회 (계정코드 범위에 해당하는 이월잔액만)
      const [carryForwards] = await db.query(
        `SELECT
          cfb.account_id,
          a.account_code,
          a.account_name,
          cfb.debit_balance,
          cfb.credit_balance,
          NULL as client_id,
          NULL as client_code,
          NULL as client_name
        FROM carry_forward_balances cfb
        INNER JOIN accounts a ON cfb.account_id = a.account_id
        WHERE cfb.company_id = ?
          AND cfb.fiscal_year = ?
          AND cfb.client_id IS NULL
          AND a.account_code BETWEEN ? AND ?
          AND (cfb.debit_balance != 0 OR cfb.credit_balance != 0)
        ORDER BY a.account_code ASC`,
        [companyId, fiscalYear, accountCodeRange.start, accountCodeRange.end]
      );

      // 전기이월 라인 생성
      const carryForwardLines = carryForwards.map(cf => ({
        voucher_id: null,
        voucher_date: fiscalStartDate,
        voucher_type: 'carry_forward',
        voucher_no: '전기이월',
        line_no: 0,
        debit_credit: cf.debit_balance > 0 ? '차변' : '대변',
        account_id: cf.account_id,
        account_code: cf.account_code,
        account_name: cf.account_name,
        amount: cf.debit_balance > 0 ? cf.debit_balance : cf.credit_balance,
        description_code: null,
        description: '전기이월',
        client_code: null,
        client_name: null
      }));

      // 전기이월 라인을 결과 맨 앞에 추가
      rows.unshift(...carryForwardLines);
    }
  }

  return rows;
}

// 계정 요약 조회 (사이드바용)
async function getAccountSummary(companyId, filters) {
  const {
    startMonth,
    startDay,
    endMonth,
    endDay,
    startAccountCode,
    endAccountCode,
    fiscalYear
  } = filters;

  // 날짜 범위 계산 - 사용자 입력이 있으면 우선 사용
  let dateRange;
  let fiscalStartDate = null;
  const hasUserDateInput = startMonth || endMonth;

  if (hasUserDateInput && fiscalYear) {
    // 사용자가 날짜를 입력한 경우 - 회계기수의 연도와 결합
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      const year = new Date(periods[0].start_date).getFullYear();
      const sMonth = startMonth || 1;
      const sDay = startDay || 1;
      const eMonth = endMonth || 12;
      let eDay = endDay;
      if (!eDay) {
        eDay = new Date(year, eMonth, 0).getDate();
      }

      dateRange = {
        start: `${year}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`,
        end: `${year}-${String(eMonth).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else if (fiscalYear) {
    // 사용자 입력 없이 fiscalYear만 있는 경우 - 회계기수 전체 기간
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      dateRange = {
        start: periods[0].start_date,
        end: periods[0].end_date
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else {
    // fiscalYear가 없으면 기본 날짜 범위 계산
    dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
  }

  // 계정코드 범위 계산
  const accountCodeRange = parseAccountCodeRange(startAccountCode, endAccountCode);

  // 조회 기간 내 거래가 있는 계정 목록
  const [rows] = await db.query(
    queries.GET_ACCOUNT_SUMMARY,
    [
      companyId,
      dateRange.start,
      dateRange.end,
      accountCodeRange.start,
      accountCodeRange.end,
      companyId,
      dateRange.start,
      dateRange.end,
      accountCodeRange.start,
      accountCodeRange.end
    ]
  );

  // 결과를 Map으로 변환 (account_id를 키로)
  const accountMap = new Map();
  for (let row of rows) {
    accountMap.set(row.account_id, {
      ...row,
      carry_forward_debit: 0,
      carry_forward_credit: 0,
      previous_debit: 0,
      previous_credit: 0
    });
  }

  // 이월잔액이 있는 계정 추가 (fiscalYear가 제공된 경우)
  if (fiscalYear) {
    // 전기이월 잔액이 있는 계정 조회
    const [carryForwards] = await db.query(
      `SELECT
        cfb.account_id,
        a.account_code,
        a.account_name,
        cfb.debit_balance,
        cfb.credit_balance
      FROM carry_forward_balances cfb
      INNER JOIN accounts a ON cfb.account_id = a.account_id
      WHERE cfb.company_id = ?
        AND cfb.fiscal_year = ?
        AND cfb.client_id IS NULL
        AND a.account_code BETWEEN ? AND ?
        AND (cfb.debit_balance != 0 OR cfb.credit_balance != 0)`,
      [companyId, fiscalYear, accountCodeRange.start, accountCodeRange.end]
    );

    // 전기이월 계정을 Map에 추가
    for (let cf of carryForwards) {
      if (!accountMap.has(cf.account_id)) {
        accountMap.set(cf.account_id, {
          account_id: cf.account_id,
          account_code: cf.account_code,
          account_name: cf.account_name,
          voucher_count: 0,
          total_debit: 0,
          total_credit: 0,
          carry_forward_debit: parseFloat(cf.debit_balance) || 0,
          carry_forward_credit: parseFloat(cf.credit_balance) || 0,
          previous_debit: 0,
          previous_credit: 0
        });
      } else {
        accountMap.get(cf.account_id).carry_forward_debit = parseFloat(cf.debit_balance) || 0;
        accountMap.get(cf.account_id).carry_forward_credit = parseFloat(cf.credit_balance) || 0;
      }
    }

    // 사용자가 기간을 지정한 경우 - 조회 시작일 이전 거래가 있는 계정도 추가
    if (hasUserDateInput && fiscalStartDate) {
      const previousEndDate = new Date(dateRange.start);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const prevEndStr = previousEndDate.toISOString().split('T')[0];

      // 조회 시작일 이전의 거래 합계 조회
      const [previousTotals] = await db.query(
        `SELECT
          account_id,
          account_code,
          account_name,
          SUM(debit_amount) as total_debit,
          SUM(credit_amount) as total_credit
        FROM (
          SELECT
            l.account_id,
            a.account_code,
            a.account_name,
            l.debit_amount,
            l.credit_amount
          FROM general_voucher_lines l
          INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
          INNER JOIN accounts a ON l.account_id = a.account_id
          WHERE v.company_id = ?
            AND v.voucher_date >= ? AND v.voucher_date <= ?
            AND a.account_code BETWEEN ? AND ?

          UNION ALL

          SELECT
            l.account_id,
            a.account_code,
            a.account_name,
            CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END as debit_amount,
            CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END as credit_amount
          FROM sales_purchase_voucher_lines l
          INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
          INNER JOIN accounts a ON l.account_id = a.account_id
          WHERE v.company_id = ?
            AND v.voucher_date >= ? AND v.voucher_date <= ?
            AND a.account_code BETWEEN ? AND ?
            AND v.is_active = TRUE
        ) combined
        GROUP BY account_id, account_code, account_name
        HAVING SUM(debit_amount) != SUM(credit_amount)`,
        [
          companyId, fiscalStartDate, prevEndStr, accountCodeRange.start, accountCodeRange.end,
          companyId, fiscalStartDate, prevEndStr, accountCodeRange.start, accountCodeRange.end
        ]
      );

      // 이전 거래가 있는 계정을 Map에 추가
      for (let pt of previousTotals) {
        if (!accountMap.has(pt.account_id)) {
          accountMap.set(pt.account_id, {
            account_id: pt.account_id,
            account_code: pt.account_code,
            account_name: pt.account_name,
            voucher_count: 0,
            total_debit: 0,
            total_credit: 0,
            carry_forward_debit: 0,
            carry_forward_credit: 0,
            previous_debit: parseFloat(pt.total_debit) || 0,
            previous_credit: parseFloat(pt.total_credit) || 0
          });
        } else {
          accountMap.get(pt.account_id).previous_debit = parseFloat(pt.total_debit) || 0;
          accountMap.get(pt.account_id).previous_credit = parseFloat(pt.total_credit) || 0;
        }
      }
    }
  }

  // Map을 배열로 변환하고 account_code 순으로 정렬
  const result = Array.from(accountMap.values())
    .filter(account => {
      // 잔액이 있는 계정만 반환 (전기이월 + 이전거래 + 현재거래 잔액 계산)
      const totalDebit = (account.carry_forward_debit || 0) + (account.previous_debit || 0) + (parseFloat(account.total_debit) || 0);
      const totalCredit = (account.carry_forward_credit || 0) + (account.previous_credit || 0) + (parseFloat(account.total_credit) || 0);
      return totalDebit !== totalCredit || account.voucher_count > 0;
    })
    .sort((a, b) => a.account_code.localeCompare(b.account_code));

  return result;
}

// 전표 라인 수정
async function updateVoucherLine(voucherType, voucherId, lineNo, lineData) {
  const { account_code, client_code, debit_credit, amount, description_code, description } = lineData;

  // 필수 입력 검증
  if (!account_code || !account_code.trim()) {
    throw new Error('계정코드를 입력해주세요');
  }

  // 전표의 company_id 조회
  let companyId;
  if (voucherType === 'general') {
    const [vouchers] = await db.query(
      'SELECT company_id FROM general_vouchers WHERE voucher_id = ?',
      [voucherId]
    );
    if (vouchers.length === 0) {
      throw new Error('존재하지 않는 전표입니다');
    }
    companyId = vouchers[0].company_id;
  } else {
    const [vouchers] = await db.query(
      'SELECT company_id FROM sales_purchase_vouchers WHERE voucher_id = ?',
      [voucherId]
    );
    if (vouchers.length === 0) {
      throw new Error('존재하지 않는 전표입니다');
    }
    companyId = vouchers[0].company_id;
  }

  // 계정코드로 account_id 조회 (company_id 조건 추가)
  const [accounts] = await db.query(
    'SELECT account_id FROM accounts WHERE account_code = ? AND company_id = ?',
    [account_code, companyId]
  );

  if (accounts.length === 0) {
    throw new Error('존재하지 않는 계정코드입니다');
  }

  const accountId = accounts[0].account_id;

  // 거래처코드로 client_id 조회 (company_id 조건 추가)
  let clientId = null;
  if (client_code && client_code.trim()) {
    const [clients] = await db.query(
      'SELECT client_id FROM clients WHERE client_code = ? AND company_id = ?',
      [client_code, companyId]
    );

    if (clients.length === 0) {
      throw new Error('존재하지 않는 거래처코드입니다');
    }

    clientId = clients[0].client_id;
  }

  if (voucherType === 'general') {
    // 일반전표 라인 수정
    const voucherQueries = require('../queries/voucherQueries');
    const debitAmount = debit_credit === '차변' ? amount : 0;
    const creditAmount = debit_credit === '대변' ? amount : 0;

    await db.query(
      voucherQueries.UPDATE_VOUCHER_LINE_BY_NO,
      [
        amount,
        description_code || null,
        accountId,
        clientId,
        debitAmount,
        creditAmount,
        description || null,
        null, // department_code
        null, // project_code
        voucherId,
        lineNo
      ]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM general_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    await db.query(
      voucherQueries.UPDATE_VOUCHER_TOTALS,
      [lines[0].total_debit, lines[0].total_credit, voucherId]
    );
  } else {
    // 매입매출전표 라인 수정
    const salesPurchaseQueries = require('../queries/salesPurchaseQueries');

    await db.query(
      salesPurchaseQueries.UPDATE_VOUCHER_LINE,
      [
        debit_credit,
        accountId,
        clientId,
        amount,
        description || null,
        description_code || null,
        null, // department_code
        null, // project_code
        voucherId,
        lineNo
      ]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(amount) as total FROM sales_purchase_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    // 매입매출 전표는 total_amount만 업데이트 (간단히)
    await db.query(
      'UPDATE sales_purchase_vouchers SET total_amount = ? WHERE voucher_id = ?',
      [lines[0].total, voucherId]
    );
  }

  return { success: true };
}

// 전표 라인 추가
async function addVoucherLine(voucherType, voucherId, lineData) {
  const { line_no, account_code, client_code, debit_credit, amount, description_code, description } = lineData;

  // 필수 입력 검증
  if (!account_code || !account_code.trim()) {
    throw new Error('계정코드를 입력해주세요');
  }

  // 전표의 company_id 조회
  let companyId;
  if (voucherType === 'general') {
    const [vouchers] = await db.query(
      'SELECT company_id FROM general_vouchers WHERE voucher_id = ?',
      [voucherId]
    );
    if (vouchers.length === 0) {
      throw new Error('존재하지 않는 전표입니다');
    }
    companyId = vouchers[0].company_id;
  } else {
    const [vouchers] = await db.query(
      'SELECT company_id FROM sales_purchase_vouchers WHERE voucher_id = ?',
      [voucherId]
    );
    if (vouchers.length === 0) {
      throw new Error('존재하지 않는 전표입니다');
    }
    companyId = vouchers[0].company_id;
  }

  // 계정코드로 account_id 조회 (company_id 조건 추가)
  const [accounts] = await db.query(
    'SELECT account_id FROM accounts WHERE account_code = ? AND company_id = ?',
    [account_code, companyId]
  );

  if (accounts.length === 0) {
    throw new Error('존재하지 않는 계정코드입니다');
  }

  const accountId = accounts[0].account_id;

  // 거래처코드로 client_id 조회 (company_id 조건 추가)
  let clientId = null;
  if (client_code && client_code.trim()) {
    const [clients] = await db.query(
      'SELECT client_id FROM clients WHERE client_code = ? AND company_id = ?',
      [client_code, companyId]
    );

    if (clients.length === 0) {
      throw new Error('존재하지 않는 거래처코드입니다');
    }

    clientId = clients[0].client_id;
  }

  if (voucherType === 'general') {
    // 일반전표 라인 추가
    const voucherQueries = require('../queries/voucherQueries');
    const debitAmount = debit_credit === '차변' ? amount : 0;
    const creditAmount = debit_credit === '대변' ? amount : 0;

    await db.query(
      voucherQueries.CREATE_VOUCHER_LINE,
      [
        voucherId,
        line_no,
        amount,
        description_code || null,
        accountId,
        clientId,
        debitAmount,
        creditAmount,
        description || null,
        null, // department_code
        null  // project_code
      ]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM general_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    await db.query(
      voucherQueries.UPDATE_VOUCHER_TOTALS,
      [lines[0].total_debit, lines[0].total_credit, voucherId]
    );
  } else {
    // 매입매출전표 라인 추가
    const salesPurchaseQueries = require('../queries/salesPurchaseQueries');

    await db.query(
      salesPurchaseQueries.CREATE_VOUCHER_LINE,
      [
        voucherId,
        line_no,
        debit_credit,
        accountId,
        clientId,
        amount,
        description || null,
        description_code || null,
        null, // department_code
        null  // project_code
      ]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(amount) as total FROM sales_purchase_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    await db.query(
      'UPDATE sales_purchase_vouchers SET total_amount = ? WHERE voucher_id = ?',
      [lines[0].total, voucherId]
    );
  }

  return { success: true };
}

// 전표 라인 삭제
async function deleteVoucherLine(voucherType, voucherId, lineNo) {
  if (voucherType === 'general') {
    // 일반전표 라인 삭제
    const voucherQueries = require('../queries/voucherQueries');

    await db.query(
      'DELETE FROM general_voucher_lines WHERE voucher_id = ? AND line_no = ?',
      [voucherId, lineNo]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM general_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    if (lines.length > 0 && lines[0].total_debit !== null) {
      await db.query(
        voucherQueries.UPDATE_VOUCHER_TOTALS,
        [lines[0].total_debit || 0, lines[0].total_credit || 0, voucherId]
      );
    }
  } else {
    // 매입매출전표 라인 삭제
    await db.query(
      'DELETE FROM sales_purchase_voucher_lines WHERE voucher_id = ? AND line_no = ?',
      [voucherId, lineNo]
    );

    // 전표 합계 재계산
    const [lines] = await db.query(
      'SELECT SUM(amount) as total FROM sales_purchase_voucher_lines WHERE voucher_id = ?',
      [voucherId]
    );

    if (lines.length > 0 && lines[0].total !== null) {
      await db.query(
        'UPDATE sales_purchase_vouchers SET total_amount = ? WHERE voucher_id = ?',
        [lines[0].total || 0, voucherId]
      );
    }
  }

  return { success: true };
}

// 거래처별 원장 요약 조회
async function getClientLedgerSummary(companyId, filters) {
  const { startMonth, startDay, endMonth, endDay, accountCode, startClientCode, endClientCode, fiscalYear } = filters;

  // 날짜 범위 계산 - 사용자 입력이 있으면 우선 사용
  let dateRange;
  let fiscalStartDate = null;
  const hasUserDateInput = startMonth || endMonth;

  if (hasUserDateInput && fiscalYear) {
    // 사용자가 날짜를 입력한 경우 - 회계기수의 연도와 결합
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      const year = new Date(periods[0].start_date).getFullYear();
      const sMonth = startMonth || 1;
      const sDay = startDay || 1;
      const eMonth = endMonth || 12;
      let eDay = endDay;
      if (!eDay) {
        eDay = new Date(year, eMonth, 0).getDate();
      }

      dateRange = {
        start: `${year}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`,
        end: `${year}-${String(eMonth).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else if (fiscalYear) {
    // 사용자 입력 없이 fiscalYear만 있는 경우 - 회계기수 전체 기간
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      dateRange = {
        start: periods[0].start_date,
        end: periods[0].end_date
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else {
    // fiscalYear가 없으면 기본 날짜 범위 계산
    dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
  }

  // 거래처코드 범위 설정
  const clientStart = startClientCode || '00001';
  const clientEnd = endClientCode || '99999';

  try {
    // 계정코드로 account_id 조회
    const [accounts] = await db.query(
      'SELECT account_id FROM accounts WHERE account_code = ? AND company_id = ?',
      [accountCode, companyId]
    );

    const accountId = accounts.length > 0 ? accounts[0].account_id : null;

    if (!accountId) {
      return { success: true, summary: [] };
    }

    // 조회 기간 내 거래가 있는 거래처 목록
    const [rows] = await db.query(
      queries.GET_CLIENT_LEDGER_SUMMARY,
      [
        companyId,
        accountCode,
        dateRange.start,
        dateRange.end,
        clientStart,
        clientEnd,
        companyId,
        accountCode,
        dateRange.start,
        dateRange.end,
        clientStart,
        clientEnd
      ]
    );

    // 결과를 Map으로 변환 (client_id를 키로)
    const clientMap = new Map();
    for (let row of rows) {
      clientMap.set(row.client_id, {
        ...row,
        carry_forward_debit: 0,
        carry_forward_credit: 0,
        previous_debit: 0,
        previous_credit: 0
      });
    }

    // 이월잔액이 있는 거래처 추가 (fiscalYear가 제공된 경우)
    if (fiscalYear && accountId) {
      // 전기이월 잔액이 있는 거래처 조회
      const [carryForwards] = await db.query(
        `SELECT
          cfb.client_id,
          c.client_code,
          c.client_name,
          c.business_number,
          cfb.debit_balance,
          cfb.credit_balance
        FROM carry_forward_balances cfb
        INNER JOIN clients c ON cfb.client_id = c.client_id
        WHERE cfb.company_id = ?
          AND cfb.fiscal_year = ?
          AND cfb.account_id = ?
          AND cfb.client_id IS NOT NULL
          AND c.client_code BETWEEN ? AND ?
          AND (cfb.debit_balance != 0 OR cfb.credit_balance != 0)`,
        [companyId, fiscalYear, accountId, clientStart, clientEnd]
      );

      // 전기이월 거래처를 Map에 추가
      for (let cf of carryForwards) {
        if (!clientMap.has(cf.client_id)) {
          clientMap.set(cf.client_id, {
            client_id: cf.client_id,
            client_code: cf.client_code,
            client_name: cf.client_name,
            business_number: cf.business_number,
            debit_total: 0,
            credit_total: 0,
            carry_forward_debit: parseFloat(cf.debit_balance) || 0,
            carry_forward_credit: parseFloat(cf.credit_balance) || 0,
            previous_debit: 0,
            previous_credit: 0
          });
        } else {
          clientMap.get(cf.client_id).carry_forward_debit = parseFloat(cf.debit_balance) || 0;
          clientMap.get(cf.client_id).carry_forward_credit = parseFloat(cf.credit_balance) || 0;
        }
      }

      // 사용자가 기간을 지정한 경우 - 조회 시작일 이전 거래가 있는 거래처도 추가
      if (hasUserDateInput && fiscalStartDate) {
        const previousEndDate = new Date(dateRange.start);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        const prevEndStr = previousEndDate.toISOString().split('T')[0];

        // 조회 시작일 이전의 거래 합계 조회 (거래처별)
        const [previousTotals] = await db.query(
          `SELECT
            client_id,
            client_code,
            client_name,
            business_number,
            SUM(debit_amount) as total_debit,
            SUM(credit_amount) as total_credit
          FROM (
            SELECT
              l.client_id,
              c.client_code,
              c.client_name,
              c.business_number,
              l.debit_amount,
              l.credit_amount
            FROM general_voucher_lines l
            INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
            INNER JOIN accounts a ON l.account_id = a.account_id
            INNER JOIN clients c ON l.client_id = c.client_id
            WHERE v.company_id = ?
              AND a.account_code = ?
              AND v.voucher_date >= ? AND v.voucher_date <= ?
              AND c.client_code BETWEEN ? AND ?

            UNION ALL

            SELECT
              l.client_id,
              c.client_code,
              c.client_name,
              c.business_number,
              CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END as debit_amount,
              CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END as credit_amount
            FROM sales_purchase_voucher_lines l
            INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
            INNER JOIN accounts a ON l.account_id = a.account_id
            INNER JOIN clients c ON l.client_id = c.client_id
            WHERE v.company_id = ?
              AND a.account_code = ?
              AND v.voucher_date >= ? AND v.voucher_date <= ?
              AND c.client_code BETWEEN ? AND ?
              AND v.is_active = TRUE
          ) combined
          WHERE client_id IS NOT NULL
          GROUP BY client_id, client_code, client_name, business_number
          HAVING SUM(debit_amount) != SUM(credit_amount)`,
          [
            companyId, accountCode, fiscalStartDate, prevEndStr, clientStart, clientEnd,
            companyId, accountCode, fiscalStartDate, prevEndStr, clientStart, clientEnd
          ]
        );

        // 이전 거래가 있는 거래처를 Map에 추가
        for (let pt of previousTotals) {
          if (!clientMap.has(pt.client_id)) {
            clientMap.set(pt.client_id, {
              client_id: pt.client_id,
              client_code: pt.client_code,
              client_name: pt.client_name,
              business_number: pt.business_number,
              debit_total: 0,
              credit_total: 0,
              carry_forward_debit: 0,
              carry_forward_credit: 0,
              previous_debit: parseFloat(pt.total_debit) || 0,
              previous_credit: parseFloat(pt.total_credit) || 0
            });
          } else {
            clientMap.get(pt.client_id).previous_debit = parseFloat(pt.total_debit) || 0;
            clientMap.get(pt.client_id).previous_credit = parseFloat(pt.total_credit) || 0;
          }
        }
      }
    }

    // 각 거래처별 이월잔액과 잔액 계산
    const result = [];
    for (let [clientId, client] of clientMap) {
      // 이월잔액 계산: 전기이월 + 조회 시작일 이전 거래
      const carryForwardBalance = (client.carry_forward_debit || 0) - (client.carry_forward_credit || 0);
      const previousTransactionBalance = (client.previous_debit || 0) - (client.previous_credit || 0);
      const previousBalance = carryForwardBalance + previousTransactionBalance;

      // 조회 기간 거래
      const periodDebit = parseFloat(client.debit_total) || 0;
      const periodCredit = parseFloat(client.credit_total) || 0;

      // 최종 잔액
      const balance = previousBalance + periodDebit - periodCredit;

      // 잔액이 있거나 조회 기간 거래가 있는 경우만 포함
      if (balance !== 0 || periodDebit !== 0 || periodCredit !== 0) {
        result.push({
          client_id: client.client_id,
          client_code: client.client_code,
          client_name: client.client_name,
          business_number: client.business_number,
          previous_balance: previousBalance,
          debit_total: periodDebit,
          credit_total: periodCredit,
          balance: balance,
          carry_forward_debit: client.carry_forward_debit || 0,
          carry_forward_credit: client.carry_forward_credit || 0
        });
      }
    }

    // client_code 순으로 정렬
    result.sort((a, b) => a.client_code.localeCompare(b.client_code));

    return { success: true, summary: result };
  } catch (error) {
    console.error('거래처별 원장 요약 조회 실패:', error);
    throw error;
  }
}

// 거래처별 원장 상세 조회
async function getClientLedgerDetail(companyId, filters) {
  const { startMonth, startDay, endMonth, endDay, accountCode, clientId, fiscalYear } = filters;

  // 날짜 범위 계산 - 사용자 입력이 있으면 우선 사용
  let dateRange;
  let fiscalStartDate = null;
  const hasUserDateInput = startMonth || endMonth;

  if (hasUserDateInput && fiscalYear) {
    // 사용자가 날짜를 입력한 경우 - 회계기수의 연도와 결합
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      const year = new Date(periods[0].start_date).getFullYear();
      const sMonth = startMonth || 1;
      const sDay = startDay || 1;
      const eMonth = endMonth || 12;
      let eDay = endDay;
      if (!eDay) {
        eDay = new Date(year, eMonth, 0).getDate();
      }

      dateRange = {
        start: `${year}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`,
        end: `${year}-${String(eMonth).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else if (fiscalYear) {
    // 사용자 입력 없이 fiscalYear만 있는 경우 - 회계기수 전체 기간
    const [periods] = await db.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (periods.length > 0) {
      fiscalStartDate = periods[0].start_date;
      dateRange = {
        start: periods[0].start_date,
        end: periods[0].end_date
      };
    } else {
      dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
    }
  } else {
    // fiscalYear가 없으면 기본 날짜 범위 계산
    dateRange = parseDateRange(startMonth || 1, startDay, endMonth || 12, endDay);
  }

  try {
    const [rows] = await db.query(
      queries.GET_CLIENT_LEDGER_DETAIL,
      [
        companyId,
        accountCode,
        clientId,
        dateRange.start,
        dateRange.end,
        companyId,
        accountCode,
        clientId,
        dateRange.start,
        dateRange.end
      ]
    );

    let previousBalance = 0;
    let carryForwardBalance = 0;
    let previousTransactionBalance = 0;

    // 계정코드로 account_id 조회
    const [accounts] = await db.query(
      'SELECT account_id FROM accounts WHERE account_code = ? AND company_id = ?',
      [accountCode, companyId]
    );

    const accountId = accounts.length > 0 ? accounts[0].account_id : null;

    // 전기이월 잔액 조회 (fiscalYear가 제공된 경우)
    if (fiscalYear && accountId) {
      const carryForward = await carryForwardModel.getAccountClientCarryForward(
        companyId,
        fiscalYear,
        accountId,
        clientId
      );

      if (carryForward) {
        carryForwardBalance = (carryForward.debit_balance || 0) - (carryForward.credit_balance || 0);
      }
    }

    // 사용자가 기간을 지정한 경우 - 조회 시작일 이전 거래 합산
    if (hasUserDateInput && fiscalStartDate) {
      const previousEndDate = new Date(dateRange.start);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const prevEndStr = previousEndDate.toISOString().split('T')[0];

      const [prevRows] = await db.query(
        `
        SELECT
          SUM(CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE 0 END) as prev_debit,
          SUM(CASE WHEN l.credit_amount > 0 THEN l.credit_amount ELSE 0 END) as prev_credit
        FROM general_voucher_lines l
        INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
        INNER JOIN accounts a ON l.account_id = a.account_id
        WHERE v.company_id = ?
          AND a.account_code = ?
          AND l.client_id = ?
          AND v.voucher_date >= ? AND v.voucher_date <= ?

        UNION ALL

        SELECT
          SUM(CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END) as prev_debit,
          SUM(CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END) as prev_credit
        FROM sales_purchase_voucher_lines l
        INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
        INNER JOIN accounts a ON l.account_id = a.account_id
        WHERE v.company_id = ?
          AND a.account_code = ?
          AND l.client_id = ?
          AND v.voucher_date >= ? AND v.voucher_date <= ?
          AND v.is_active = TRUE
        `,
        [companyId, accountCode, clientId, fiscalStartDate, prevEndStr,
         companyId, accountCode, clientId, fiscalStartDate, prevEndStr]
      );

      const prevDebit = prevRows.reduce((sum, row) => sum + (Number(row.prev_debit) || 0), 0);
      const prevCredit = prevRows.reduce((sum, row) => sum + (Number(row.prev_credit) || 0), 0);
      previousTransactionBalance = prevDebit - prevCredit;
    }

    // 이월 잔액 = 전기이월 + 조회 시작일 이전 거래
    previousBalance = carryForwardBalance + previousTransactionBalance;

    // 이월 행 추가 (잔액이 0이 아닌 경우만)
    const ledgerData = [];
    if (previousBalance !== 0) {
      ledgerData.push({
        month: '',
        day: '',
        voucher_type: '이월',
        voucher_no: '',
        debit_amount: previousBalance > 0 ? previousBalance : 0,
        credit_amount: previousBalance < 0 ? -previousBalance : 0,
        balance: previousBalance,
        description: '이월잔액'
      });
    }

    // 잔액 누적 계산
    let runningBalance = previousBalance;
    for (let row of rows) {
      const date = new Date(row.voucher_date);
      runningBalance += (Number(row.debit_amount) || 0) - (Number(row.credit_amount) || 0);

      ledgerData.push({
        month: date.getMonth() + 1,
        day: date.getDate(),
        voucher_type: row.voucher_type,
        voucher_no: row.voucher_no,
        debit_amount: row.debit_amount,
        credit_amount: row.credit_amount,
        balance: runningBalance,
        description: row.description
      });
    }

    return { success: true, ledger: ledgerData };
  } catch (error) {
    console.error('거래처별 원장 상세 조회 실패:', error);
    throw error;
  }
}

module.exports = {
  getAccountLedger,
  getAccountSummary,
  updateVoucherLine,
  addVoucherLine,
  deleteVoucherLine,
  getClientLedgerSummary,
  getClientLedgerDetail
};
