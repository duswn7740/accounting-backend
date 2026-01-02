const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:8000/api';
const SECRET_KEY = 'your_super_secret_key_change_this_in_production';

// 테스트용 토큰 생성
const token = jwt.sign(
  { userId: 1, companyId: 1 },
  SECRET_KEY,
  { expiresIn: '1h' }
);

const config = {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

async function testSettlementAPIs() {
  console.log('='.repeat(60));
  console.log('결산 API 테스트 시작');
  console.log('='.repeat(60));

  try {
    // 1. 합계잔액시산표 조회
    console.log('\n1. 합계잔액시산표 조회 테스트');
    console.log('-'.repeat(60));
    const trialBalance = await axios.get(`${BASE_URL}/settlement/trial-balance/1/1`, config);
    console.log('✅ 조회 성공');
    console.log('계정 수:', trialBalance.data.accounts?.length || 0);
    console.log('합계 차변:', trialBalance.data.sumTotalDebit?.toLocaleString());
    console.log('합계 대변:', trialBalance.data.sumTotalCredit?.toLocaleString());
    console.log('잔액 차변:', trialBalance.data.sumBalanceDebit?.toLocaleString());
    console.log('잔액 대변:', trialBalance.data.sumBalanceCredit?.toLocaleString());
    console.log('대차평형:', trialBalance.data.sumTotalDebit === trialBalance.data.sumTotalCredit ? '✅' : '❌');

    // 2. 대차대조표 조회
    console.log('\n2. 대차대조표 조회 테스트');
    console.log('-'.repeat(60));
    const balanceSheet = await axios.get(`${BASE_URL}/settlement/balance-sheet/1/1`, config);
    console.log('✅ 조회 성공');
    console.log('자산 계정 수:', balanceSheet.data.assets?.length || 0);
    console.log('부채 계정 수:', balanceSheet.data.liabilities?.length || 0);
    console.log('자본 계정 수:', balanceSheet.data.equity?.length || 0);
    console.log('자산 총계:', balanceSheet.data.totalAssets?.toLocaleString());
    console.log('부채 총계:', balanceSheet.data.totalLiabilities?.toLocaleString());
    console.log('자본 총계:', balanceSheet.data.totalEquity?.toLocaleString());
    console.log('대차평형:',
      balanceSheet.data.totalAssets === (balanceSheet.data.totalLiabilities + balanceSheet.data.totalEquity) ? '✅' : '❌'
    );

    // 3. 손익계산서 조회
    console.log('\n3. 손익계산서 조회 테스트');
    console.log('-'.repeat(60));
    const incomeStatement = await axios.get(`${BASE_URL}/settlement/income-statement/1/1`, config);
    console.log('✅ 조회 성공');
    console.log('수익 총계:', incomeStatement.data.totalRevenue?.toLocaleString());
    console.log('비용 총계:', incomeStatement.data.totalExpense?.toLocaleString());
    console.log('당기순이익:', incomeStatement.data.netIncome?.toLocaleString());
    console.log('손익 계정 수:', incomeStatement.data.details?.length || 0);

    // 4. 이익잉여금처분계산서 조회
    console.log('\n4. 이익잉여금처분계산서 조회 테스트');
    console.log('-'.repeat(60));
    const retainedEarnings = await axios.get(`${BASE_URL}/settlement/retained-earnings/1/1`, config);
    console.log('✅ 조회 성공');
    console.log('당기순이익:', retainedEarnings.data.netIncome?.toLocaleString());
    console.log('전기이월 이익잉여금:', retainedEarnings.data.previousRetainedEarnings?.toLocaleString());
    console.log('이익잉여금 합계:', retainedEarnings.data.totalRetainedEarnings?.toLocaleString());

    // 5. 제조원가명세서 조회 (500번대)
    console.log('\n5. 제조원가명세서 조회 테스트 (500번대)');
    console.log('-'.repeat(60));
    const manufacturingCost = await axios.get(`${BASE_URL}/settlement/manufacturing-cost/1/1?codeRange=500`, config);
    console.log('✅ 조회 성공');
    console.log('총 제조원가:', manufacturingCost.data.totalCost?.toLocaleString());
    console.log('원가 항목 수:', manufacturingCost.data.details?.length || 0);

    // 6. 손익계산 결산 실행
    console.log('\n6. 손익계산 결산 실행 테스트');
    console.log('-'.repeat(60));
    if (incomeStatement.data.details && incomeStatement.data.details.length > 0) {
      const incomeSettlement = await axios.post(`${BASE_URL}/settlement/income-statement/1/1`, {}, config);
      console.log('✅ 결산 실행 성공');
      console.log('메시지:', incomeSettlement.data.message);
      console.log('생성된 전표 수:', incomeSettlement.data.vouchersCreated);

      // 결산 후 998 계정 잔액 확인
      const afterIncome = await axios.get(`${BASE_URL}/settlement/retained-earnings/1/1`, config);
      console.log('결산 후 998 계정 잔액:', afterIncome.data.netIncome?.toLocaleString());
    } else {
      console.log('⚠️  손익 계정이 없어서 결산 건너뜀');
    }

    // 7. 이익잉여금 처분 결산 실행
    console.log('\n7. 이익잉여금 처분 결산 실행 테스트');
    console.log('-'.repeat(60));
    const retainedSettlement = await axios.post(
      `${BASE_URL}/settlement/retained-earnings/1/1`,
      {
        currentDisposalDate: '2024-12-31',
        previousDisposalDate: '2023-12-31'
      },
      config
    );
    console.log('✅ 결산 실행 성공');
    console.log('메시지:', retainedSettlement.data.message);
    console.log('처분 당기순이익:', retainedSettlement.data.netIncome?.toLocaleString());

    // 8. 결산 후 대차대조표 재확인
    console.log('\n8. 결산 후 대차대조표 재확인');
    console.log('-'.repeat(60));
    const afterBalanceSheet = await axios.get(`${BASE_URL}/settlement/balance-sheet/1/1`, config);
    console.log('✅ 조회 성공');
    console.log('자산 총계:', afterBalanceSheet.data.totalAssets?.toLocaleString());
    console.log('부채+자본 총계:',
      (afterBalanceSheet.data.totalLiabilities + afterBalanceSheet.data.totalEquity)?.toLocaleString()
    );

    console.log('\n' + '='.repeat(60));
    console.log('모든 테스트 완료! ✅');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 에러 발생:');
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testSettlementAPIs();
