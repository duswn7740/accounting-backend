const companyModel = require('../models/companyModel');
const db = require('../config/database');
const queries = require('../queries/companyQueries');

// 회사 등록 (사업주)
async function registerCompany(userId, companyData) {
  const { businessNumber, companyName, ceoName, address, tel, industry, fiscalYearEnd } = companyData;
  
  // 1. 유효성 검사
  if (!businessNumber || !companyName) {
    throw new Error('사업자번호와 상호는 필수입니다');
  }
  
  // 사업자번호 숫자만 (10자리)
  const cleanBusinessNumber = businessNumber.replace(/\D/g, '');
  if (cleanBusinessNumber.length !== 10) {
    throw new Error('사업자번호는 10자리여야 합니다');
  }
  
  // 2. 중복 체크
  const [existing] = await db.query(queries.FIND_BY_BUSINESS_NUMBER, [cleanBusinessNumber]);
  if (existing.length > 0) {
    throw new Error('이미 등록된 사업자번호입니다');
  }
  
  // 3. 회사 생성
  const newCompany = await companyModel.createCompany(
    cleanBusinessNumber,
    companyName,
    ceoName,
    address,
    tel,
    industry,
    fiscalYearEnd || '12-31'
  );
  
  // 4. company_users 연결 (ADMIN, APPROVED)
  await companyModel.createCompanyUser(
    newCompany.companyId,
    userId,
    'ADMIN',
    'APPROVED'
  );
  
  return newCompany;
}

// 회사 검색 (일반 회원)
async function searchCompanies(keyword) {
  if (!keyword || keyword.trim().length < 2) {
    throw new Error('검색어는 2자 이상 입력해주세요');
  }
  return await companyModel.searchCompanies(keyword.trim());
}

// 회사 가입 신청 (일반 회원)
async function applyToCompany(userId, companyId) {
  // 1. 회사 존재 확인
  const company = await companyModel.findById(companyId);
  
  if (!company) {
    throw new Error('존재하지 않는 회사입니다');
  }
  
  // 2. 이미 신청했거나 소속되어 있는지 확인
  const existing = await companyModel.findUserCompanyRelation(userId, companyId);
  
  if (existing) {
    const status = existing.status;
    if (status === 'PENDING') {
      throw new Error('이미 가입 신청한 회사입니다');
    } else if (status === 'APPROVED') {
      throw new Error('이미 소속된 회사입니다');
    } else if (status === 'REJECTED') {
      throw new Error('가입이 거절된 회사입니다. 관리자에게 문의하세요');
    }
  }
  
  // 3. 가입 신청 (PENDING 상태)
  await companyModel.createCompanyUser(companyId,userId,'ACCOUNTANT','PENDING');
  
  return {
    message: '가입 신청이 완료되었습니다. 승인을 기다려주세요.'
  };
}

// 사업자번호 중복 체크
async function checkBusinessNumber(businessNumber) {
  const cleanBusinessNumber = businessNumber.replace(/\D/g, '');
  
  if (cleanBusinessNumber.length !== 10) {
    throw new Error('사업자번호는 10자리여야 합니다');
  }
  
  const existing = await companyModel.findByBusinessNumber(cleanBusinessNumber);
  
  return !existing; // true = 사용 가능, false = 중복
}

// 사용자의 모든 회사 목록 조회
async function getUserCompanies(userId) {
  const companies = await companyModel.findAllUserCompanies(userId);
  return companies;
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

// 회사의 가입 신청 목록 조회
async function getPendingRequests(userId, companyId) {
  // 1. 요청한 사람이 해당 회사의 ADMIN인지 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const isAdmin = userCompanies.some(
    c => c.companyId === companyId && c.role === 'ADMIN' && c.status === 'APPROVED'
  );
  
  if (!isAdmin) {
    throw new Error('권한이 없습니다');
  }
  
  // 2. 가입 신청 목록 조회
  const requests = await companyModel.findPendingRequests(companyId);
  return requests;
}

