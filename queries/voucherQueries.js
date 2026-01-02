// 일반전표 조회 (회계기수별)
const FIND_VOUCHERS_BY_FISCAL_YEAR = `
  SELECT
    gv.voucher_id,
    gv.voucher_date,
    gv.voucher_no,
    gv.description,
    gv.total_debit,
    gv.total_credit,
    gv.status,
    gv.created_by,
    gv.created_at,
    u.name as creator_name
  FROM general_vouchers gv
  LEFT JOIN users u ON gv.created_by = u.user_id
  INNER JOIN fiscal_periods fp ON gv.company_id = fp.company_id
  WHERE gv.company_id = ?
    AND fp.fiscal_year = ?
    AND gv.voucher_date BETWEEN fp.start_date AND fp.end_date
  ORDER BY gv.voucher_date, gv.voucher_no
`;

// 일반전표 조회 (날짜 범위 - 호환성용)
const FIND_VOUCHERS_BY_DATE_RANGE = `
  SELECT
    gv.voucher_id,
    gv.voucher_date,
    gv.voucher_no,
    gv.description,
    gv.total_debit,
    gv.total_credit,
    gv.status,
    gv.created_by,
    gv.created_at,
    u.name as creator_name
  FROM general_vouchers gv
  LEFT JOIN users u ON gv.created_by = u.user_id
  WHERE gv.company_id = ?
    AND gv.voucher_date BETWEEN ? AND ?
  ORDER BY gv.voucher_date, gv.voucher_no
`;

// 전표 라인 조회
const FIND_VOUCHER_LINES_BY_VOUCHER = `
  SELECT 
    gvl.line_id,
    gvl.voucher_id,
    gvl.line_no,
    gvl.account_id,
    gvl.client_id,
    gvl.debit_amount,
    gvl.credit_amount,
    gvl.description,
    gvl.department_code,
    gvl.project_code,
    a.account_code,
    a.account_name,
    c.client_code,
    c.client_name
  FROM general_voucher_lines gvl
  LEFT JOIN accounts a ON gvl.account_id = a.account_id
  LEFT JOIN clients c ON gvl.client_id = c.client_id
  WHERE gvl.voucher_id = ?
  ORDER BY gvl.line_no
`;

