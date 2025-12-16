const express = require('express');
const router = express.Router();
const salesPurchaseController = require('../controllers/salesPurchaseController');
const authMiddleware = require('../middleware/authMiddleware');

// 전표 등록
router.post('/',
  authMiddleware,
  salesPurchaseController.createVoucher
);

// 회사별 전표 조회
router.get('/',
  authMiddleware,
  salesPurchaseController.getVouchersByCompany
);

// 기간별 전표 조회
router.get('/by-date-range',
  authMiddleware,
  salesPurchaseController.getVouchersByDateRange
);

// 전표 상세 조회
router.get('/:voucherId',
  authMiddleware,
  salesPurchaseController.getVoucherById
);

// 전표 수정
router.put('/:voucherId',
  authMiddleware,
  salesPurchaseController.updateVoucher
);

// 전표 삭제
router.delete('/:voucherId',
  authMiddleware,
  salesPurchaseController.deleteVoucher
);

module.exports = router;
