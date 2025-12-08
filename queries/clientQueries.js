module.exports = {
  // 거래처 코드 중복 확인
  FIND_EXISTING_CODES: `
    SELECT client_code 
    FROM clients 
    WHERE company_id = ? 
    AND CAST(client_code AS UNSIGNED) BETWEEN ? AND ?
    ORDER BY CAST(client_code AS UNSIGNED)
  `,

  // 거래처 코드 중복 확인
  CHECK_CLIENT_CODE: `
    SELECT client_id FROM clients 
    WHERE company_id = ? AND client_code = ?
  `,
  
  // 거래처 등록
  CREATE_CLIENT: `
    INSERT INTO clients (
      company_id, client_code, client_name, business_number, 
      ceo_name, tel, email, address, client_type, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  // 거래처 목록 조회
  FIND_CLIENTS_BY_CATEGORY: `
    SELECT * FROM clients 
    WHERE company_id = ? AND category = ? AND is_active = TRUE
    ORDER BY client_code
  `,
  
  // 거래처 상세 조회
  FIND_CLIENT_BY_ID: `
    SELECT * FROM clients WHERE client_id = ?
  `,
  
  // 거래처 수정
  UPDATE_CLIENT: `
    UPDATE clients 
    SET client_name = ?, business_number = ?, ceo_name = ?, 
        tel = ?, email = ?, address = ?, client_type = ?
    WHERE client_id = ?
  `,
  
  // 거래처 삭제 (비활성화)
  DELETE_CLIENT: `
    UPDATE clients SET is_active = FALSE WHERE client_id = ?
  `
};