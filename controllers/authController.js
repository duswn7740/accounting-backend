const authService = require('../services/authService');

// 회원가입
async function register(req, res) {
  try {
    // 1. 요청 데이터 받기
    const userData = req.body;
    // 2. Service 호출
    const newUser = await authService.register(userData);
    // 3. 성공 응답
    res.status(201).json({
      message: '회원가입 성공',
      user: newUser
    })
  } catch (error) {
    // 4. 에러 응답
    res.status(400).json({
      error:error.message
    })
  }
}

// 이메일 중복 체크
const checkEmail = async (req, res) => {
  try {
    const {email} = req.body;
    const isAvailable = await authService.checkEmail(email);

    res.status(200).json({
      available : isAvailable,
      message:isAvailable ? '사용 가능한 이메일입니다.' : '이미 사용중인 이메일입니다.'
    });
  } catch (error) {
    res.status(400).json ({
      error:error.message
    });
  }
}

// 로그인
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.status(200).json({
      message: '로그인 성공',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    res.status(401).json({
      error:error.message
    });
  }
}


module.exports = {
  register,
  checkEmail,
  login
};