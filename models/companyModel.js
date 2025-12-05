const db = require('../config/database');
const queries = require('../queries/companyQueries');

// 사용자의 승인된 회사 목록 조회
async function findUserCompanies(userId) {
  const [rows] = await db.query(queries.FIND_USER_COMPANIES, [userId]);
  return rows;
}

// 회사 등록하기
const createCompany = async (businessNumber, companyName, ceoName, address, tel, industry, fiscalYearEnd, ) => {
  const [result] = await db.query(queries.CREATE_COMPANY, [
    businessNumber,
    companyName,
    ceoName,
    address,
    tel,
    industry,
    fiscalYearEnd
  ]);
  return {
    companyId : result.insertId,
    businessNumber,
    companyName,
    ceoName,
    address,
    tel,
    industry,
    fiscalYearEnd
  };
}

// 사업자번호로 회사 찾기
async function findByBusinessNumber(businessNumber) {
  const [rows] = await db.query(queries.FIND_BY_BUSINESS_NUMBER, [businessNumber]);
  return rows[0];
}

// 회사 검색
async function searchCompanies(keyword) {
  const searchKeyword = `%${keyword}%`;
  const [rows] = await db.query(queries.SEARCH_COMPANIES, [searchKeyword, searchKeyword]);
  
  return rows.map(row => ({
    companyId: row.company_id,
    companyName: row.company_name,
    businessNumber: row.business_number,
    ceoName: row.ceo_name
  }));
}

  // 회사 존재 확인
async function findById(companyId) {
  const [rows] = await db.query(
    'SELECT company_id, company_name FROM companies WHERE company_id = ?',
    [companyId]
  );
  return rows[0];
}

// 회사-유저 연결 생성
async function createCompanyUser(companyId, userId, role, status) {
  await db.query(queries.CREATE_COMPANY_USER, [companyId, userId, role, status]);
}

// 회사-유저 연결 확인
async function findUserCompanyRelation(userId, companyId) {
  const [rows] = await db.query(queries.CHECK_USER_COMPANY_REQUEST, [userId, companyId]);
  return rows[0];
}

// 사용자의 모든 회사 목록 조회
async function findAllUserCompanies(userId) {
  const [rows] = await db.query(queries.FIND_ALL_USER_COMPANIES, [userId]);
  
  return rows.map(row => ({
    companyUserId: row.company_user_id,
    companyId: row.company_id,
    role: row.role,
    status: row.status,
    approvedAt: row.approved_at,
    companyName: row.company_name,
    businessNumber: row.business_number,
    ceoName: row.ceo_name
  }));
}

// 회사의 가입 신청 목록 조회
async function findPendingRequests(companyId) {
  const [rows] = await db.query(queries.FIND_PENDING_REQUESTS, [companyId]);
  
  return rows.map(row => ({
    companyUserId: row.company_user_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
    name: row.name,
    email: row.email,
    phone: row.phone
  }));
}

// 가입 신청 승인/거절
async function updateRequestStatus(companyUserId, status, approvedBy) {
  await db.query(queries.UPDATE_REQUEST_STATUS, [status, approvedBy, companyUserId]);
}

// 승인된 직원 목록 조회
async function findApprovedEmployees(companyId) {
  const [rows] = await db.query(queries.FIND_APPROVED_EMPLOYEES, [companyId]);
  
  return rows.map(row => ({
    companyUserId: row.company_user_id,
    userId: row.user_id,
    role: row.role,
    approvedAt: row.approved_at,
    name: row.name,
    email: row.email,
    phone: row.phone
  }));
}

// 거절/퇴사 목록 조회
async function findRejectedEmployees(companyId) {
  const [rows] = await db.query(queries.FIND_REJECTED_EMPLOYEES, [companyId]);
  
  return rows.map(row => ({
    companyUserId: row.company_user_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
    approvedAt: row.approved_at,
    name: row.name,
    email: row.email,
    phone: row.phone
  }));
}


module.exports = {
  findUserCompanies,
  createCompany,
  findByBusinessNumber,
  searchCompanies,      
  findById,
  createCompanyUser,
  findUserCompanyRelation,
  findAllUserCompanies,
  findPendingRequests,
  updateRequestStatus,
  findApprovedEmployees,
  findRejectedEmployees
};

