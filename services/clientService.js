const clientModel = require('../models/clientModel');
const companyModel = require('../models/companyModel');
const db = require('../config/database');

// 거래처 등록
async function createClient(userId, clientData) {
  // 1. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === clientData.companyId && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('거래처 등록 권한이 없습니다');
  }
  
  // 2. 거래처 코드 처리
  let clientCode;
  
  if (clientData.clientCode) {
    // 수동 입력한 코드가 있으면 사용
    clientCode = clientData.clientCode;
  } else {
    // 없으면 자동 생성
    clientCode = await clientModel.getNextClientCode(clientData.companyId, clientData.category);
  }
  
  // 3. 거래처 등록
  const clientId = await clientModel.createClient({
    ...clientData,
    clientCode
  });
  
  return {
    message: '거래처가 등록되었습니다',
    clientId,
    clientCode
  };
}

// 거래처 목록 조회 (ACCOUNTANT, ADMIN, VIEWER 모두 가능)
async function getClientsByCategory(userId, companyId, category) {
  // 1. 권한 확인 (해당 회사 소속인지)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  // 2. 거래처 목록 조회
  const clients = await clientModel.findClientsByCategory(companyId, category);

  return { clients };
}

// 회사별 전체 거래처 조회
async function getClientsByCompany(userId, companyId) {
  // 1. 권한 확인 (해당 회사 소속인지)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );

  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }

  // 2. 거래처 목록 조회
  const clients = await clientModel.findClientsByCompany(companyId);

  return { clients };
}

// 거래처 상세 조회
async function getClientById(userId, clientId) {
  // 1. 거래처 조회
  const client = await clientModel.findClientById(clientId);
  
  if (!client) {
    throw new Error('존재하지 않는 거래처입니다');
  }
  
  // 2. 권한 확인 (해당 회사 소속인지)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === client.company_id && c.status === 'APPROVED'
  );
  
  if (!userRole) {
    throw new Error('해당 회사에 접근 권한이 없습니다');
  }
  
  return client;
}

// 거래처 수정
async function updateClient(userId, clientId, clientData) {
  // 1. 거래처 조회
  const client = await clientModel.findClientById(clientId);
  
  if (!client) {
    throw new Error('존재하지 않는 거래처입니다');
  }
  
  // 2. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === client.company_id && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('거래처 수정 권한이 없습니다');
  }
  
  // 3. 거래처 수정
  await clientModel.updateClient(clientId, clientData);
  
  return {
    message: '거래처가 수정되었습니다'
  };
}

// 거래처 삭제
async function deleteClient(userId, clientId) {
  // 1. 거래처 조회
  const client = await clientModel.findClientById(clientId);
  
  if (!client) {
    throw new Error('존재하지 않는 거래처입니다');
  }
  
  // 2. 권한 확인 (ACCOUNTANT만 가능)
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === client.company_id && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('거래처 삭제 권한이 없습니다');
  }
  
  // 3. 거래처 삭제 (비활성화)
  await clientModel.deleteClient(clientId);
  
  return {
    message: '거래처가 삭제되었습니다'
  };
}

// 거래처 코드 중복 확인
async function checkClientCode(userId, companyId, clientCode, category) {
  // 1. 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('권한이 없습니다');
  }
  
  // 2. 카테고리 범위 확인
  const code = parseInt(clientCode);
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
  }
  
  if (code < startNum || code > endNum) {
    throw new Error(`${category} 거래처 코드는 ${String(startNum).padStart(5, '0')}~${String(endNum).padStart(5, '0')} 범위여야 합니다`);
  }
  
  // 3. 중복 확인
  const isDuplicated = await clientModel.checkClientCode(companyId, clientCode, category);

  return {
    available: !isDuplicated,
    message: isDuplicated ? '이미 사용 중인 코드입니다' : '사용 가능한 코드입니다'
  };
}

// 다음 거래처 코드 조회 (자동 생성용)
async function getNextClientCode(userId, companyId, category) {
  // 1. 권한 확인
  const userCompanies = await companyModel.findAllUserCompanies(userId);
  const userRole = userCompanies.find(
    c => c.companyId === companyId && c.status === 'APPROVED'
  );
  
  if (!userRole || userRole.role !== 'ACCOUNTANT') {
    throw new Error('권한이 없습니다');
  }
  
  // 2. 다음 코드 생성
  const nextCode = await clientModel.getNextClientCode(companyId, category);
  
  return {
    clientCode: nextCode
  };
}


module.exports = {
  createClient,
  getClientsByCategory,
  getClientsByCompany,
  getClientById,
  updateClient,
  deleteClient,
  checkClientCode,
  getNextClientCode
};