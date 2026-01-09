const settlementService = require('../services/settlementService');

// 결산전표 데이터 조회
async function getSettlementVoucherData(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.getSettlementVoucherData(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '결산전표 데이터 조회 중 오류가 발생했습니다'
    });
  }
}

// 결산전표 생성
async function createSettlementVoucher(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;
    const { inventory } = req.body;

    const result = await settlementService.createSettlementVoucher(
      parseInt(companyId),
      parseInt(fiscalYear),
      inventory
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '결산전표 생성 중 오류가 발생했습니다'
    });
  }
}

// 제조원가명세서 조회
async function getManufacturingCost(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;
    const { codeRange } = req.query;

    const result = await settlementService.getManufacturingCostData(
      parseInt(companyId),
      parseInt(fiscalYear),
      codeRange || '500'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '제조원가명세서 조회 중 오류가 발생했습니다'
    });
  }
}

// 제조원가 결산 실행
async function executeManufacturingCostSettlement(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;
    const { codeRange } = req.body;

    const result = await settlementService.executeManufacturingCostSettlement(
      parseInt(companyId),
      parseInt(fiscalYear),
      codeRange || '500'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '제조원가 결산 중 오류가 발생했습니다'
    });
  }
}

// 손익계산서 조회
async function getIncomeStatement(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.getIncomeStatementData(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '손익계산서 조회 중 오류가 발생했습니다'
    });
  }
}

// 손익계산 결산 실행
async function executeIncomeStatementSettlement(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.executeIncomeStatementSettlement(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '손익계산 결산 중 오류가 발생했습니다'
    });
  }
}

// 이익잉여금처분계산서 조회
async function getRetainedEarnings(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.getRetainedEarningsData(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '이익잉여금처분계산서 조회 중 오류가 발생했습니다'
    });
  }
}

// 이익잉여금 처분 결산 실행
async function executeRetainedEarningsSettlement(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;
    const { currentDisposalDate, previousDisposalDate } = req.body;

    const result = await settlementService.executeRetainedEarningsSettlement(
      parseInt(companyId),
      parseInt(fiscalYear),
      currentDisposalDate,
      previousDisposalDate
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '이익잉여금 처분 결산 중 오류가 발생했습니다'
    });
  }
}

// 대차대조표 조회
async function getBalanceSheet(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.getBalanceSheetData(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '대차대조표 조회 중 오류가 발생했습니다'
    });
  }
}

// 합계잔액시산표 조회
async function getTrialBalance(req, res) {
  try {
    const { companyId, fiscalYear } = req.params;

    const result = await settlementService.getTrialBalanceData(
      parseInt(companyId),
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || '합계잔액시산표 조회 중 오류가 발생했습니다'
    });
  }
}

module.exports = {
  getSettlementVoucherData,
  createSettlementVoucher,
  getManufacturingCost,
  executeManufacturingCostSettlement,
  getIncomeStatement,
  executeIncomeStatementSettlement,
  getRetainedEarnings,
  executeRetainedEarningsSettlement,
  getBalanceSheet,
  getTrialBalance
};
