const db = require('../config/database');
const queries = require('../queries/accountQueries');

// 회사별 계정과목 조회
async function findAccountsByCompany(companyId) {
  const [rows] = await db.query(queries.FIND_ACCOUNTS_BY_COMPANY, [companyId]);
  return rows;
}

// 계정과목 상세 조회
async function findAccountById(accountId) {
  const [rows] = await db.query(queries.FIND_ACCOUNT_BY_ID, [accountId]);
  return rows[0];
}

// 계정과목 추가
async function createAccount(accountData) {
  const [result] = await db.query(queries.CREATE_ACCOUNT, [
    accountData.companyId,
    accountData.accountCode,
    accountData.accountName,
    accountData.accountType,
    accountData.accountCategory,
    accountData.isDebitNormal,
    accountData.isSystem || false,
    accountData.description
  ]);
  
  return result.insertId;
}

// 계정과목 수정
async function updateAccount(accountId, accountData) {
  await db.query(queries.UPDATE_ACCOUNT, [
    accountData.accountName,
    accountData.accountType,
    accountData.accountCategory,
    accountData.isDebitNormal,
    accountData.description,
    accountId
  ]);
}

// 계정과목 삭제 (비활성화)
async function deleteAccount(accountId) {
  await db.query(queries.DELETE_ACCOUNT, [accountId]);
}

// 계정코드 중복 확인
async function checkAccountCode(companyId, accountCode) {
  const [rows] = await db.query(queries.CHECK_ACCOUNT_CODE, [companyId, accountCode]);
  return rows.length > 0;
}

// 시스템 기본 계정과목 복사
async function copySystemAccounts(companyId) {
  await db.query(queries.COPY_SYSTEM_ACCOUNTS, [companyId]);
}

module.exports = {
  findAccountsByCompany,
  findAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  checkAccountCode,
  copySystemAccounts
};