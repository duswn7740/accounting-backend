const salesPurchaseModel = require('../models/salesPurchaseModel');
const companyModel = require('../models/companyModel');

// 매입매출 전표 등록
async function createVoucher(userId, voucherData, lines) {
  // 1. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === voucherData.companyId && c.status === 'APPROVED'
  );

  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('전표 등록 권한이 없습니다');
  }

  // 2. 차대변 검증
  const debitTotal = lines
    .filter(l => l.debitCredit === '차변')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  const creditTotal = lines
    .filter(l => l.debitCredit === '대변')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error('차변과 대변 합계가 일치하지 않습니다');
  }

  // 3. 전표 등록
  const result = await salesPurchaseModel.createVoucher({
    ...voucherData,
    createdBy: userId
  }, lines);

  return {
    message: '매입매출 전표가 등록되었습니다',
    ...result
  };
}

// 회사별 전표 조회
async function getVouchersByCompany(userId, companyId) {
  // 1. 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  // 2. 전표 조회
  const vouchers = await salesPurchaseModel.findVouchersByCompany(companyId);

  return { vouchers };
}

// 기간별 전표 조회
async function getVouchersByDateRange(userId, companyId, startDate, endDate) {
  // 1. 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  // 2. 전표 조회
  const vouchers = await salesPurchaseModel.findVouchersByDateRange(companyId, startDate, endDate);

  return { vouchers };
}

// 전표 상세 조회
async function getVoucherById(userId, voucherId) {
  // 1. 전표 조회
  const voucher = await salesPurchaseModel.findVoucherById(voucherId);

  if (!voucher) {
    throw new Error('존재하지 않는 전표입니다');
  }

  // 2. 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === voucher.company_id && c.status === 'APPROVED'
  );

  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  return { voucher };
}

// 전표 수정
async function updateVoucher(userId, voucherId, voucherData, lines) {
  // 1. 전표 조회
  const voucher = await salesPurchaseModel.findVoucherById(voucherId);

  if (!voucher) {
    throw new Error('존재하지 않는 전표입니다');
  }

  // 2. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === voucher.company_id && c.status === 'APPROVED'
  );

  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('전표 수정 권한이 없습니다');
  }

  // 3. 차대변 검증
  const debitTotal = lines
    .filter(l => l.debitCredit === '차변')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  const creditTotal = lines
    .filter(l => l.debitCredit === '대변')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error('차변과 대변 합계가 일치하지 않습니다');
  }

  // 4. 전표 수정
  await salesPurchaseModel.updateVoucher(voucherId, voucherData, lines);

  return {
    message: '전표가 수정되었습니다'
  };
}

// 전표 삭제
async function deleteVoucher(userId, voucherId) {
  // 1. 전표 조회
  const voucher = await salesPurchaseModel.findVoucherById(voucherId);

  if (!voucher) {
    throw new Error('존재하지 않는 전표입니다');
  }

  // 2. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === voucher.company_id && c.status === 'APPROVED'
  );

  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('전표 삭제 권한이 없습니다');
  }

  // 3. 전표 삭제
  await salesPurchaseModel.deleteVoucher(voucherId);

  return {
    message: '전표가 삭제되었습니다'
  };
}

module.exports = {
  createVoucher,
  getVouchersByCompany,
  getVouchersByDateRange,
  getVoucherById,
  updateVoucher,
  deleteVoucher
};
