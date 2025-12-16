// 매입매출 전표 등록
const CREATE_VOUCHER = `
  INSERT INTO sales_purchase_vouchers (
    company_id, voucher_date, voucher_type, voucher_no,
    client_id, tax_invoice_yn, tax_invoice_no,
    total_supply_amount, total_vat_amount, total_amount,
    status, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// 매입매출 전표 라인 등록
const CREATE_VOUCHER_LINE = `
  INSERT INTO sales_purchase_voucher_lines (
    voucher_id, line_no, debit_credit, account_id,
    amount, description, description_code,
    department_code, project_code
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// 회사별 매입매출 전표 조회
const FIND_VOUCHERS_BY_COMPANY = `
  SELECT
    v.voucher_id,
    v.company_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_no,
    v.client_id,
    c.client_code,
    c.client_name,
    c.business_number,
    v.tax_invoice_yn,
    v.tax_invoice_no,
    v.total_supply_amount,
    v.total_vat_amount,
    v.total_amount,
    v.status,
    v.created_by,
    v.created_at,
    v.updated_at,
    first_line.account_code,
    first_line.account_name,
    first_line.description_code,
    first_line.description
  FROM sales_purchase_vouchers v
  LEFT JOIN clients c ON v.client_id = c.client_id
  LEFT JOIN (
    SELECT
      l.voucher_id,
      a.account_code,
      a.account_name,
      l.description_code,
      l.description
    FROM sales_purchase_voucher_lines l
    JOIN accounts a ON l.account_id = a.account_id
    WHERE l.line_no = 1
  ) first_line ON v.voucher_id = first_line.voucher_id
  WHERE v.company_id = ? AND v.is_active = TRUE
  ORDER BY v.voucher_date ASC, CAST(v.voucher_no AS UNSIGNED) ASC
`;

// 전표 상세 조회 (헤더)
const FIND_VOUCHER_BY_ID = `
  SELECT
    v.*,
    c.client_code,
    c.client_name,
    c.business_number
  FROM sales_purchase_vouchers v
  LEFT JOIN clients c ON v.client_id = c.client_id
  WHERE v.voucher_id = ? AND v.is_active = TRUE
`;

// 전표 라인 조회
const FIND_VOUCHER_LINES = `
  SELECT
    l.*,
    a.account_code,
    a.account_name
  FROM sales_purchase_voucher_lines l
  LEFT JOIN accounts a ON l.account_id = a.account_id
  WHERE l.voucher_id = ?
  ORDER BY l.line_no
`;

// 전표번호 생성용 (해당 날짜의 마지막 번호 조회 - 매출/매입 구분 없이)
const GET_LAST_VOUCHER_NO = `
  SELECT voucher_no
  FROM sales_purchase_vouchers
  WHERE company_id = ?
    AND voucher_date = ?
    AND is_active = TRUE
  ORDER BY CAST(voucher_no AS UNSIGNED) DESC
  LIMIT 1
`;

// 전표 수정 (헤더)
const UPDATE_VOUCHER = `
  UPDATE sales_purchase_vouchers
  SET voucher_date = ?,
      voucher_type = ?,
      client_id = ?,
      tax_invoice_yn = ?,
      tax_invoice_no = ?,
      total_supply_amount = ?,
      total_vat_amount = ?,
      total_amount = ?,
      status = ?
  WHERE voucher_id = ?
`;

// 전표 라인 삭제 (수정 시)
const DELETE_VOUCHER_LINES = `
  DELETE FROM sales_purchase_voucher_lines
  WHERE voucher_id = ?
`;

// 전표 삭제 (비활성화)
const DELETE_VOUCHER = `
  UPDATE sales_purchase_vouchers
  SET is_active = FALSE
  WHERE voucher_id = ?
`;

// 기간별 조회
const FIND_VOUCHERS_BY_DATE_RANGE = `
  SELECT
    v.voucher_id,
    v.company_id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_no,
    v.client_id,
    c.client_code,
    c.client_name,
    c.business_number,
    v.tax_invoice_yn,
    v.tax_invoice_no,
    v.total_supply_amount,
    v.total_vat_amount,
    v.total_amount,
    v.status,
    v.created_by,
    v.created_at,
    first_line.account_code,
    first_line.account_name,
    first_line.description_code,
    first_line.description
  FROM sales_purchase_vouchers v
  LEFT JOIN clients c ON v.client_id = c.client_id
  LEFT JOIN (
    SELECT
      l.voucher_id,
      a.account_code,
      a.account_name,
      l.description_code,
      l.description
    FROM sales_purchase_voucher_lines l
    JOIN accounts a ON l.account_id = a.account_id
    WHERE l.line_no = 1
  ) first_line ON v.voucher_id = first_line.voucher_id
  WHERE v.company_id = ?
    AND v.voucher_date BETWEEN ? AND ?
    AND v.is_active = TRUE
  ORDER BY v.voucher_date ASC, CAST(v.voucher_no AS UNSIGNED) ASC
`;

module.exports = {
  CREATE_VOUCHER,
  CREATE_VOUCHER_LINE,
  FIND_VOUCHERS_BY_COMPANY,
  FIND_VOUCHER_BY_ID,
  FIND_VOUCHER_LINES,
  GET_LAST_VOUCHER_NO,
  UPDATE_VOUCHER,
  DELETE_VOUCHER_LINES,
  DELETE_VOUCHER,
  FIND_VOUCHERS_BY_DATE_RANGE
};
