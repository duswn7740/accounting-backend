// 이메일 검사
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    throw new Error('이메일을 입력해주세요');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('올바른 이메일 형식이 아닙니다');
  }
  
  return email.toLowerCase().trim();
};

// 비밀번호 검사
export const validatePassword = (password) => {
  if (!password) {
    throw new Error('비밀번호는 필수항목입니다');
  }
  
  if (password.length < 8) {
    throw new Error('비밀번호는 8자 이상이어야 합니다');
  }
  
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
  if (!passwordRegex.test(password)) {
    throw new Error('비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다');
  }
  
  return password;
};

// 로그인용 간단 검사
export const validateLoginInput = (email, password) => {
  if (!email || !email.trim()) {
    throw new Error('이메일을 입력해주세요');
  }
  
  if (!password) {
    throw new Error('비밀번호를 입력해주세요');
  }
  
  return {
    email: email.toLowerCase().trim(),
    password
  };
};

// 전화번호 포맷팅
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  const phoneNumbers = phone.replace(/\D/g, '');
  
  if (phoneNumbers.length === 10) {
    return phoneNumbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  } else if (phoneNumbers.length === 11) {
    return phoneNumbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else {
    throw new Error('전화번호는 10자리 또는 11자리여야 합니다');
  }
};