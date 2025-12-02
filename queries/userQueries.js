module.exports = {
  // 이메일로 사용자 찾기 (회원가입시 중복체크, 로그인 시 비밀번호 비교)
  FIND_BY_EMAIL: `
    SELECT user_id, email, password, name, phone, user_type, is_active 
    FROM users 
    WHERE email = ?
  `,
  
  // 사용자 생성 (회원가입 - 직원)
  CREATE_USER: `
    INSERT INTO users (email, password, name, phone, user_type) 
    VALUES (?, ?, ?, ?, ?)
  `,

  // 사용자 ID로 조회 (jwt토큰 검증 후 사용자 정보 가져오기, 내 정보 조회 api)
  FIND_BY_ID: `
    SELECT user_id, email, name, phone, is_active, created_at 
    FROM users 
    WHERE user_id = ?
  `
};