const db = require('../config/database');
const queries = require('../queries/userQueries');

// 이메일로 사용자 찾기 (로그인용)
async function findByEmail(email) {
  const [rows] = await db.query(queries.FIND_BY_EMAIL, [email]);
  const user = rows[0];
  
  if (!user) return null;
  
  // snake_case → camelCase 변환
  return {
    userId: user.user_id,
    email: user.email,
    password: user.password,  // 로그인 시 bcrypt 비교용
    name: user.name,
    phone: user.phone,
    userType: user.user_type,
    isActive: user.is_active
  };
}

// 사용자 생성
async function createUser(email, password, name, phone, userType) {
  const [result] = await db.query(queries.CREATE_USER, [
    email, 
    password, 
    name, 
    phone,
    userType
  ]);
  
  return {
    userId: result.insertId,
    email,
    name,
    phone,
    userType
  };
}

// ID로 사용자 찾기
async function findById(userId) {
  const [rows] = await db.query(queries.FIND_BY_ID, [userId]);
  const user = rows[0];
  
  if (!user) return null;
  
  return {
    userId: user.user_id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    userType: user.user_type,
    isActive: user.is_active,
    createdAt: user.created_at
  };
}

module.exports = {
  findByEmail,
  createUser,
  findById
};