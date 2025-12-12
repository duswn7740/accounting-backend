// 회사별 전체 거래처 조회
const FIND_CLIENTS_BY_COMPANY = `
  SELECT
    client_id,
    company_id,
    client_code,
    client_name,
    category,
    account_number,
    business_number,
    ceo_name,
    tel,
    email,
    address,
    is_active,
    created_at,
    updated_at
  FROM clients
  WHERE company_id = ? AND is_active = TRUE
  ORDER BY client_code
`;

// 카테고리별 거래처 조회
const FIND_CLIENTS_BY_CATEGORY = `
  SELECT
    client_id,
    company_id,
    client_code,
    client_name,
    category,
    account_number,
    business_number,
    ceo_name,
    tel,
    email,
    address,
    is_active,
    created_at,
    updated_at
  FROM clients
  WHERE company_id = ? AND category = ? AND is_active = TRUE
  ORDER BY client_code
`;

const CREATE_CLIENT = `
  INSERT INTO clients (
    company_id, client_code, client_name, category, account_number,
    business_number, ceo_name, tel, email, address
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_CLIENT = `
  UPDATE clients
  SET client_name = ?, category = ?, account_number = ?,
      business_number = ?, ceo_name = ?,
      tel = ?, email = ?, address = ?
  WHERE client_id = ?
`;

// 나머지는 동일
const FIND_CLIENT_BY_ID = `
  SELECT * FROM clients WHERE client_id = ?
`;

const DELETE_CLIENT = `
  UPDATE clients SET is_active = FALSE WHERE client_id = ?
`;

const CHECK_CLIENT_CODE = `
  SELECT client_id FROM clients
  WHERE company_id = ? AND client_code = ? AND category = ? AND is_active = TRUE
`;

const GET_NEXT_CLIENT_CODE = `
  SELECT client_code FROM clients
  WHERE company_id = ? AND category = ? AND is_active = TRUE
  ORDER BY CAST(client_code AS UNSIGNED) ASC
`;

module.exports = {
  FIND_CLIENTS_BY_COMPANY,
  FIND_CLIENTS_BY_CATEGORY,
  FIND_CLIENT_BY_ID,
  CREATE_CLIENT,
  UPDATE_CLIENT,
  DELETE_CLIENT,
  CHECK_CLIENT_CODE,
  GET_NEXT_CLIENT_CODE
};
