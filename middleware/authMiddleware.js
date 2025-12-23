const jwt = require('jsonwebtoken');

// JWT 토큰 검증 미들웨어
function authMiddleware(req, res, next) {
  try {
    // 1. 헤더에서 토큰 가져오기
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: '인증 토큰이 없습니다'
      });
    }

    // 2. "Bearer " 제거하고 토큰만 추출
    const token = authHeader.substring(7);

    // 3. 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. req.user에 저장 (Controller에서 사용 가능)
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType,
      companyId: decoded.companyId
    };

    // 5. 다음 단계로 (Controller 실행)
    next();

  } catch (error) {

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '토큰이 만료되었습니다'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '유효하지 않은 토큰입니다'
      });
    }

    return res.status(401).json({
      error: '인증에 실패했습니다'
    });
  }
}

module.exports = authMiddleware;