const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const verifyToken = require('../middleware/authMiddleware');

// KPI 요약 데이터 (당월 기준)
router.get('/summary', verifyToken, async (req, res) => {
  try {
    // 쿼리 파라미터로 받은 companyId 사용 (없으면 토큰의 companyId 사용)
    const companyId = req.query.companyId || req.user.companyId;

    const fiscalPeriodInfo = JSON.parse(req.query.fiscalPeriodInfo || '{}');

    const { startDate, endDate } = fiscalPeriodInfo;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '회계기수를 선택해주세요' });
    }

    // 조회 월 계산 (파라미터로 받거나, 기본값은 전월)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const selectedMonth = req.query.month ? parseInt(req.query.month) : defaultMonth;
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;

    // 선택한 월의 시작일/종료일 계산 (회계연도 범위 내에서)
    const fiscalStart = new Date(startDate);
    const fiscalEnd = new Date(endDate);
    const fiscalStartYear = fiscalStart.getFullYear();
    const fiscalStartMonth = fiscalStart.getMonth() + 1;

    // 날짜를 YYYY-MM-DD 형식 문자열로 변환하는 함수
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 선택한 월의 시작일/종료일
    let selectedMonthStart, selectedMonthEnd;
    if (selectedMonth >= fiscalStartMonth) {
      // 같은 연도
      selectedMonthStart = new Date(fiscalStartYear, selectedMonth - 1, 1);
      selectedMonthEnd = new Date(fiscalStartYear, selectedMonth, 0);
    } else {
      // 다음 연도
      selectedMonthStart = new Date(fiscalStartYear + 1, selectedMonth - 1, 1);
      selectedMonthEnd = new Date(fiscalStartYear + 1, selectedMonth, 0);
    }

    // 회계연도 범위로 제한
    if (selectedMonthStart < fiscalStart) selectedMonthStart = fiscalStart;
    if (selectedMonthEnd > fiscalEnd) selectedMonthEnd = fiscalEnd;

    // 문자열 형식으로 변환 (시간대 문제 방지)
    const selectedMonthStartStr = formatDate(selectedMonthStart);
    const selectedMonthEndStr = formatDate(selectedMonthEnd);

    // 전월 범위 계산 - 선택월이 회계기수 시작월이면 전기수 12월 조회
    let prevMonthStart, prevMonthEnd;
    let usePrevFiscalYear = false;

    if (selectedMonth === fiscalStartMonth) {
      // 선택월이 회계기수 시작월이면 전기수의 마지막 달 조회
      usePrevFiscalYear = true;
      // 전기수 마지막 달 = 현재 회계기수 시작일 - 1일이 속한 달
      const prevFiscalEnd = new Date(fiscalStart);
      prevFiscalEnd.setDate(prevFiscalEnd.getDate() - 1);
      const prevYear = prevFiscalEnd.getFullYear();
      const prevMonthNum = prevFiscalEnd.getMonth() + 1;
      prevMonthStart = new Date(prevYear, prevMonthNum - 1, 1);
      prevMonthEnd = new Date(prevYear, prevMonthNum, 0);
    } else if (prevMonth >= fiscalStartMonth) {
      prevMonthStart = new Date(fiscalStartYear, prevMonth - 1, 1);
      prevMonthEnd = new Date(fiscalStartYear, prevMonth, 0);
    } else {
      prevMonthStart = new Date(fiscalStartYear + 1, prevMonth - 1, 1);
      prevMonthEnd = new Date(fiscalStartYear + 1, prevMonth, 0);
    }

    // 같은 회계연도 내일 경우에만 범위 제한 (전기수 조회 시에는 제한하지 않음)
    if (!usePrevFiscalYear) {
      if (prevMonthStart < fiscalStart) prevMonthStart = fiscalStart;
      if (prevMonthEnd > fiscalEnd) prevMonthEnd = fiscalEnd;
    }

    // 문자열 형식으로 변환
    const prevMonthStartStr = formatDate(prevMonthStart);
    const prevMonthEndStr = formatDate(prevMonthEnd);

    // 선택한 월 매출 (수익 계정, 영업외손익 제외) - 일반전표 + 매출전표
    const salesQuery = `
      SELECT COALESCE(SUM(sales), 0) as sales
      FROM (
        SELECT SUM(vl.credit_amount - vl.debit_amount) as sales
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND a.account_type = '수익'
          AND a.account_code NOT LIKE '9%'
          AND vl.voucher_type NOT IN ('5', '6')
        UNION ALL
        SELECT SUM(vl.amount) as sales
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND v.voucher_type = '매출'
          AND a.account_type = '수익'
          AND a.account_code NOT LIKE '9%'
          AND v.is_active = TRUE
      ) combined
    `;

    // 선택한 월 비용 (비용 계정, 영업외손익 제외, VAT 제외) - 일반전표 + 매입전표
    const expenseQuery = `
      SELECT COALESCE(SUM(expense), 0) as expense
      FROM (
        SELECT SUM(vl.debit_amount - vl.credit_amount) as expense
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND a.account_type = '비용'
          AND a.account_code NOT LIKE '9%'
          AND vl.voucher_type NOT IN ('5', '6')
        UNION ALL
        SELECT SUM(vl.amount) as expense
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND v.voucher_type = '매입'
          AND (a.account_type = '비용' OR (a.account_type = '자산' AND a.account_code NOT IN ('135', '255')))
          AND a.account_code NOT LIKE '9%'
          AND v.is_active = TRUE
      ) combined
    `;

    // 현금 잔액 (계정과목 101 - 현금, 102 - 보통예금)
    const cashQuery = `
      SELECT COALESCE(SUM(cash), 0) as cash
      FROM (
        SELECT SUM(vl.debit_amount - vl.credit_amount) as cash
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND (a.account_code = '101' OR a.account_code = '102')
        UNION ALL
        SELECT SUM(CASE WHEN vl.debit_credit = '차변' THEN vl.amount ELSE -vl.amount END) as cash
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND (a.account_code = '101' OR a.account_code = '102')
          AND v.is_active = TRUE
      ) combined
    `;

    // 전월 매출 (증감률 계산용, 영업외손익 제외)
    const prevMonthSalesQuery = `
      SELECT COALESCE(SUM(prev_sales), 0) as prev_sales
      FROM (
        SELECT SUM(vl.credit_amount - vl.debit_amount) as prev_sales
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND a.account_type = '수익'
          AND a.account_code NOT LIKE '9%'
          AND vl.voucher_type NOT IN ('5', '6')
        UNION ALL
        SELECT SUM(vl.amount) as prev_sales
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND v.voucher_type = '매출'
          AND a.account_type = '수익'
          AND a.account_code NOT LIKE '9%'
          AND v.is_active = TRUE
      ) combined
    `;

    // 전월 비용 (증감률 계산용, 영업외손익 제외, VAT 제외)
    const prevMonthExpenseQuery = `
      SELECT COALESCE(SUM(prev_expense), 0) as prev_expense
      FROM (
        SELECT SUM(vl.debit_amount - vl.credit_amount) as prev_expense
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND a.account_type = '비용'
          AND a.account_code NOT LIKE '9%'
          AND vl.voucher_type NOT IN ('5', '6')
        UNION ALL
        SELECT SUM(vl.amount) as prev_expense
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND v.voucher_type = '매입'
          AND (a.account_type = '비용' OR (a.account_type = '자산' AND a.account_code NOT IN ('135', '255')))
          AND a.account_code NOT LIKE '9%'
          AND v.is_active = TRUE
      ) combined
    `;

    const [salesResult] = await pool.query(salesQuery, [companyId, selectedMonthStartStr, selectedMonthEndStr, companyId, selectedMonthStartStr, selectedMonthEndStr]);

    const [expenseResult] = await pool.query(expenseQuery, [companyId, selectedMonthStartStr, selectedMonthEndStr, companyId, selectedMonthStartStr, selectedMonthEndStr]);

    const [cashResult] = await pool.query(cashQuery, [companyId, startDate, endDate, companyId, startDate, endDate]);

    const [prevSalesResult] = await pool.query(prevMonthSalesQuery, [companyId, prevMonthStartStr, prevMonthEndStr, companyId, prevMonthStartStr, prevMonthEndStr]);

    const [prevExpenseResult] = await pool.query(prevMonthExpenseQuery, [companyId, prevMonthStartStr, prevMonthEndStr, companyId, prevMonthStartStr, prevMonthEndStr]);

    const sales = parseFloat(salesResult[0].sales) || 0;
    const expense = parseFloat(expenseResult[0].expense) || 0;
    const profit = sales - expense;
    const cash = parseFloat(cashResult[0].cash) || 0;
    const prevSales = parseFloat(prevSalesResult[0].prev_sales) || 0;
    const prevExpense = parseFloat(prevExpenseResult[0].prev_expense) || 0;
    const prevProfit = prevSales - prevExpense;

    // 증감률 계산
    const salesGrowth = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0;
    const expenseGrowth = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;
    const profitGrowth = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

    res.json({
      success: true,
      summary: {
        sales: Math.round(sales),
        expense: Math.round(expense),
        profit: Math.round(profit),
        cash: Math.round(cash),
        salesGrowth: Math.round(salesGrowth * 10) / 10,
        expenseGrowth: Math.round(expenseGrowth * 10) / 10,
        profitGrowth: Math.round(profitGrowth * 10) / 10
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'KPI 조회에 실패했습니다', error: error.message });
  }
});

