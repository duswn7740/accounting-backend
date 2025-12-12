const db = require('../config/database');
const queries = require('../queries/clientQueries');

async function findClientsByCompany(companyId) {
  const [rows] = await db.query(queries.FIND_CLIENTS_BY_COMPANY, [companyId]);
  return rows;
}

async function findClientsByCategory(companyId, category) {
  const [rows] = await db.query(queries.FIND_CLIENTS_BY_CATEGORY, [companyId, category]);
  return rows;
}

async function createClient(clientData) {
  const {
    companyId, clientCode, clientName, category, accountNumber,
    businessNumber, ceoName, tel, email, address
  } = clientData;

  const [result] = await db.query(
    queries.CREATE_CLIENT,
    [companyId, clientCode, clientName, category, accountNumber,
     businessNumber, ceoName, tel, email, address]
  );

  return result.insertId;
}

async function checkClientCode(companyId, clientCode, category) {
  const [rows] = await db.query(queries.CHECK_CLIENT_CODE, [companyId, clientCode, category]);
  return rows.length > 0;
}

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
    throw new Error('유효하지 않은 거래처 유형입니다');
  }

  // 해당 카테고리의 모든 거래처 코드 조회
  const [rows] = await db.query(queries.GET_NEXT_CLIENT_CODE, [companyId, category]);

  if (rows.length === 0) {
    return String(startNum);
  }

  // 현재 사용 중인 코드들을 Set으로 저장
  const usedCodes = new Set(rows.map(row => parseInt(row.client_code)));

  // 빈 코드 찾기 (범위 내에서)
  for (let code = startNum; code <= endNum; code++) {
    if (!usedCodes.has(code)) {
      return String(code).padStart(5, '0');
    }
  }

  throw new Error(`${category} 거래처 코드가 가득 찼습니다 (최대: ${endNum})`);
}

// 거래처 상세 조회
async function findClientById(clientId) {
  const [rows] = await db.query(queries.FIND_CLIENT_BY_ID, [clientId]);
  return rows[0];
}

async function updateClient(clientId, clientData) {
  const {
    clientName, category, accountNumber, businessNumber,
    ceoName, tel, email, address
  } = clientData;

  await db.query(
    queries.UPDATE_CLIENT,
    [clientName, category, accountNumber, businessNumber,
     ceoName, tel, email, address, clientId]
  );
}

// 거래처 삭제 (비활성화)
async function deleteClient(clientId) {
  await db.query(queries.DELETE_CLIENT, [clientId]);
}

module.exports = {
  findClientsByCompany,
  findClientsByCategory,
  findClientById,
  createClient,
  updateClient,
  deleteClient,
  checkClientCode,
  getNextClientCode
};