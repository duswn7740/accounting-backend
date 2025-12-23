const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');
const authMiddleware = require('../middleware/authMiddleware');

// 계정별 원장 조회
router.get('/account/:companyId', authMiddleware, ledgerController.getAccountLedger);

// 계정 요약 조회 (사이드바용)
router.get('/account/:companyId/summary', authMiddleware, ledgerController.getAccountSummary);

// 전표 라인 수정
router.put('/voucher-line/:voucherType/:voucherId/:lineNo', authMiddleware, ledgerController.updateVoucherLine);

// 전표 라인 추가
router.post('/voucher-line/:voucherType/:voucherId', authMiddleware, ledgerController.addVoucherLine);

// 전표 라인 삭제
router.delete('/voucher-line/:voucherType/:voucherId/:lineNo', authMiddleware, ledgerController.deleteVoucherLine);

// 거래처별 원장 요약 조회
router.get('/client', authMiddleware, ledgerController.getClientLedgerSummary);

// 거래처별 원장 상세 조회
router.get('/client/detail', authMiddleware, ledgerController.getClientLedgerDetail);

module.exports = router;
