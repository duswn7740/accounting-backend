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
    [voucherType, amount, descriptionCode,
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

// 전표번호 자동생성
async function getNextVoucherNo(companyId, voucherDate) {
  const year = voucherDate.substring(0, 4);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const [rows] = await db.query(
    queries.GET_MAX_VOUCHER_NO,
    [companyId, startDate, endDate]
  );

  const maxNo = rows[0].max_no || 0;
  const nextNo = String(maxNo + 1).padStart(3, '0');
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
  createVoucher,
  createVoucherLine,
  updateVoucherLine,
  deleteVoucherLine,
  updateVoucherTotals,
  deleteVoucher,
  getNextVoucherNo,
  findVoucherById
};