module.exports = {
  // 회사등록 (회원가입시-admin 체크)
  CREATE_COMPANY: `
    INSERT INTO companies (business_number, company_name, ceo_name, address, tel, industry, fiscal_year_end) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  // 사업자번호로 회사 찾기 (중복 체크)
  FIND_BY_BUSINESS_NUMBER: `
    SELECT company_id, company_name, business_number, ceo_name 
    FROM companies 
    WHERE business_number = ?
  `,
  
  // 회사-사용자 연결 생성
  CREATE_COMPANY_USER: `
    INSERT INTO company_users (company_id, user_id, role, status) 
    VALUES (?, ?, ?, ?)
  `,
  
  // 회사명으로 검색 (일반 직원용)
  SEARCH_COMPANIES: `
    SELECT company_id, company_name, business_number, ceo_name 
    FROM companies 
    WHERE company_name LIKE ? OR business_number LIKE ?
    LIMIT 10
  `,

  // 회사 등록 여부 확인
  FIND_USER_COMPANIES: `
    SELECT company_id 
    FROM company_users 
    WHERE user_id = ? AND status = 'APPROVED'
  `,

  CHECK_USER_COMPANY_REQUEST: `
    SELECT * 
    FROM company_users 
    WHERE user_id = ? AND company_id = ?
  `,

   // 사용자의 모든 회사 조회 (승인 여부 상관없이)
  FIND_ALL_USER_COMPANIES: `
    SELECT 
      cu.company_user_id,
      cu.company_id,
      cu.role,
      cu.status,
      cu.approved_at,
      c.company_name,
      c.business_number,
      c.ceo_name
    FROM company_users cu
    JOIN companies c ON cu.company_id = c.company_id
    WHERE cu.user_id = ?
    ORDER BY cu.approved_at DESC, cu.joined_at DESC
  `,
    // 가입 신청 목록 (PENDING만)
  FIND_PENDING_REQUESTS: `
    SELECT 
      cu.company_user_id,
      cu.user_id,
      cu.joined_at,
      u.name,
      u.email,
      u.phone
    FROM company_users cu
    JOIN users u ON cu.user_id = u.user_id
    WHERE cu.company_id = ? AND cu.status = 'PENDING'
    ORDER BY cu.joined_at DESC
  `,
  
  // 승인된 직원 목록 (APPROVED만)
  FIND_APPROVED_EMPLOYEES: `
    SELECT 
      cu.company_user_id,
      cu.user_id,
      cu.role,
      cu.approved_at,
      u.name,
      u.email,
      u.phone
    FROM company_users cu
    JOIN users u ON cu.user_id = u.user_id
    WHERE cu.company_id = ? AND cu.status = 'APPROVED'
    ORDER BY cu.approved_at DESC
  `,
  
  // 거절/퇴사 목록 (REJECTED만)
  FIND_REJECTED_EMPLOYEES: `
    SELECT 
      cu.company_user_id,
      cu.user_id,
      cu.joined_at,
      cu.approved_at,
      u.name,
      u.email,
      u.phone
    FROM company_users cu
    JOIN users u ON cu.user_id = u.user_id
    WHERE cu.company_id = ? AND cu.status = 'REJECTED'
    ORDER BY cu.approved_at DESC
  `,
  
  // 가입 신청 승인/거절
  UPDATE_REQUEST_STATUS: `
    UPDATE company_users 
    SET status = ?, approved_by = ?, approved_at = NOW()
    WHERE company_user_id = ?
  `,

  // 직원 역할 변경
  UPDATE_EMPLOYEE_ROLE: `
    UPDATE company_users 
    SET role = ? 
    WHERE company_user_id = ?
  `
};

