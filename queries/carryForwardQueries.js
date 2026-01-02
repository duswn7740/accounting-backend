// 이월잔액 관련 쿼리

// 계정별 이월잔액 조회
const GET_ACCOUNT_CARRY_FORWARD = `
  SELECT
    balance_id,
    company_id,
    fiscal_year,
    account_id,
    debit_balance,
    credit_balance,
    created_at
  FROM carry_forward_balances
  WHERE company_id = ?
    AND fiscal_year = ?
    AND account_id = ?
    AND client_id IS NULL
`;

// 거래처별 이월잔액 조회
const GET_CLIENT_CARRY_FORWARD = `
  SELECT
    balance_id,
    company_id,
    fiscal_year,
    account_id,
    client_id,
    debit_balance,
    credit_balance,
    created_at
  FROM carry_forward_balances
  WHERE company_id = ?
    AND fiscal_year = ?
    AND client_id = ?
`;

// 특정 계정+거래처 이월잔액 조회
const GET_ACCOUNT_CLIENT_CARRY_FORWARD = `
  SELECT
    balance_id,
    company_id,
    fiscal_year,
    account_id,
    client_id,
    debit_balance,
    credit_balance,
    created_at
  FROM carry_forward_balances
  WHERE company_id = ?
    AND fiscal_year = ?
    AND account_id = ?
    AND client_id = ?
`;

// 이월잔액 생성
const CREATE_CARRY_FORWARD = `
  INSERT INTO carry_forward_balances
  (company_id, fiscal_year, account_id, client_id, debit_balance, credit_balance)
  VALUES (?, ?, ?, ?, ?, ?)
`;

// 이월잔액 수정
const UPDATE_CARRY_FORWARD = `
  UPDATE carry_forward_balances
  SET debit_balance = ?,
      credit_balance = ?
  WHERE balance_id = ?
`;

// 이월잔액 삭제
const DELETE_CARRY_FORWARD = `
  DELETE FROM carry_forward_balances
  WHERE balance_id = ?
`;

// 회계기수별 모든 이월잔액 조회 (계정별)
const GET_ALL_ACCOUNT_CARRY_FORWARDS = `
  SELECT
    cfb.balance_id,
    cfb.company_id,
    cfb.fiscal_year,
    cfb.account_id,
    cfb.debit_balance,
    cfb.credit_balance,
    a.account_code,
    a.account_name
  FROM carry_forward_balances cfb
  LEFT JOIN accounts a ON cfb.account_id = a.account_id
  WHERE cfb.company_id = ?
    AND cfb.fiscal_year = ?
    AND cfb.client_id IS NULL
  ORDER BY a.account_code
`;

// 회계기수별 모든 이월잔액 조회 (거래처별)
const GET_ALL_CLIENT_CARRY_FORWARDS = `
  SELECT
    cfb.balance_id,
    cfb.company_id,
    cfb.fiscal_year,
    cfb.account_id,
    cfb.client_id,
    cfb.debit_balance,
    cfb.credit_balance,
    a.account_code,
    a.account_name,
    c.client_code,
    c.client_name
  FROM carry_forward_balances cfb
  LEFT JOIN accounts a ON cfb.account_id = a.account_id
  LEFT JOIN clients c ON cfb.client_id = c.client_id
  WHERE cfb.company_id = ?
    AND cfb.fiscal_year = ?
    AND cfb.client_id IS NOT NULL
  ORDER BY a.account_code, c.client_code
`;

module.exports = {
  GET_ACCOUNT_CARRY_FORWARD,
  GET_CLIENT_CARRY_FORWARD,
  GET_ACCOUNT_CLIENT_CARRY_FORWARD,
  CREATE_CARRY_FORWARD,
  UPDATE_CARRY_FORWARD,
  DELETE_CARRY_FORWARD,
  GET_ALL_ACCOUNT_CARRY_FORWARDS,
  GET_ALL_CLIENT_CARRY_FORWARDS
};
