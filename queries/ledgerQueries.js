// 계정별 원장 조회 (기간 + 계정코드 범위)
const GET_ACCOUNT_LEDGER = `
  SELECT
    v.voucher_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_no,
    l.line_no,
    l.debit_credit,
    l.account_id,
    a.account_code,
    a.account_name,
    l.amount,
    l.description_code,
    l.description,
    c.client_code,
    c.client_name
  FROM sales_purchase_voucher_lines l
  INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
  INNER JOIN accounts a ON l.account_id = a.account_id
  LEFT JOIN clients c ON v.client_id = c.client_id
  WHERE v.company_id = ?
    AND v.voucher_date BETWEEN ? AND ?
    AND a.account_code BETWEEN ? AND ?
    AND v.is_active = TRUE
  ORDER BY a.account_code ASC, v.voucher_date ASC, v.voucher_no ASC, l.line_no ASC
`;

// 일반전표 조회도 포함 (통합 원장) - 선택된 계정이 포함된 전표의 모든 라인 조회
const GET_ACCOUNT_LEDGER_ALL = `
  SELECT
    v.voucher_id,
    v.voucher_date,
    'general' as voucher_type,
    v.voucher_no,
    l.line_no,
    CASE
      WHEN l.debit_amount > 0 THEN '차변'
      WHEN l.credit_amount > 0 THEN '대변'
      ELSE '차변'
    END as debit_credit,
    l.account_id,
    a.account_code,
    a.account_name,
    CASE
      WHEN l.debit_amount > 0 THEN l.debit_amount
      WHEN l.credit_amount > 0 THEN l.credit_amount
      ELSE 0
    END as amount,
    l.description_code,
    l.description,
    c.client_code,
    c.client_name
  FROM general_voucher_lines l
  INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
  INNER JOIN accounts a ON l.account_id = a.account_id
  LEFT JOIN clients c ON l.client_id = c.client_id
  WHERE v.company_id = ?
    AND v.voucher_date BETWEEN ? AND ?
    AND v.voucher_id IN (
      SELECT DISTINCT v2.voucher_id
      FROM general_voucher_lines l2
      INNER JOIN general_vouchers v2 ON l2.voucher_id = v2.voucher_id
      INNER JOIN accounts a2 ON l2.account_id = a2.account_id
      WHERE v2.company_id = ?
        AND v2.voucher_date BETWEEN ? AND ?
        AND a2.account_code BETWEEN ? AND ?
    )

  UNION ALL

  SELECT
    v.voucher_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_no,
    l.line_no,
    l.debit_credit,
    l.account_id,
    a.account_code,
    a.account_name,
    l.amount,
    l.description_code,
    l.description,
    c.client_code,
    c.client_name
  FROM sales_purchase_voucher_lines l
  INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
  INNER JOIN accounts a ON l.account_id = a.account_id
  LEFT JOIN clients c ON v.client_id = c.client_id
  WHERE v.company_id = ?
    AND v.voucher_date BETWEEN ? AND ?
    AND v.is_active = TRUE
    AND v.voucher_id IN (
      SELECT DISTINCT v2.voucher_id
      FROM sales_purchase_voucher_lines l2
      INNER JOIN sales_purchase_vouchers v2 ON l2.voucher_id = v2.voucher_id
      INNER JOIN accounts a2 ON l2.account_id = a2.account_id
      WHERE v2.company_id = ?
        AND v2.voucher_date BETWEEN ? AND ?
        AND a2.account_code BETWEEN ? AND ?
        AND v2.is_active = TRUE
    )

  ORDER BY account_code ASC, voucher_date ASC, voucher_no ASC, line_no ASC
`;

