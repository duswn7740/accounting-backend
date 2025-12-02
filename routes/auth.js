const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 회원가입 POST /api/auth/register
router.post('/register', authController.register);

// 이메일 중복체크
router.post('/check-email', authController.checkEmail);

// 로그인
router.post('/login', authController.login);

module.exports = router;