// 전표 헤더 생성
const CREATE_VOUCHER = `
  INSERT INTO general_vouchers (
    company_id, voucher_date, voucher_no, description,
    total_debit, total_credit, status, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

// 전표 라인 생성
const CREATE_VOUCHER_LINE = `
  INSERT INTO general_voucher_lines (
    voucher_id, line_no, voucher_type, amount, description_code,
    account_id, client_id, debit_amount, credit_amount, description,
    department_code, project_code
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// 전표 라인 수정 (line_id 기준)
const UPDATE_VOUCHER_LINE = `
  UPDATE general_voucher_lines
  SET voucher_type = ?, amount = ?, description_code = ?,
      account_id = ?, client_id = ?,
      debit_amount = ?, credit_amount = ?,
      description = ?, department_code = ?, project_code = ?
  WHERE line_id = ?
`;

// 전표 라인 수정 (voucher_id + line_no 기준)
const UPDATE_VOUCHER_LINE_BY_NO = `
  UPDATE general_voucher_lines
  SET amount = ?, description_code = ?,
      account_id = ?, client_id = ?,
      debit_amount = ?, credit_amount = ?,
      description = ?, department_code = ?, project_code = ?
  WHERE voucher_id = ? AND line_no = ?
`;

// 전표 라인 삭제
const DELETE_VOUCHER_LINE = `
  DELETE FROM general_voucher_lines
  WHERE line_id = ?
`;

// 전표 헤더 수정 (합계 업데이트)
const UPDATE_VOUCHER_TOTALS = `
  UPDATE general_vouchers
  SET total_debit = ?, total_credit = ?
  WHERE voucher_id = ?
`;

// 전표 삭제
const DELETE_VOUCHER = `
  DELETE FROM general_vouchers
  WHERE voucher_id = ?
`;

// 전표번호 최대값 조회 (회계기수별)
const GET_MAX_VOUCHER_NO_BY_FISCAL_YEAR = `
  SELECT MAX(CAST(gv.voucher_no AS UNSIGNED)) as max_no
  FROM general_vouchers gv
  INNER JOIN fiscal_periods fp ON gv.company_id = fp.company_id
  WHERE gv.company_id = ?
    AND fp.fiscal_year = ?
    AND gv.voucher_date BETWEEN fp.start_date AND fp.end_date
`;

// 전표번호 최대값 조회 (자동생성용 - 호환성)
// 결산전표(YYYYMMDD-### 형식)는 제외하고, 3자리 숫자 형식(001, 002...)만 조회
const GET_MAX_VOUCHER_NO = `
  SELECT MAX(CAST(voucher_no AS UNSIGNED)) as max_no
  FROM general_vouchers
  WHERE company_id = ?
    AND voucher_date BETWEEN ? AND ?
    AND voucher_no NOT LIKE '%-%'
    AND voucher_no REGEXP '^[0-9]{1,3}$'
`;

// 특정 전표 조회
const FIND_VOUCHER_BY_ID = `
  SELECT *
  FROM general_vouchers
  WHERE voucher_id = ?
`;

// 회사의 전표 라인 목록 (회계기수별)
const FIND_ALL_VOUCHER_LINES_BY_FISCAL_YEAR = `
  SELECT
    gvl.line_id,
    gv.voucher_id,
    gv.voucher_date,
    gv.voucher_no,
    gvl.line_no,
    gvl.voucher_type,
    gvl.amount,
    gvl.description_code,
    gvl.account_id,
    gvl.client_id,
    gvl.debit_amount,
    gvl.credit_amount,
    gvl.description,
    a.account_code,
    a.account_name,
    c.client_code,
    c.client_name
  FROM general_voucher_lines gvl
  INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
  INNER JOIN fiscal_periods fp ON gv.company_id = fp.company_id
  LEFT JOIN accounts a ON gvl.account_id = a.account_id
  LEFT JOIN clients c ON gvl.client_id = c.client_id
  WHERE gv.company_id = ?
    AND fp.fiscal_year = ?
    AND gv.voucher_date BETWEEN fp.start_date AND fp.end_date
  ORDER BY gv.voucher_date, gv.voucher_no, gvl.line_no
`;

// 회사의 전표 라인 목록 (날짜 범위 - 호환성)
const FIND_ALL_VOUCHER_LINES_BY_DATE = `
  SELECT
    gvl.line_id,
    gv.voucher_id,
    gv.voucher_date,
    gv.voucher_no,
    gvl.line_no,
    gvl.voucher_type,
    gvl.amount,
    gvl.description_code,
    gvl.account_id,
    gvl.client_id,
    gvl.debit_amount,
    gvl.credit_amount,
    gvl.description,
    a.account_code,
    a.account_name,
    c.client_code,
    c.client_name
  FROM general_voucher_lines gvl
  INNER JOIN general_vouchers gv ON gvl.voucher_id = gv.voucher_id
  LEFT JOIN accounts a ON gvl.account_id = a.account_id
  LEFT JOIN clients c ON gvl.client_id = c.client_id
  WHERE gv.company_id = ?
    AND gv.voucher_date BETWEEN ? AND ?
  ORDER BY gv.voucher_date, gv.voucher_no, gvl.line_no
`;

module.exports = {
  FIND_VOUCHERS_BY_FISCAL_YEAR,
  FIND_VOUCHERS_BY_DATE_RANGE,
  FIND_VOUCHER_LINES_BY_VOUCHER,
  CREATE_VOUCHER,
  CREATE_VOUCHER_LINE,
  UPDATE_VOUCHER_LINE,
  UPDATE_VOUCHER_LINE_BY_NO,
  DELETE_VOUCHER_LINE,
  UPDATE_VOUCHER_TOTALS,
  DELETE_VOUCHER,
  GET_MAX_VOUCHER_NO_BY_FISCAL_YEAR,
  GET_MAX_VOUCHER_NO,
  FIND_VOUCHER_BY_ID,
  FIND_ALL_VOUCHER_LINES_BY_FISCAL_YEAR,
  FIND_ALL_VOUCHER_LINES_BY_DATE
};