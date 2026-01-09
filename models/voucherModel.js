const db = require('../config/database');
const queries = require('../queries/voucherQueries');

// 날짜 범위로 전표 조회
async function findVouchersByDateRange(companyId, startDate, endDate) {
  const [rows] = await db.query(
    queries.FIND_VOUCHERS_BY_DATE_RANGE,
    [companyId, startDate, endDate]
  );
  return rows;
}

// 전표 라인 조회
async function findVoucherLinesByVoucher(voucherId) {
  const [rows] = await db.query(
    queries.FIND_VOUCHER_LINES_BY_VOUCHER,
    [voucherId]
  );
  return rows;
}

// 날짜 범위로 전표 라인 전체 조회
async function findAllVoucherLinesByDate(companyId, startDate, endDate) {
  const [rows] = await db.query(
    queries.FIND_ALL_VOUCHER_LINES_BY_DATE,
    [companyId, startDate, endDate]
  );
  return rows;
}

// 회계기수별 전표 라인 전체 조회
async function findAllVoucherLinesByFiscalYear(companyId, fiscalYear) {
  const [rows] = await db.query(
    queries.FIND_ALL_VOUCHER_LINES_BY_FISCAL_YEAR,
    [companyId, fiscalYear]
  );
  return rows;
}

// 전표 헤더 생성
async function createVoucher(voucherData) {
  const {
    companyId, voucherDate, voucherNo, description,
    totalDebit, totalCredit, status, createdBy
  } = voucherData;

  const [result] = await db.query(
    queries.CREATE_VOUCHER,
    [companyId, voucherDate, voucherNo, description,
     totalDebit, totalCredit, status, createdBy]
  );

  return result.insertId;
}

// 전표 라인 생성
async function createVoucherLine(lineData) {
  const {
    voucherId, lineNo, voucherType, amount, descriptionCode,
    accountId, clientId, debitAmount, creditAmount, description,
    departmentCode, projectCode
  } = lineData;

  const [result] = await db.query(
    queries.CREATE_VOUCHER_LINE,
    [voucherId, lineNo, voucherType, amount, descriptionCode,
     accountId, clientId, debitAmount, creditAmount, description,
     departmentCode, projectCode]
  );

  return result.insertId;
}

// 전표 라인 수정
async function updateVoucherLine(lineId, lineData) {
  const {
    voucherType, amount, descriptionCode,
    accountId, clientId, debitAmount, creditAmount,
    description, departmentCode, projectCode
  } = lineData;

  await db.query(
    queries.UPDATE_VOUCHER_LINE,
    [amount, descriptionCode,
     accountId, clientId, debitAmount, creditAmount,
     description, departmentCode, projectCode, lineId]
  );
}
// 전표 라인 삭제
async function deleteVoucherLine(lineId) {
  await db.query(queries.DELETE_VOUCHER_LINE, [lineId]);
}

// 전표 합계 업데이트
async function updateVoucherTotals(voucherId, totalDebit, totalCredit) {
  await db.query(
    queries.UPDATE_VOUCHER_TOTALS,
    [totalDebit, totalCredit, voucherId]
  );
}

// 전표 삭제
async function deleteVoucher(voucherId) {
  await db.query(queries.DELETE_VOUCHER, [voucherId]);
}

// 전표번호 자동생성 (같은 날짜 내에서만 순차 생성)
// 형식: YYYYMMDD-001, YYYYMMDD-002, ...
async function getNextVoucherNo(companyId, voucherDate) {
  // voucherDate를 YYYY-MM-DD 형식으로 변환
  const dateStr = voucherDate.substring(0, 10);

  // 라인이 있는 전표만 카운트 (저장 실패한 빈 전표 제외)
  // ADDTIME으로 UTC에 9시간을 더해서 한국시간으로 변환 후 날짜 비교
  // SUBSTRING_INDEX로 하이픈 뒤의 숫자만 추출하여 MAX 계산
  const sql = 'SELECT MAX(CAST(SUBSTRING_INDEX(gv.voucher_no, \'-\', -1) AS UNSIGNED)) as max_no ' +
              'FROM general_vouchers gv ' +
              'INNER JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id ' +
              'WHERE gv.company_id = ? ' +
              'AND DATE(ADDTIME(gv.voucher_date, \'09:00:00\')) = ? ' +
              'AND gv.voucher_no LIKE ?';

  const [rows] = await db.query(sql, [companyId, dateStr, '%-___']);

  const maxNo = rows[0].max_no || 0;
  const seqNo = String(maxNo + 1).padStart(3, '0');

  // YYYYMMDD-001 형식으로 반환
  const datePart = dateStr.replace(/-/g, '');
  const nextNo = `${datePart}-${seqNo}`;

  return nextNo;
}

// 특정 전표 조회
async function findVoucherById(voucherId) {
  const [rows] = await db.query(queries.FIND_VOUCHER_BY_ID, [voucherId]);
  return rows[0];
}

module.exports = {
  findVouchersByDateRange,
  findVoucherLinesByVoucher,
  findAllVoucherLinesByDate,
  findAllVoucherLinesByFiscalYear,
  createVoucher,
  createVoucherLine,
  updateVoucherLine,
  deleteVoucherLine,
  updateVoucherTotals,
  deleteVoucher,
  getNextVoucherNo,
  findVoucherById
};