// 월별 매출/비용 추이 (기간 조회)
router.get('/monthly-trend', verifyToken, async (req, res) => {
  try {
    // 쿼리 파라미터로 받은 companyId 사용 (없으면 토큰의 companyId 사용)
    const companyId = req.query.companyId || req.user.companyId;
    const { startMonth, endMonth, fiscalYear } = req.query;

    if (!fiscalYear || !startMonth || !endMonth) {
      return res.status(400).json({ success: false, message: '회계기수와 조회 기간을 입력해주세요' });
    }

    // Get fiscal period info from fiscal_periods table
    const [fiscalPeriods] = await pool.query(
      'SELECT start_date, end_date FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    if (fiscalPeriods.length === 0) {
      return res.status(400).json({ success: false, message: '해당 회계기수를 찾을 수 없습니다' });
    }

    const { start_date: startDate, end_date: endDate } = fiscalPeriods[0];

    const query = `
      SELECT
        month,
        SUM(sales) as sales,
        SUM(expense) as expense
      FROM (
        SELECT
          MONTH(v.voucher_date) as month,
          SUM(CASE WHEN a.account_type = '수익' AND a.account_code NOT LIKE '9%' THEN vl.credit_amount - vl.debit_amount ELSE 0 END) as sales,
          SUM(CASE WHEN a.account_type = '비용' AND a.account_code NOT LIKE '9%' THEN vl.debit_amount - vl.credit_amount ELSE 0 END) as expense
        FROM general_voucher_lines vl
        JOIN general_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND MONTH(v.voucher_date) BETWEEN ? AND ?
          AND vl.voucher_type NOT IN ('5', '6')
        GROUP BY MONTH(v.voucher_date)
        UNION ALL
        SELECT
          MONTH(v.voucher_date) as month,
          SUM(CASE WHEN v.voucher_type = '매출' AND a.account_type = '수익' AND a.account_code NOT LIKE '9%' THEN vl.amount ELSE 0 END) as sales,
          SUM(CASE WHEN v.voucher_type = '매입' AND (a.account_type = '비용' OR (a.account_type = '자산' AND a.account_code NOT IN ('135', '255'))) AND a.account_code NOT LIKE '9%' THEN vl.amount ELSE 0 END) as expense
        FROM sales_purchase_voucher_lines vl
        JOIN sales_purchase_vouchers v ON vl.voucher_id = v.voucher_id
        JOIN accounts a ON vl.account_id = a.account_id
        WHERE v.company_id = ?
          AND v.voucher_date BETWEEN ? AND ?
          AND MONTH(v.voucher_date) BETWEEN ? AND ?
          AND v.is_active = TRUE
        GROUP BY MONTH(v.voucher_date)
      ) combined
      GROUP BY month
      ORDER BY month
    `;

    const [results] = await pool.query(query, [companyId, startDate, endDate, startMonth, endMonth, companyId, startDate, endDate, startMonth, endMonth]);

    // 모든 월에 대한 데이터 생성 (데이터 없는 월도 0으로 표시)
    const monthlyData = [];
    for (let month = parseInt(startMonth); month <= parseInt(endMonth); month++) {
      const found = results.find(r => r.month === month);
      monthlyData.push({
        month,
        sales: found ? Math.round(parseFloat(found.sales)) : 0,
        expense: found ? Math.round(parseFloat(found.expense)) : 0,
        profit: found ? Math.round(parseFloat(found.sales) - parseFloat(found.expense)) : 0
      });
    }

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '월별 추이 조회에 실패했습니다', error: error.message });
  }
});

