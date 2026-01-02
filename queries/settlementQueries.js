// 합계잔액시산표 조회 쿼리 (일반전표 + 매입매출전표 + 이월잔액)
const getTrialBalanceQuery = `
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    a.account_category,
    COALESCE(cf.debit_balance, 0) AS opening_debit,
    COALESCE(cf.credit_balance, 0) AS opening_credit,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN carry_forward_balances cf ON a.account_id = cf.account_id AND cf.company_id = ? AND cf.fiscal_year = ? AND cf.client_id IS NULL
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date, gv.company_id
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date,
           spv.company_id
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
  ) all_lines ON all_lines.account_code = a.account_code AND all_lines.company_id = a.company_id
  WHERE a.company_id = ?
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name, a.account_type, a.account_category, cf.debit_balance, cf.credit_balance
  ORDER BY a.account_code
`;

// 대차대조표 조회 쿼리
const getBalanceSheetQuery = `
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date, gv.company_id
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date,
           spv.company_id
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
  ) all_lines ON all_lines.account_code = a.account_code AND all_lines.company_id = a.company_id
  WHERE a.company_id = ?
    AND (a.account_type IN ('자산', 'ASSET', '부채', 'LIABILITY', '자본', 'EQUITY'))
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name, a.account_type
  HAVING ABS(COALESCE(SUM(all_lines.debit_amount), 0) - COALESCE(SUM(all_lines.credit_amount), 0)) > 0.01
  ORDER BY
    CASE a.account_type
      WHEN '자산' THEN 1
      WHEN 'ASSET' THEN 1
      WHEN '부채' THEN 2
      WHEN 'LIABILITY' THEN 2
      WHEN '자본' THEN 3
      WHEN 'EQUITY' THEN 3
    END,
    a.account_code
`;

// 손익계산서 조회 쿼리 (결산전표 제외)
const getIncomeStatementQuery = `
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date, gv.company_id
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    WHERE gv.description NOT LIKE '[결산]%'
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date,
           spv.company_id
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
  ) all_lines ON all_lines.account_code = a.account_code AND all_lines.company_id = a.company_id
  WHERE a.company_id = ?
    AND (a.account_type = '수익' OR a.account_type = 'REVENUE' OR a.account_type = '비용' OR a.account_type = 'EXPENSE')
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name, a.account_type
  HAVING (COALESCE(SUM(all_lines.debit_amount), 0) - COALESCE(SUM(all_lines.credit_amount), 0)) != 0
  ORDER BY a.account_type, a.account_code
`;

// 손익 계정 조회 쿼리 (결산용 - 결산전표 제외)
const getProfitLossAccountsQuery = `
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    WHERE gv.company_id = ? AND gv.description NOT LIKE '[결산]%'
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
    WHERE spv.company_id = ?
  ) all_lines ON all_lines.account_code = a.account_code
  WHERE a.company_id = ?
    AND (a.account_type = '수익' OR a.account_type = 'REVENUE' OR a.account_type = '비용' OR a.account_type = 'EXPENSE')
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name, a.account_type
  HAVING ABS(COALESCE(SUM(all_lines.debit_amount), 0) - COALESCE(SUM(all_lines.credit_amount), 0)) > 0.01
  ORDER BY a.account_type, a.account_code
`;

// 특정 계정의 잔액 조회 쿼리
const getAccountBalanceQuery = `
  SELECT
    a.account_code,
    a.account_name,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date, gv.company_id
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date,
           spv.company_id
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
  ) all_lines ON all_lines.account_code = a.account_code AND all_lines.company_id = a.company_id
  WHERE a.company_id = ?
    AND a.account_code = ?
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name
`;

// 제조원가명세서 조회 쿼리
const getManufacturingCostQuery = `
  SELECT
    a.account_code,
    a.account_name,
    COALESCE(SUM(all_lines.debit_amount), 0) AS total_debit,
    COALESCE(SUM(all_lines.credit_amount), 0) AS total_credit
  FROM accounts a
  LEFT JOIN (
    SELECT a2.account_code, gvl.debit_amount, gvl.credit_amount, gv.voucher_date, gv.company_id
    FROM general_voucher_lines gvl
    INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
    INNER JOIN accounts a2 ON gvl.account_id = a2.account_id
    UNION ALL
    SELECT a2.account_code,
           CASE WHEN spvl.debit_credit = '차변' THEN spvl.amount ELSE 0 END as debit_amount,
           CASE WHEN spvl.debit_credit = '대변' THEN spvl.amount ELSE 0 END as credit_amount,
           spv.voucher_date,
           spv.company_id
    FROM sales_purchase_voucher_lines spvl
    INNER JOIN sales_purchase_vouchers spv ON spvl.voucher_id = spv.voucher_id
    INNER JOIN accounts a2 ON spvl.account_id = a2.account_id
  ) all_lines ON all_lines.account_code = a.account_code AND all_lines.company_id = a.company_id
  WHERE a.company_id = ?
    AND a.account_code >= ?
    AND a.account_code < ?
    AND (all_lines.voucher_date BETWEEN ? AND ? OR all_lines.voucher_date IS NULL)
  GROUP BY a.account_code, a.account_name
  ORDER BY a.account_code
`;

module.exports = {
  getManufacturingCostQuery,
  getIncomeStatementQuery,
  getProfitLossAccountsQuery,
  getAccountBalanceQuery,
  getBalanceSheetQuery,
  getTrialBalanceQuery
};
