const voucherModel = require('../models/voucherModel');
const companyModel = require('../models/companyModel');

// 전표 라인 조회 (날짜 범위)
async function getVoucherLinesByDate(userId, companyId, startDate, endDate) {
  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const hasAccess = userCompanies.some(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!hasAccess) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  const lines = await voucherModel.findAllVoucherLinesByDate(
    companyId,
    startDate,
    endDate
  );

  return { lines };
}

// 전표 라인 생성
async function createVoucherLine(userId, lineData) {
  const { companyId } = lineData;

  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole || !['ADMIN', 'ACCOUNTANT'].includes(userRole.role)) {
    throw new Error('전표 작성 권한이 없습니다');
  }

  let voucherId = lineData.voucherId;
  
  if (!voucherId) {
    const voucherNo = await voucherModel.getNextVoucherNo(
      companyId,
      lineData.voucherDate
    );

    voucherId = await voucherModel.createVoucher({
      companyId,
      voucherDate: lineData.voucherDate,
      voucherNo,
      description: lineData.voucherDescription || '',
      totalDebit: 0,
      totalCredit: 0,
      status: '확정',
      createdBy: userId
    });
  }

  const existingLines = await voucherModel.findVoucherLinesByVoucher(voucherId);
  const lineNo = existingLines.length + 1;

  // 차변/대변 금액 계산
  let debitAmount = 0;
  let creditAmount = 0;

  if (['3', '5'].includes(lineData.voucherType)) {
    // 차변(3), 결차(5)
    debitAmount = lineData.amount || 0;
  } else {
    // 대변(4), 결대(6)
    creditAmount = lineData.amount || 0;
  }

  const lineId = await voucherModel.createVoucherLine({
    voucherId,
    lineNo,
    voucherType: lineData.voucherType,
    amount: lineData.amount || 0,
    descriptionCode: lineData.descriptionCode || null,
    accountId: lineData.accountId,
    clientId: lineData.clientId || null,
    debitAmount,
    creditAmount,
    description: lineData.description || '',
    departmentCode: lineData.departmentCode || null,
    projectCode: lineData.projectCode || null
  });

  await updateVoucherTotalsById(voucherId);

  return { lineId, voucherId };
}

// 전표 라인 수정
async function updateVoucherLine(userId, lineId, lineData) {
  const lines = await voucherModel.findAllVoucherLinesByDate(
    lineData.companyId,
    '1900-01-01',
    '2999-12-31'
  );
  
  const line = lines.find(l => l.line_id === lineId);
  if (!line) {
    throw new Error('존재하지 않는 전표 라인입니다');
  }

  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === lineData.companyId && c.status === 'APPROVED'
  );

  if (!userRole || !['ADMIN', 'ACCOUNTANT'].includes(userRole.role)) {
    throw new Error('전표 수정 권한이 없습니다');
  }

  let debitAmount = 0;
  let creditAmount = 0;

  if (['3', '5'].includes(lineData.voucherType)) {
    // 차변(3), 결차(5)
    debitAmount = lineData.amount || 0;
  } else {
    // 대변(4), 결대(6)
    creditAmount = lineData.amount || 0;
  }

  await voucherModel.updateVoucherLine(lineId, {
    voucherType: lineData.voucherType,
    amount: lineData.amount || 0,
    descriptionCode: lineData.descriptionCode || null,
    accountId: lineData.accountId,
    clientId: lineData.clientId || null,
    debitAmount,
    creditAmount,
    description: lineData.description || '',
    departmentCode: lineData.departmentCode || null,
    projectCode: lineData.projectCode || null
  });

  await updateVoucherTotalsById(line.voucher_id);

  return { message: '전표 라인이 수정되었습니다' };
}

// 전표 라인 삭제
async function deleteVoucherLine(userId, lineId, companyId) {
  // 권한 확인 (ADMIN 또는 ACCOUNTANT)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole || !['ADMIN', 'ACCOUNTANT'].includes(userRole.role)) {
    throw new Error('전표 삭제 권한이 없습니다');
  }

  const lines = await voucherModel.findAllVoucherLinesByDate(
    companyId,
    '1900-01-01',
    '2999-12-31'
  );
  
  const line = lines.find(l => l.line_id === lineId);
  if (!line) {
    throw new Error('존재하지 않는 전표 라인입니다');
  }

  const voucherId = line.voucher_id;

  await voucherModel.deleteVoucherLine(lineId);

  // 남은 라인 확인
  const remainingLines = await voucherModel.findVoucherLinesByVoucher(voucherId);
  
  if (remainingLines.length === 0) {
    // 라인이 없으면 전표 헤더도 삭제
    await voucherModel.deleteVoucher(voucherId);
  } else {
    // 전표 합계 업데이트
    await updateVoucherTotalsById(voucherId);
  }

  return { message: '전표 라인이 삭제되었습니다' };
}

