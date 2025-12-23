const db = require('../config/database');
const queries = require('../queries/ledgerQueries');

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
    endAccountCode
  } = filters;

  // 날짜 범위 계산
  const dateRange = parseDateRange(
    startMonth || 1,
    startDay,
    endMonth || 12,
    endDay
  );

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
    endAccountCode
  } = filters;

  // 날짜 범위 계산
  const dateRange = parseDateRange(
    startMonth || 1,
    startDay,
    endMonth || 12,
    endDay
  );

  // 계정코드 범위 계산
  const accountCodeRange = parseAccountCodeRange(startAccountCode, endAccountCode);

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

  return rows;
}

// 전표 라인 수정
async function updateVoucherLine(voucherType, voucherId, lineNo, lineData) {
  const { account_code, debit_credit, amount, description_code, description } = lineData;

  // 필수 입력 검증
  if (!account_code || !account_code.trim()) {
    throw new Error('계정코드를 입력해주세요');
  }

  // 계정코드로 account_id 조회
  const [accounts] = await db.query(
    'SELECT account_id FROM accounts WHERE account_code = ?',
    [account_code]
  );

  if (accounts.length === 0) {
    throw new Error('존재하지 않는 계정코드입니다');
  }

  const accountId = accounts[0].account_id;

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
        null, // client_id
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
  const { line_no, account_code, debit_credit, amount, description_code, description } = lineData;

  // 필수 입력 검증
  if (!account_code || !account_code.trim()) {
    throw new Error('계정코드를 입력해주세요');
  }

  // 계정코드로 account_id 조회
  const [accounts] = await db.query(
    'SELECT account_id FROM accounts WHERE account_code = ?',
    [account_code]
  );

  if (accounts.length === 0) {
    throw new Error('존재하지 않는 계정코드입니다');
  }

  const accountId = accounts[0].account_id;

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
        null, // client_id
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
  const { startMonth, startDay, endMonth, endDay, accountCode, startClientCode, endClientCode } = filters;

  // 날짜 범위 계산
  const dateRange = parseDateRange(
    startMonth || 1,
    startDay,
    endMonth || 12,
    endDay
  );

  // 거래처코드 범위 설정
  const clientStart = startClientCode || '00001';
  const clientEnd = endClientCode || '99999';

  try {
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

    // 전기이월 계산 (조회 시작일 이전의 잔액)
    const year = new Date().getFullYear();
    const previousEnd = new Date(dateRange.start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousEndDate = previousEnd.toISOString().split('T')[0];

    // 각 거래처별 전기이월 계산
    for (let client of rows) {
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
          AND v.voucher_date <= ?

        UNION ALL

        SELECT
          SUM(CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END) as prev_debit,
          SUM(CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END) as prev_credit
        FROM sales_purchase_voucher_lines l
        INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
        INNER JOIN accounts a ON l.account_id = a.account_id
        WHERE v.company_id = ?
          AND a.account_code = ?
          AND v.client_id = ?
          AND v.voucher_date <= ?
          AND v.is_active = TRUE
        `,
        [companyId, accountCode, client.client_id, previousEndDate, companyId, accountCode, client.client_id, previousEndDate]
      );

      const prevDebit = prevRows.reduce((sum, row) => sum + (Number(row.prev_debit) || 0), 0);
      const prevCredit = prevRows.reduce((sum, row) => sum + (Number(row.prev_credit) || 0), 0);

      client.previous_balance = prevDebit - prevCredit;
      client.balance = client.previous_balance + (Number(client.debit_total) || 0) - (Number(client.credit_total) || 0);
    }

    return { success: true, summary: rows };
  } catch (error) {
    console.error('거래처별 원장 요약 조회 실패:', error);
    throw error;
  }
}

// 거래처별 원장 상세 조회
async function getClientLedgerDetail(companyId, filters) {
  const { startMonth, startDay, endMonth, endDay, accountCode, clientId } = filters;

  // 날짜 범위 계산
  const dateRange = parseDateRange(
    startMonth || 1,
    startDay,
    endMonth || 12,
    endDay
  );

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

    // 전기이월 계산
    const previousEnd = new Date(dateRange.start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousEndDate = previousEnd.toISOString().split('T')[0];

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
        AND v.voucher_date <= ?

      UNION ALL

      SELECT
        SUM(CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END) as prev_debit,
        SUM(CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END) as prev_credit
      FROM sales_purchase_voucher_lines l
      INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
      INNER JOIN accounts a ON l.account_id = a.account_id
      WHERE v.company_id = ?
        AND a.account_code = ?
        AND v.client_id = ?
        AND v.voucher_date <= ?
        AND v.is_active = TRUE
      `,
      [companyId, accountCode, clientId, previousEndDate, companyId, accountCode, clientId, previousEndDate]
    );

    const prevDebit = prevRows.reduce((sum, row) => sum + (Number(row.prev_debit) || 0), 0);
    const prevCredit = prevRows.reduce((sum, row) => sum + (Number(row.prev_credit) || 0), 0);
    const previousBalance = prevDebit - prevCredit;

    // 전기이월 행 추가 (잔액이 0이 아닌 경우만)
    const ledgerData = [];
    if (previousBalance !== 0) {
      ledgerData.push({
        month: '',
        day: '',
        voucher_type: '전기이월',
        voucher_no: '',
        debit_amount: previousBalance > 0 ? previousBalance : 0,
        credit_amount: previousBalance < 0 ? -previousBalance : 0,
        balance: previousBalance,
        description: '전기이월'
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
