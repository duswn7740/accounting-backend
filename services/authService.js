const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const companyModel = require('../models/companyModel');  
const { validateEmail, validatePassword, validateLoginInput, formatPhoneNumber } = require('../utils/validators');

// 일반 회원가입
async function register(userData) {
  const { email, password, name, phone, userType } = userData;
  
  // 유효성 검사 (함수로 분리!)
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  
  if (!name || !name.trim()) {
    throw new Error('이름은 필수항목입니다');
  }
  
  const formattedPhone = formatPhoneNumber(phone);
  
  // 이메일 중복 체크
  const existingUser = await userModel.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('이미 존재하는 이메일입니다');
  }
  
  // 비밀번호 암호화
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 사용자 생성
  const newUser = await userModel.createUser(
    normalizedEmail, 
    hashedPassword, 
    name, 
    formattedPhone,
    userType
  );
  
  delete newUser.password;
  return newUser;
}

// 이메일 중복 체크
async function checkEmail(email) {
  const normalizedEmail = validateEmail(email);
  
  const existingUser = await userModel.findByEmail(normalizedEmail);
  return !existingUser;
}

// 로그인
async function login(email, password) {
  // 1. 유효성 검사
  const { email: normalizedEmail, password: validPassword } = validateLoginInput(email, password);
  
  // 2. 사용자 찾기
  const user = await userModel.findByEmail(normalizedEmail);

  if (!user) {
    throw new Error('이메일 또는 비밀번호가 일치하지 않습니다');
  }
  
  // 3. 비밀번호 확인
  const isPasswordValid = await bcrypt.compare(validPassword, user.password);
  if (!isPasswordValid) {
    throw new Error('이메일 또는 비밀번호가 일치하지 않습니다');
  }
  
  // 4. 활성 계정 확인
  if (!user.isActive) {
    throw new Error('비활성화된 계정입니다');
  }

  // 5. 회사 연결 여부 확인 (추가!)
  const companies = await companyModel.findUserCompanies(user.userId);
  const hasCompany = companies.length > 0;
  const companyId = hasCompany ? companies[0].company_id : null;
  
  // 6. JWT 토큰 생성
  const token = jwt.sign(
    { 
      userId: user.userId,
      email: user.email,
      userType: user.userType
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  // 6. 사용자 정보 반환 (비밀번호 제외)
  return {
    token,
    user: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      hasCompany: hasCompany,
      companyId: companyId
    }
  };
}

module.exports = {
  register,
  checkEmail,
  login
};