// 조회된 계정 목록 요약 (사이드바용) - 일반전표 + 매입매출전표
const GET_ACCOUNT_SUMMARY = `
  SELECT
    account_id,
    account_code,
    account_name,
    COUNT(DISTINCT CONCAT(voucher_id, '-', voucher_type)) as voucher_count,
    SUM(total_debit) as total_debit,
    SUM(total_credit) as total_credit
  FROM (
    SELECT
      l.voucher_id,
      'general' as voucher_type,
      a.account_id,
      a.account_code,
      a.account_name,
      l.debit_amount as total_debit,
      l.credit_amount as total_credit
    FROM general_voucher_lines l
    INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
    INNER JOIN accounts a ON l.account_id = a.account_id
    WHERE v.company_id = ?
      AND v.voucher_date BETWEEN ? AND ?
      AND a.account_code BETWEEN ? AND ?

    UNION ALL

    SELECT
      l.voucher_id,
      v.voucher_type,
      a.account_id,
      a.account_code,
      a.account_name,
      CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END as total_debit,
      CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END as total_credit
    FROM sales_purchase_voucher_lines l
    INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
    INNER JOIN accounts a ON l.account_id = a.account_id
    WHERE v.company_id = ?
      AND v.voucher_date BETWEEN ? AND ?
      AND a.account_code BETWEEN ? AND ?
      AND v.is_active = TRUE
  ) combined
  GROUP BY account_id, account_code, account_name
  ORDER BY account_code ASC
`;

// 거래처별 원장 요약 조회 (거래처코드별 집계)
const GET_CLIENT_LEDGER_SUMMARY = `
  SELECT
    client_id,
    client_code,
    client_name,
    business_number,
    SUM(debit_total) as debit_total,
    SUM(credit_total) as credit_total
  FROM (
    SELECT
      c.client_id,
      c.client_code,
      c.client_name,
      c.business_number,
      SUM(CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN l.credit_amount > 0 THEN l.credit_amount ELSE 0 END) as credit_total
    FROM general_voucher_lines l
    INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
    INNER JOIN accounts a ON l.account_id = a.account_id
    INNER JOIN clients c ON l.client_id = c.client_id
    WHERE c.company_id = ?
      AND a.account_code = ?
      AND v.voucher_date BETWEEN ? AND ?
      AND c.client_code BETWEEN ? AND ?
    GROUP BY c.client_id, c.client_code, c.client_name, c.business_number

    UNION ALL

    SELECT
      c.client_id,
      c.client_code,
      c.client_name,
      c.business_number,
      SUM(CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END) as credit_total
    FROM sales_purchase_voucher_lines l
    INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
    INNER JOIN accounts a ON l.account_id = a.account_id
    INNER JOIN clients c ON v.client_id = c.client_id
    WHERE c.company_id = ?
      AND a.account_code = ?
      AND v.voucher_date BETWEEN ? AND ?
      AND v.is_active = TRUE
      AND c.client_code BETWEEN ? AND ?
    GROUP BY c.client_id, c.client_code, c.client_name, c.business_number
  ) combined
  GROUP BY client_id, client_code, client_name, business_number
  HAVING (SUM(debit_total) > 0 OR SUM(credit_total) > 0)
  ORDER BY client_code ASC
`;

// 거래처별 원장 상세 조회 (특정 거래처의 전표 내역)
const GET_CLIENT_LEDGER_DETAIL = `
  SELECT
    v.voucher_id,
    v.voucher_date,
    'general' as voucher_type,
    v.voucher_no,
    l.line_no,
    l.debit_amount,
    l.credit_amount,
    l.description,
    a.account_code,
    a.account_name
  FROM general_voucher_lines l
  INNER JOIN general_vouchers v ON l.voucher_id = v.voucher_id
  INNER JOIN accounts a ON l.account_id = a.account_id
  WHERE v.company_id = ?
    AND a.account_code = ?
    AND l.client_id = ?
    AND v.voucher_date BETWEEN ? AND ?

  UNION ALL

  SELECT
    v.voucher_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_no,
    l.line_no,
    CASE WHEN l.debit_credit = '차변' THEN l.amount ELSE 0 END as debit_amount,
    CASE WHEN l.debit_credit = '대변' THEN l.amount ELSE 0 END as credit_amount,
    l.description,
    a.account_code,
    a.account_name
  FROM sales_purchase_voucher_lines l
  INNER JOIN sales_purchase_vouchers v ON l.voucher_id = v.voucher_id
  INNER JOIN accounts a ON l.account_id = a.account_id
  WHERE v.company_id = ?
    AND a.account_code = ?
    AND v.client_id = ?
    AND v.voucher_date BETWEEN ? AND ?
    AND v.is_active = TRUE

  ORDER BY voucher_date ASC, voucher_no ASC, line_no ASC
`;

module.exports = {
  GET_ACCOUNT_LEDGER,
  GET_ACCOUNT_LEDGER_ALL,
  GET_ACCOUNT_SUMMARY,
  GET_CLIENT_LEDGER_SUMMARY,
  GET_CLIENT_LEDGER_DETAIL
};
