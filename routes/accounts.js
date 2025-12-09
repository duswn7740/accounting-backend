const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');


router.get('/check-code',
  authMiddleware,
  accountController.checkAccountCode
);


// 회사별 계정과목 조회 (모든 권한)
router.get('/',
  authMiddleware,
  accountController.getAccountsByCompany
);

// 계정과목 추가 (ADMIN만)
router.post('/',
  authMiddleware,
  accountController.createAccount
);

// 계정과목 수정 (ADMIN만)
router.put('/:accountId',
  authMiddleware,
  accountController.updateAccount
);

// 계정과목 삭제 (ADMIN만)
router.delete('/:accountId',
  authMiddleware,
  accountController.deleteAccount
);

module.exports = router;