const db = require('../config/database');
const queries = require('../queries/salesPurchaseQueries');

// 전표번호 생성 (매출/매입 구분 없이 날짜별로 일련번호 부여)
async function generateVoucherNo(companyId, voucherDate) {
  const [rows] = await db.query(queries.GET_LAST_VOUCHER_NO, [companyId, voucherDate]);

  if (rows.length === 0) {
    // 해당 날짜에 첫 번째 전표
    return '001';
  }

  // 마지막 번호에서 1 증가
  const lastNo = rows[0].voucher_no;
  const lastSeq = parseInt(lastNo);
  const newSeq = String(lastSeq + 1).padStart(3, '0');

  return newSeq;
}

// 매입매출 전표 등록
async function createVoucher(voucherData, lines) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      companyId, voucherDate, voucherType, clientId,
      taxInvoiceYn, taxInvoiceNo, totalSupplyAmount,
      totalVatAmount, totalAmount, status, createdBy
    } = voucherData;

    // 전표번호 생성 (매출/매입 구분 없이)
    const voucherNo = await generateVoucherNo(companyId, voucherDate);

    // 헤더 등록
    const [result] = await connection.query(
      queries.CREATE_VOUCHER,
      [companyId, voucherDate, voucherType, voucherNo,
       clientId, taxInvoiceYn, taxInvoiceNo,
       totalSupplyAmount, totalVatAmount, totalAmount,
       status, createdBy]
    );

    const voucherId = result.insertId;

    // 라인 등록
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await connection.query(
        queries.CREATE_VOUCHER_LINE,
        [voucherId, i + 1, line.debitCredit, line.accountId,
         line.amount, line.description, line.descriptionCode,
         line.departmentCode, line.projectCode]
      );
    }

    await connection.commit();

    return { voucherId, voucherNo };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 회사별 전표 조회
async function findVouchersByCompany(companyId) {
  const [rows] = await db.query(queries.FIND_VOUCHERS_BY_COMPANY, [companyId]);
  return rows;
}

// 기간별 전표 조회
async function findVouchersByDateRange(companyId, startDate, endDate) {
  const [rows] = await db.query(queries.FIND_VOUCHERS_BY_DATE_RANGE, [companyId, startDate, endDate]);
  return rows;
}

// 전표 상세 조회
async function findVoucherById(voucherId) {
  const [headerRows] = await db.query(queries.FIND_VOUCHER_BY_ID, [voucherId]);

  if (headerRows.length === 0) {
    return null;
  }

  const [lineRows] = await db.query(queries.FIND_VOUCHER_LINES, [voucherId]);

  return {
    ...headerRows[0],
    lines: lineRows
  };
}

// 전표 수정
async function updateVoucher(voucherId, voucherData, lines) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      voucherDate, voucherType, clientId,
      taxInvoiceYn, taxInvoiceNo, totalSupplyAmount,
      totalVatAmount, totalAmount, status
    } = voucherData;

    // 헤더 수정
    await connection.query(
      queries.UPDATE_VOUCHER,
      [voucherDate, voucherType, clientId,
       taxInvoiceYn, taxInvoiceNo, totalSupplyAmount,
       totalVatAmount, totalAmount, status, voucherId]
    );

    // 기존 라인 삭제
    await connection.query(queries.DELETE_VOUCHER_LINES, [voucherId]);

    // 새 라인 등록
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await connection.query(
        queries.CREATE_VOUCHER_LINE,
        [voucherId, i + 1, line.debitCredit, line.accountId,
         line.amount, line.description, line.descriptionCode,
         line.departmentCode, line.projectCode]
      );
    }

    await connection.commit();

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 전표 삭제
async function deleteVoucher(voucherId) {
  await db.query(queries.DELETE_VOUCHER, [voucherId]);
}

module.exports = {
  createVoucher,
  findVouchersByCompany,
  findVouchersByDateRange,
  findVoucherById,
  updateVoucher,
  deleteVoucher
};
