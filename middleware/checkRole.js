// 특정 userType만 허용하는 미들웨어
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    // authMiddleware를 먼저 거쳐야 req.user가 있음!
    if (!req.user) {
      return res.status(401).json({
        error: '인증이 필요합니다'
      });
    }
    
    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        error: '권한이 없습니다'
      });
    }
    
    next();
  };
}

module.exports = checkRole;