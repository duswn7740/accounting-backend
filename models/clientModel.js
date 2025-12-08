const db = require('../config/database');
const queries = require('../queries/clientQueries');

async function checkClientCode(companyId, clientCode) {
  const [rows] = await db.query(queries.CHECK_CLIENT_CODE, [companyId, clientCode]);
  return rows.length > 0;
}

// 다음 거래처 코드 생성
async function getNextClientCode(companyId, category) {
  let startNum, endNum;

  if (category === '일반') {
    startNum = 101;
    endNum = 97999;
  } else if (category === '은행') {
    startNum = 98000;
    endNum = 99599;
  } else if (category === '카드') {
    startNum = 99600;
    endNum = 99999;
  } else {
    throw new Error('잘못된 카테고리입니다');
  }

  // 해당 범위 내의 모든 코드 조회 (오름차순)
  const [existing] = await db.query(
    `SELECT client_code FROM clients 
     WHERE company_id = ? 
     AND CAST(client_code AS UNSIGNED) BETWEEN ? AND ?
     AND is_active = TRUE
     ORDER BY CAST(client_code AS UNSIGNED) ASC`,
    [companyId, startNum, endNum]
  );
  
  // 거래처가 없으면 시작 번호 반환
  if (existing.length === 0) {
    return String(startNum).padStart(5, '0');
  }
  
  // 빈 번호 찾기 (가장 작은 번호부터)
  const usedCodes = existing.map(row => parseInt(row.client_code));
  
  for (let i = startNum; i <= endNum; i++) {
    if (!usedCodes.includes(i)) {
      return String(i).padStart(5, '0');
    }
  }
  
  throw new Error('사용 가능한 거래처 코드가 없습니다');
}

// 거래처 등록
async function createClient(clientData) {
  const [result] = await db.query(queries.CREATE_CLIENT, [
    clientData.companyId,
    clientData.clientCode,
    clientData.clientName,
    clientData.businessNumber,
    clientData.ceoName,
    clientData.tel,
    clientData.email,
    clientData.address,
    clientData.clientType,
    clientData.category
  ]);
  
  return result.insertId;
}

// 카테고리별 거래처 목록 조회
async function findClientsByCategory(companyId, category) {
  const [rows] = await db.query(queries.FIND_CLIENTS_BY_CATEGORY, [companyId, category]);
  return rows;
}

// 거래처 상세 조회
async function findClientById(clientId) {
  const [rows] = await db.query(queries.FIND_CLIENT_BY_ID, [clientId]);
  return rows[0];
}

// 거래처 수정
async function updateClient(clientId, clientData) {
  await db.query(queries.UPDATE_CLIENT, [
    clientData.clientName,
    clientData.businessNumber,
    clientData.ceoName,
    clientData.tel,
    clientData.email,
    clientData.address,
    clientData.clientType,
    clientId
  ]);
}

// 거래처 삭제 (비활성화)
async function deleteClient(clientId) {
  await db.query(queries.DELETE_CLIENT, [clientId]);
}

module.exports = {
  getNextClientCode,
  checkClientCode,
  createClient,
  findClientsByCategory,
  findClientById,
  updateClient,
  deleteClient
};