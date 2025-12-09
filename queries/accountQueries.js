module.exports = {
  // 회사별 계정과목 조회
  FIND_ACCOUNTS_BY_COMPANY: `
    SELECT * FROM accounts 
    WHERE company_id = ? AND is_active = TRUE
    ORDER BY account_code
  `,
  
  // 계정과목 상세 조회
  FIND_ACCOUNT_BY_ID: `
    SELECT * FROM accounts WHERE account_id = ?
  `,
  
  // 계정과목 추가
  CREATE_ACCOUNT: `
    INSERT INTO accounts (
      company_id, account_code, account_name, account_type, 
      account_category, is_debit_normal, is_system, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  // 계정과목 수정
  UPDATE_ACCOUNT: `
    UPDATE accounts 
    SET account_name = ?, account_type = ?, account_category = ?, 
        is_debit_normal = ?, description = ?
    WHERE account_id = ?
  `,
  
  // 계정과목 삭제 (비활성화)
  DELETE_ACCOUNT: `
    UPDATE accounts SET is_active = FALSE WHERE account_id = ?
  `,
  
  // 계정코드 중복 확인
  CHECK_ACCOUNT_CODE: `
    SELECT account_id FROM accounts 
    WHERE company_id = ? AND account_code = ? AND is_active = TRUE
  `,
  
  // 시스템 기본 계정과목 복사
  COPY_SYSTEM_ACCOUNTS: `
    INSERT INTO accounts (
      company_id, account_code, account_name, account_type, 
      account_category, is_debit_normal, is_system, description
    )
    SELECT 
      ?, account_code, account_name, account_type, 
      account_category, is_debit_normal, TRUE, description
    FROM system_accounts
  `
};