// 부가세 신고일 알림
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    const notifications = [];

    // 부가세 신고일: 1월, 4월, 7월, 10월 25일
    const vatMonths = [1, 4, 7, 10];
    const vatDeadline = 25;

    // 다음 부가세 신고일 계산
    let nextVatMonth = null;
    let nextVatYear = today.getFullYear();

    // 현재 월의 신고일이 지났는지 확인
    if (vatMonths.includes(currentMonth) && currentDay <= vatDeadline) {
      // 이번 달 신고일이 아직 안 지남
      nextVatMonth = currentMonth;
      const daysUntilDeadline = vatDeadline - currentDay;

      if (daysUntilDeadline <= 7) {
        notifications.push({
          type: 'vat',
          title: '부가세 신고 마감 임박',
          message: `${currentMonth}월 ${vatDeadline}일까지 부가세 신고를 완료해주세요`,
          daysLeft: daysUntilDeadline,
          deadline: `${today.getFullYear()}-${String(currentMonth).padStart(2, '0')}-${vatDeadline}`,
          priority: daysUntilDeadline <= 3 ? 'high' : 'medium'
        });
      }
    } else {
      // 다음 부가세 신고월 찾기
      nextVatMonth = vatMonths.find(m => m > currentMonth || (m === currentMonth && currentDay <= vatDeadline));

      if (!nextVatMonth) {
        // 올해 남은 신고월이 없으면 내년 1월
        nextVatMonth = vatMonths[0];
        nextVatYear = today.getFullYear() + 1;
      }
    }

    // 다음 부가세 신고일 안내
    const nextDeadline = new Date(nextVatYear, nextVatMonth - 1, vatDeadline);
    const daysUntil = Math.ceil((nextDeadline - today) / (1000 * 60 * 60 * 24));

    notifications.push({
      type: 'info',
      title: '다음 부가세 신고일',
      message: `${nextVatMonth}월 ${vatDeadline}일`,
      daysLeft: daysUntil,
      deadline: `${nextVatYear}-${String(nextVatMonth).padStart(2, '0')}-${vatDeadline}`,
      priority: 'low'
    });

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '알림 조회에 실패했습니다', error: error.message });
  }
});

module.exports = router;
