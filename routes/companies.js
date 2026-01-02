const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/checkRole');

// 회사 등록 (사업주만)
router.post('/register', 
  authMiddleware,           // 1. 로그인 확인
  checkRole('BUSINESS'),    // 2. 사업주인지 확인
  companyController.register
);

// 사업자번호 중복 체크
router.post('/check-business-number',
  authMiddleware,
  checkRole('BUSINESS'),
  companyController.checkBusinessNumber
);

// 회사 검색 (로그인한 모든 사용자)
router.get('/search', 
  authMiddleware,
  companyController.search
);

// 회사 가입 신청 (일반 회원만)
router.post('/apply', 
  authMiddleware,
  checkRole('GENERAL'),
  companyController.apply
);

// 사업자번호 중복 체크
router.post('/check-business-number',
  authMiddleware,
  checkRole('BUSINESS'),
  companyController.checkBusinessNumber
);

// 사용자의 모든 회사 목록 조회 (로그인한 모든 사용자)
router.get('/my-companies',
  authMiddleware,
  companyController.getUserCompanies
);

// 회사의 가입 신청 목록 조회 (사업주만)
router.get('/:companyId/pending-requests',
  authMiddleware,
  companyController.getPendingRequests
);

// 가입 신청 승인/거절 (사업주만)
router.post('/handle-request',
  authMiddleware,
  companyController.handleRequest
);

// 승인된 직원 목록 조회
router.get('/:companyId/approved-employees',
  authMiddleware,
  companyController.getApprovedEmployees
);

// 거절/퇴사 목록 조회
router.get('/:companyId/rejected-employees',
  authMiddleware,
  companyController.getRejectedEmployees
);

// 직원 역할 변경
router.put('/update-employee-role',
  authMiddleware,
  companyController.updateEmployeeRole
);

// 회사 정보 조회
router.get('/:companyId',
  authMiddleware,
  companyController.getCompanyById
);

// 회사의 회계기수 목록 조회
router.get('/:companyId/fiscal-periods',
  authMiddleware,
  companyController.getFiscalPeriods
);

// 특정 회계기수 정보 조회
router.get('/:companyId/fiscal-periods/:fiscalYear',
  authMiddleware,
  companyController.getFiscalPeriodByYear
);

module.exports = router;