// 전표 합계 업데이트 (내부 함수)
async function updateVoucherTotalsById(voucherId) {
  const lines = await voucherModel.findVoucherLinesByVoucher(voucherId);
  
  const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);

  await voucherModel.updateVoucherTotals(voucherId, totalDebit, totalCredit);
}

// 여러 라인을 한 번에 저장하는 전표 생성
async function createVoucherWithLines(userId, voucherData) {
  const { companyId, voucherDate, voucherNo, lines } = voucherData;

  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole || !['ADMIN', 'ACCOUNTANT'].includes(userRole.role)) {
    throw new Error('전표 작성 권한이 없습니다');
  }

  // 차대변 합계 검증
  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach(line => {
    if (['3', '5'].includes(line.voucherType)) {
      // 차변(3), 결차(5)
      totalDebit += parseFloat(line.amount || 0);
    } else {
      // 대변(4), 결대(6)
      totalCredit += parseFloat(line.amount || 0);
    }
  });

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('차대변 합계가 일치하지 않습니다');
  }

  // 전표번호 결정 (수동 입력 또는 자동 생성)
  let finalVoucherNo = voucherNo;
  if (!finalVoucherNo) {
    finalVoucherNo = await voucherModel.getNextVoucherNo(companyId, voucherDate);
  }

  // 전표 헤더 생성
  const voucherId = await voucherModel.createVoucher({
    companyId,
    voucherDate,
    voucherNo: finalVoucherNo,
    description: voucherData.description || '',
    totalDebit,
    totalCredit,
    status: '확정',
    createdBy: userId
  });

  // 전표 라인들 생성
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    let debitAmount = 0;
    let creditAmount = 0;

    if (['3', '5'].includes(line.voucherType)) {
      // 차변(3), 결차(5)
      debitAmount = parseFloat(line.amount || 0);
    } else {
      // 대변(4), 결대(6)
      creditAmount = parseFloat(line.amount || 0);
    }

    await voucherModel.createVoucherLine({
      voucherId,
      lineNo,
      voucherType: line.voucherType,
      amount: parseFloat(line.amount || 0),
      descriptionCode: line.descriptionCode || null,
      accountId: line.accountId,
      clientId: line.clientId || null,
      debitAmount,
      creditAmount,
      description: line.description || '',
      departmentCode: line.departmentCode || null,
      projectCode: line.projectCode || null
    });
  }

  return { voucherId, voucherNo: finalVoucherNo };
}

// 전표 전체 수정 (여러 라인)
async function updateVoucherWithLines(userId, voucherId, voucherData) {
  const { companyId, lines } = voucherData;

  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole || !['ADMIN', 'ACCOUNTANT'].includes(userRole.role)) {
    throw new Error('전표 수정 권한이 없습니다');
  }

  // 전표 존재 확인
  const voucher = await voucherModel.findVoucherById(voucherId);
  if (!voucher) {
    throw new Error('존재하지 않는 전표입니다');
  }

  // 차대변 합계 검증
  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach(line => {
    if (['3', '5'].includes(line.voucherType)) {
      // 차변(3), 결차(5)
      totalDebit += parseFloat(line.amount || 0);
    } else {
      // 대변(4), 결대(6)
      totalCredit += parseFloat(line.amount || 0);
    }
  });

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('차대변 합계가 일치하지 않습니다');
  }

  // 기존 라인 모두 삭제
  const existingLines = await voucherModel.findVoucherLinesByVoucher(voucherId);
  for (const line of existingLines) {
    await voucherModel.deleteVoucherLine(line.line_id);
  }

  // 새 라인들 생성
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    let debitAmount = 0;
    let creditAmount = 0;

    if (['3', '5'].includes(line.voucherType)) {
      // 차변(3), 결차(5)
      debitAmount = parseFloat(line.amount || 0);
    } else {
      // 대변(4), 결대(6)
      creditAmount = parseFloat(line.amount || 0);
    }

    await voucherModel.createVoucherLine({
      voucherId,
      lineNo,
      voucherType: line.voucherType,
      amount: parseFloat(line.amount || 0),
      descriptionCode: line.descriptionCode || null,
      accountId: line.accountId,
      clientId: line.clientId || null,
      debitAmount,
      creditAmount,
      description: line.description || '',
      departmentCode: line.departmentCode || null,
      projectCode: line.projectCode || null
    });
  }

  // 전표 합계 업데이트
  await voucherModel.updateVoucherTotals(voucherId, totalDebit, totalCredit);

  return { message: '전표가 수정되었습니다', voucherId };
}

module.exports = {
  getVoucherLinesByDate,
  createVoucherLine,
  updateVoucherLine,
  deleteVoucherLine,
  createVoucherWithLines,
  updateVoucherWithLines
};