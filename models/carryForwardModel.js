const db = require('../config/database');
const queries = require('../queries/carryForwardQueries');

// 계정별 이월잔액 조회
async function getAccountCarryForward(companyId, fiscalYear, accountId) {
  const [rows] = await db.query(
    queries.GET_ACCOUNT_CARRY_FORWARD,
    [companyId, fiscalYear, accountId]
  );
  return rows[0];
}

// 거래처별 이월잔액 조회
async function getClientCarryForward(companyId, fiscalYear, clientId) {
  const [rows] = await db.query(
    queries.GET_CLIENT_CARRY_FORWARD,
    [companyId, fiscalYear, clientId]
  );
  return rows;
}

// 특정 계정+거래처 이월잔액 조회
async function getAccountClientCarryForward(companyId, fiscalYear, accountId, clientId) {
  const [rows] = await db.query(
    queries.GET_ACCOUNT_CLIENT_CARRY_FORWARD,
    [companyId, fiscalYear, accountId, clientId]
  );
  return rows[0];
}

// 이월잔액 생성
async function createCarryForward(carryForwardData) {
  const {
    companyId,
    fiscalYear,
    accountId,
    clientId,
    debitBalance,
    creditBalance
  } = carryForwardData;

  const [result] = await db.query(
    queries.CREATE_CARRY_FORWARD,
    [companyId, fiscalYear, accountId, clientId, debitBalance, creditBalance]
  );

  return result.insertId;
}

// 이월잔액 수정
async function updateCarryForward(balanceId, debitBalance, creditBalance) {
  await db.query(
    queries.UPDATE_CARRY_FORWARD,
    [debitBalance, creditBalance, balanceId]
  );
}

// 이월잔액 삭제
async function deleteCarryForward(balanceId) {
  await db.query(queries.DELETE_CARRY_FORWARD, [balanceId]);
}

// 회계기수별 모든 이월잔액 조회 (계정별)
async function getAllAccountCarryForwards(companyId, fiscalYear) {
  const [rows] = await db.query(
    queries.GET_ALL_ACCOUNT_CARRY_FORWARDS,
    [companyId, fiscalYear]
  );
  return rows;
}

// 회계기수별 모든 이월잔액 조회 (거래처별)
async function getAllClientCarryForwards(companyId, fiscalYear) {
  const [rows] = await db.query(
    queries.GET_ALL_CLIENT_CARRY_FORWARDS,
    [companyId, fiscalYear]
  );
  return rows;
}

module.exports = {
  getAccountCarryForward,
  getClientCarryForward,
  getAccountClientCarryForward,
  createCarryForward,
  updateCarryForward,
  deleteCarryForward,
  getAllAccountCarryForwards,
  getAllClientCarryForwards
};
