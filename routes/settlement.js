const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const authMiddleware = require('../middleware/authMiddleware');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// 결산전표 데이터 조회
router.get('/voucher-data/:companyId/:fiscalYear', settlementController.getSettlementVoucherData);

// 결산전표 생성
router.post('/voucher/:companyId/:fiscalYear', settlementController.createSettlementVoucher);

// 제조원가명세서 조회
router.get('/manufacturing-cost/:companyId/:fiscalYear', settlementController.getManufacturingCost);

// 제조원가 결산 실행
router.post('/manufacturing-cost/:companyId/:fiscalYear', settlementController.executeManufacturingCostSettlement);

// 손익계산서 조회
router.get('/income-statement/:companyId/:fiscalYear', settlementController.getIncomeStatement);

// 손익계산 결산 실행
router.post('/income-statement/:companyId/:fiscalYear', settlementController.executeIncomeStatementSettlement);

// 이익잉여금처분계산서 조회
router.get('/retained-earnings/:companyId/:fiscalYear', settlementController.getRetainedEarnings);

// 이익잉여금 처분 결산 실행
router.post('/retained-earnings/:companyId/:fiscalYear', settlementController.executeRetainedEarningsSettlement);

// 대차대조표 조회
router.get('/balance-sheet/:companyId/:fiscalYear', settlementController.getBalanceSheet);

// 합계잔액시산표 조회
router.get('/trial-balance/:companyId/:fiscalYear', settlementController.getTrialBalance);

module.exports = router;
