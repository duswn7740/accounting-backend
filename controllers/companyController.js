const companyService = require('../services/companyService');

// 회사 등록 (사업주)
async function register(req, res) {
  try {
    // authMiddleware에서 넣어준 userId
    const userId = req.user.userId;
    
    // 회사 정보
    const companyData = req.body;
    
    const newCompany = await companyService.registerCompany(userId, companyData);
    
    res.status(201).json({
      message: '회사 등록 성공',
      company: newCompany
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 회사 검색 (일반 회원)
async function search(req, res) {
  try {
    const { keyword } = req.query;  // ?keyword=홍길동
    
    const companies = await companyService.searchCompanies(keyword);
    
    res.status(200).json({
      companies
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 회사 가입 신청 (일반 회원)
async function apply(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId } = req.body;
    
    const result = await companyService.applyToCompany(userId, companyId);
    
    res.status(201).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 사업자번호 중복 체크
async function checkBusinessNumber(req, res) {
  try {
    const { businessNumber } = req.body;
    
    const isAvailable = await companyService.checkBusinessNumber(businessNumber);
    
    res.status(200).json({
      available: isAvailable,
      message: isAvailable ? '사용 가능한 사업자번호입니다' : '이미 등록된 사업자번호입니다'
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 사용자의 모든 회사 목록 조회
async function getUserCompanies(req, res) {
  try {
    const userId = req.user.userId;
    
    const companies = await companyService.getUserCompanies(userId);
    
    res.status(200).json({
      companies
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 회사의 가입 신청 목록 조회
async function getPendingRequests(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId } = req.params;
    
    const requests = await companyService.getPendingRequests(userId, parseInt(companyId));
    
    res.status(200).json({
      requests
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 가입 신청 승인/거절
async function handleRequest(req, res) {
  try {
    const userId = req.user.userId;
    const { companyUserId, action } = req.body;
    
    const result = await companyService.handleRequest(userId, companyUserId, action);
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 승인된 직원 목록 조회
async function getApprovedEmployees(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId } = req.params;
    
    console.log('승인된 직원 조회:', {userId, companyId});

    const employees = await companyService.getApprovedEmployees(userId, parseInt(companyId));
    
    console.log('조회결과:', employees);

    res.status(200).json({
      employees
    });
    
  } catch (error) {
    console.error('에러'. error.message);
    res.status(400).json({
      error: error.message
    });
  }
}

// 거절/퇴사 목록 조회
async function getRejectedEmployees(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId } = req.params;
    
    const employees = await companyService.getRejectedEmployees(userId, parseInt(companyId));
    
    res.status(200).json({
      employees
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

module.exports = {
  register,
  search,
  apply,
  checkBusinessNumber,
  getUserCompanies,
  getPendingRequests,
  handleRequest,
  getApprovedEmployees,
  getRejectedEmployees
};