const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 회원가입
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies'); 

// /api/auth로 시작하는 모든 요청은 authRoutes로
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);

// 테스트 라우트
app.get('/', (req, res) => {
  res.json({ message: '회계 프로그램 API 서버' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});