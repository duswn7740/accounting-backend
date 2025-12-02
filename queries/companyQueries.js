module.exports = {
  // 회사등록 (회원가입시-admin 체크)
  CREATE_COMPANIES: `
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
  `

}