// 가입 신청 승인/거절
async function handleRequest(userId, companyUserId, action) {
  // action: 'approve' 또는 'reject'
  
  if (!['approve', 'reject'].includes(action)) {
    throw new Error('잘못된 요청입니다');
  }
  
  // 1. company_user_id로 회사 정보 가져오기
  const [rows] = await db.query(
    'SELECT company_id FROM company_users WHERE company_user_id = ?',
    [companyUserId]
  );
  
  if (rows.length === 0) {
    throw new Error('존재하지 않는 신청입니다');
  }
  
  const companyId = rows[0].company_id;
  
  // 2. 요청한 사람이 해당 회사의 ADMIN인지 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const isAdmin = userCompanies.some(
    c => c.companyId === companyId && c.role === 'ADMIN' && c.status === 'APPROVED'
  );
  
  if (!isAdmin) {
    throw new Error('권한이 없습니다');
  }
  
  // 3. 승인/거절 처리
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  await companyModel.updateRequestStatus(companyUserId, status, userId);
  
  return {
    message: action === 'approve' ? '승인되었습니다' : '거절되었습니다'
  };
}

// 승인된 직원 목록 조회
async function getApprovedEmployees(userId, companyId) {
  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const isAdmin = userCompanies.some(
    c => c.companyId === companyId && c.role === 'ADMIN' && c.status === 'APPROVED'
  );
  
  if (!isAdmin) {
    throw new Error('권한이 없습니다');
  }
  
  const employees = await companyModel.findApprovedEmployees(companyId);
  return employees;
}

// 거절/퇴사 목록 조회
async function getRejectedEmployees(userId, companyId) {
  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const isAdmin = userCompanies.some(
    c => c.companyId === companyId && c.role === 'ADMIN' && c.status === 'APPROVED'
  );
  
  if (!isAdmin) {
    throw new Error('권한이 없습니다');
  }
  
  const employees = await companyModel.findRejectedEmployees(companyId);
  return employees;
}

// 직원 역할 변경
async function updateEmployeeRole(userId, companyUserId, newRole) {
  // 1. 유효한 역할인지 확인
  const validRoles = ['ACCOUNTANT', 'VIEWER'];
  if (!validRoles.includes(newRole)) {
    throw new Error('유효하지 않은 역할입니다');
  }
  
  // 2. company_user_id로 회사 정보 가져오기
  const [rows] = await db.query(
    'SELECT company_id, user_id, role FROM company_users WHERE company_user_id = ?',
    [companyUserId]
  );
  
  if (rows.length === 0) {
    throw new Error('존재하지 않는 직원입니다');
  }
  
  const { company_id: companyId, user_id: targetUserId, role: currentRole } = rows[0];
  
  // 3. ADMIN은 역할 변경 불가
  if (currentRole === 'ADMIN') {
    throw new Error('관리자의 역할은 변경할 수 없습니다');
  }
  
  // 4. 요청한 사람이 해당 회사의 ADMIN인지 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const isAdmin = userCompanies.some(
    c => c.companyId === companyId && c.role === 'ADMIN' && c.status === 'APPROVED'
  );
  
  if (!isAdmin) {
    throw new Error('권한이 없습니다');
  }
  
  // 5. 역할 변경
  await companyModel.updateEmployeeRole(companyUserId, newRole);
  
  return {
    message: '역할이 변경되었습니다'
  };
}

// 회사 정보 조회
async function getCompanyById(userId, companyId) {
  // 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const hasAccess = userCompanies.some(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );
  
  if (!hasAccess) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }
  
  // 회사 정보 조회
  const company = await companyModel.findById(companyId);
  
  if (!company) {
    throw new Error('존재하지 않는 회사입니다');
  }
  
  return {
    companyId: company.company_id,
    companyName: company.company_name,
    businessNumber: company.business_number,
    ceoName: company.ceo_name
  };
}

module.exports = {
  registerCompany,
  searchCompanies,
  applyToCompany,
  checkBusinessNumber,
  getUserCompanies,
  getPendingRequests,
  handleRequest,
  getApprovedEmployees,
  getRejectedEmployees,
  updateEmployeeRole,
  getCompanyById
};