const clientService = require('../services/clientService');

// 거래처 등록
async function createClient(req, res) {
  try {
    const userId = req.user.userId;
    const clientData = req.body;
    
    const result = await clientService.createClient(userId, clientData);
    
    res.status(201).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 거래처 목록 조회 (카테고리별 또는 전체)
async function getClientsByCategory(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId, category } = req.query;

    let result;
    if (category) {
      // 카테고리가 있으면 카테고리별 조회
      result = await clientService.getClientsByCategory(
        userId,
        parseInt(companyId),
        category
      );
    } else {
      // 카테고리가 없으면 전체 조회
      result = await clientService.getClientsByCompany(
        userId,
        parseInt(companyId)
      );
    }

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}


// 거래처 상세 조회
async function getClientById(req, res) {
  try {
    const userId = req.user.userId;
    const { clientId } = req.params;
    
    const client = await clientService.getClientById(userId, parseInt(clientId));
    
    res.status(200).json({
      client
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 거래처 수정
async function updateClient(req, res) {
  try {
    const userId = req.user.userId;
    const { clientId } = req.params;
    const clientData = req.body;
    
    const result = await clientService.updateClient(userId, parseInt(clientId), clientData);
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 거래처 삭제
async function deleteClient(req, res) {
  try {
    const userId = req.user.userId;
    const { clientId } = req.params;
    
    const result = await clientService.deleteClient(userId, parseInt(clientId));
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 거래처 코드 중복 확인
async function checkClientCode(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId, clientCode, category } = req.body;
    
    const result = await clientService.checkClientCode(
      userId, 
      parseInt(companyId), 
      clientCode,
      category
    );
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 다음 거래처 코드 조회
async function getNextClientCode(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId, category } = req.query;

    const result = await clientService.getNextClientCode(
      userId,
      parseInt(companyId),
      category
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

module.exports = {
  createClient,
  getClientsByCategory,
  getClientById,
  updateClient,
  deleteClient,
  checkClientCode,
  getNextClientCode
};