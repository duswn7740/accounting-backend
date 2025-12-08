const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ 구체적인 경로를 먼저!
// 거래처 코드 중복 확인
router.post('/check-code',
  authMiddleware,
  clientController.checkClientCode
);

// 다음 거래처 코드 조회
router.get('/next-code',
  authMiddleware,
  clientController.getNextClientCode
);

// 거래처 등록
router.post('/',
  authMiddleware,
  clientController.createClient
);

// 거래처 목록 조회
router.get('/',
  authMiddleware,
  clientController.getClientsByCategory
);

// ✅ 동적 파라미터는 마지막에!
// 거래처 상세 조회
router.get('/:clientId',
  authMiddleware,
  clientController.getClientById
);

// 거래처 수정
router.put('/:clientId',
  authMiddleware,
  clientController.updateClient
);

// 거래처 삭제
router.delete('/:clientId',
  authMiddleware,
  clientController.deleteClient
);

module.exports = router;