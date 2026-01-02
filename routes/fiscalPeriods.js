const express = require('express');
const router = express.Router();
const fiscalPeriodController = require('../controllers/fiscalPeriodController');
const authMiddleware = require('../middleware/authMiddleware');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// 마감 후 이월
router.post('/:fiscalYear/carry-forward', fiscalPeriodController.carryForward);

// 회계기수 마감
router.post('/:fiscalYear/close', fiscalPeriodController.closePeriod);

// 회계기수 마감 취소
router.post('/:fiscalYear/reopen', fiscalPeriodController.reopenPeriod);

module.exports = router;
