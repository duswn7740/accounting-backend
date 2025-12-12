const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const authMiddleware = require('../middleware/authMiddleware');

// 전표 라인 조회
router.get('/',
  authMiddleware,
  voucherController.getVoucherLinesByDate
);

// 전표 라인 생성
router.post('/',
  authMiddleware,
  voucherController.createVoucherLine
);

// 전표 라인 수정
router.put('/:lineId',
  authMiddleware,
  voucherController.updateVoucherLine
);

// 전표 라인 삭제
router.delete('/:lineId',
  authMiddleware,
  voucherController.deleteVoucherLine
);

// 여러 라인을 한 번에 저장하는 전표 생성
router.post('/batch',
  authMiddleware,
  voucherController.createVoucherWithLines
);

// 전표 전체 수정 (여러 라인)
router.put('/batch/:voucherId',
  authMiddleware,
  voucherController.updateVoucherWithLines
);

module.exports = router;