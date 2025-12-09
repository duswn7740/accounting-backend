const accountModel = require('../models/accountModel');
const companyModel = require('../models/companyModel');

// 회사별 계정과목 조회
async function getAccountsByCompany(userId, companyId) {
  // 1. 권한 확인 (해당 회사 소속인지)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );
  
  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }
  
  // 2. 계정과목 조회
  const accounts = await accountModel.findAccountsByCompany(companyId);
  
  return accounts;
}

// 계정과목 추가
async function createAccount(userId, accountData) {
  // 1. 권한 확인 (ADMIN만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === accountData.companyId && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ADMIN') {
    throw new Error('계정과목 추가 권한이 없습니다');
  }
  
  // 2. 계정코드 중복 확인
  const isDuplicated = await accountModel.checkAccountCode(
    accountData.companyId, 
    accountData.accountCode
  );
  
  if (isDuplicated) {
    throw new Error('이미 사용 중인 계정코드입니다');
  }
  
  // 3. 계정과목 추가
  const accountId = await accountModel.createAccount(accountData);
  
  return {
    message: '계정과목이 추가되었습니다',
    accountId
  };
}

// 계정과목 수정
async function updateAccount(userId, accountId, accountData) {
  // 1. 계정과목 조회
  const account = await accountModel.findAccountById(accountId);
  
  if (!account) {
    throw new Error('존재하지 않는 계정과목입니다');
  }
  
  // 2. 권한 확인 (ADMIN만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === account.company_id && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ADMIN') {
    throw new Error('계정과목 수정 권한이 없습니다');
  }

  // 3. 계정과목 수정 (시스템 계정도 수정 가능)
  await accountModel.updateAccount(accountId, accountData);
  
  return {
    message: '계정과목이 수정되었습니다'
  };
}

// 계정과목 삭제
async function deleteAccount(userId, accountId) {
  // 1. 계정과목 조회
  const account = await accountModel.findAccountById(accountId);
  
  if (!account) {
    throw new Error('존재하지 않는 계정과목입니다');
  }
  
  // 2. 권한 확인 (ADMIN만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === account.company_id && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ADMIN') {
    throw new Error('계정과목 삭제 권한이 없습니다');
  }
  
  // 3. 계정과목 삭제 (시스템 계정도 삭제 가능)
  await accountModel.deleteAccount(accountId);
  
  return {
    message: '계정과목이 삭제되었습니다'
  };
}

module.exports = {
  getAccountsByCompany,
  createAccount,
  updateAccount,
  deleteAccount
};