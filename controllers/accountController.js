const accountService = require('../services/accountService');
const accountModel = require('../models/accountModel')

// 회사별 계정과목 조회
async function getAccountsByCompany(req, res) {
  try {
    const userId = req.user.userId;
    const companyId = req.query.companyId || req.user.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: '회사 ID가 필요합니다'
      });
    }

    const accounts = await accountService.getAccountsByCompany(
      userId,
      parseInt(companyId)
    );

    res.status(200).json({
      success: true,
      accounts
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

// 계정과목 추가
async function createAccount(req, res) {
  try {
    const userId = req.user.userId;
    const accountData = req.body;
    
    const result = await accountService.createAccount(userId, accountData);
    
    res.status(201).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 계정과목 수정
async function updateAccount(req, res) {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const accountData = req.body;
    
    const result = await accountService.updateAccount(
      userId, 
      parseInt(accountId), 
      accountData
    );
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 계정과목 삭제
async function deleteAccount(req, res) {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    
    const result = await accountService.deleteAccount(
      userId, 
      parseInt(accountId)
    );
    
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 계정코드 중복 확인
async function checkAccountCode(req, res) {
  try {
    const { companyId, accountCode } = req.query;

    if (!companyId || !accountCode) {
      return res.status(400).json({
        error: '회사 ID와 계정코드가 필요합니다'
      });
    }

    const exists = await accountModel.checkAccountCode(
      parseInt(companyId),
      accountCode
    );

    res.status(200).json({
      exists
    });

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}


module.exports = {
  getAccountsByCompany,
  createAccount,
  updateAccount,
  deleteAccount,
  checkAccountCode
};