const db = require('../config/database');
const queries = require('../queries/companyQueries');

// 사용자의 승인된 회사 목록 조회
async function findUserCompanies(userId) {
  const [rows] = await db.query(queries.FIND_USER_COMPANIES, [userId]);
  return rows;
}

module.exports = {
  findUserCompanies
};