const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const clientRoutes = require('./routes/clients');
const accountRoutes = require('./routes/accounts');
const voucherRoutes = require('./routes/vouchers');
const salesPurchaseRoutes = require('./routes/salesPurchase');
const ledgerRoutes = require('./routes/ledgerRoutes');
const fiscalPeriodRoutes = require('./routes/fiscalPeriods');
const settlementRoutes = require('./routes/settlement');
const dashboardRoutes = require('./routes/dashboard');

// /api/auth로 시작하는 모든 요청은 authRoutes로
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/sales-purchase', salesPurchaseRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/fiscal-periods', fiscalPeriodRoutes);
app.use('/api/settlement', settlementRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 테스트 라우트
app.get('/', (req, res) => {
  res.json({ message: '회계 프로그램 API 서버' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});



