const ledgerModel = require('../models/ledgerModel');

// 계정별 원장 조회
async function getAccountLedger(req, res) {
  try {
    const { companyId } = req.params;
    const filters = {
      startMonth: req.query.startMonth ? parseInt(req.query.startMonth) : null,
      startDay: req.query.startDay ? parseInt(req.query.startDay) : null,
      endMonth: req.query.endMonth ? parseInt(req.query.endMonth) : null,
      endDay: req.query.endDay ? parseInt(req.query.endDay) : null,
      startAccountCode: req.query.startAccountCode || null,
      endAccountCode: req.query.endAccountCode || null
    };

    const ledger = await ledgerModel.getAccountLedger(companyId, filters);

    res.json({
      success: true,
      ledger
    });
  } catch (error) {
    console.error('계정별 원장 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '계정별 원장 조회 중 오류가 발생했습니다'
    });
  }
}

// 계정 요약 조회
async function getAccountSummary(req, res) {
  try {
    const { companyId } = req.params;
    const filters = {
      startMonth: req.query.startMonth ? parseInt(req.query.startMonth) : null,
      startDay: req.query.startDay ? parseInt(req.query.startDay) : null,
      endMonth: req.query.endMonth ? parseInt(req.query.endMonth) : null,
      endDay: req.query.endDay ? parseInt(req.query.endDay) : null,
      startAccountCode: req.query.startAccountCode || null,
      endAccountCode: req.query.endAccountCode || null
    };

    const summary = await ledgerModel.getAccountSummary(companyId, filters);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('계정 요약 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '계정 요약 조회 중 오류가 발생했습니다'
    });
  }
}

// 전표 라인 수정
async function updateVoucherLine(req, res) {
  try {
    const { voucherType, voucherId, lineNo } = req.params;
    const { account_code, debit_credit, amount, description_code, description } = req.body;

    const result = await ledgerModel.updateVoucherLine(
      voucherType,
      voucherId,
      lineNo,
      {
        account_code,
        debit_credit,
        amount,
        description_code,
        description
      }
    );

    res.json({
      success: true,
      message: '전표 라인이 수정되었습니다'
    });
  } catch (error) {
    console.error('전표 라인 수정 실패:', error);
    res.status(500).json({
      success: false,
      error: '전표 라인 수정 중 오류가 발생했습니다'
    });
  }
}

// 전표 라인 추가
async function addVoucherLine(req, res) {
  try {
    const { voucherType, voucherId } = req.params;
    const { line_no, account_code, debit_credit, amount, description_code, description } = req.body;

    const result = await ledgerModel.addVoucherLine(
      voucherType,
      voucherId,
      {
        line_no,
        account_code,
        debit_credit,
        amount,
        description_code,
        description
      }
    );

    res.json({
      success: true,
      message: '전표 라인이 추가되었습니다'
    });
  } catch (error) {
    console.error('전표 라인 추가 실패:', error);
    res.status(500).json({
      success: false,
      error: '전표 라인 추가 중 오류가 발생했습니다'
    });
  }
}

// 전표 라인 삭제
async function deleteVoucherLine(req, res) {
  try {
    const { voucherType, voucherId, lineNo } = req.params;

    const result = await ledgerModel.deleteVoucherLine(voucherType, voucherId, lineNo);

    res.json({
      success: true,
      message: '전표 라인이 삭제되었습니다'
    });
  } catch (error) {
    console.error('전표 라인 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: '전표 라인 삭제 중 오류가 발생했습니다'
    });
  }
}

// 거래처별 원장 요약 조회
async function getClientLedgerSummary(req, res) {
  try {
    const companyId = req.query.companyId;
    const filters = {
      startMonth: req.query.startMonth ? parseInt(req.query.startMonth) : null,
      startDay: req.query.startDay ? parseInt(req.query.startDay) : null,
      endMonth: req.query.endMonth ? parseInt(req.query.endMonth) : null,
      endDay: req.query.endDay ? parseInt(req.query.endDay) : null,
      accountCode: req.query.accountCode || null,
      startClientCode: req.query.startClientCode || '00001',
      endClientCode: req.query.endClientCode || '99999'
    };

    const result = await ledgerModel.getClientLedgerSummary(companyId, filters);

    res.json({
      success: true,
      summary: result.summary
    });
  } catch (error) {
    console.error('거래처별 원장 요약 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '거래처별 원장 요약 조회 중 오류가 발생했습니다'
    });
  }
}

// 거래처별 원장 상세 조회
async function getClientLedgerDetail(req, res) {
  try {
    const companyId = req.query.companyId;
    const filters = {
      startMonth: req.query.startMonth ? parseInt(req.query.startMonth) : null,
      startDay: req.query.startDay ? parseInt(req.query.startDay) : null,
      endMonth: req.query.endMonth ? parseInt(req.query.endMonth) : null,
      endDay: req.query.endDay ? parseInt(req.query.endDay) : null,
      accountCode: req.query.accountCode || null,
      clientId: req.query.clientId || null
    };

    const result = await ledgerModel.getClientLedgerDetail(companyId, filters);

    res.json({
      success: true,
      ledger: result.ledger
    });
  } catch (error) {
    console.error('거래처별 원장 상세 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '거래처별 원장 상세 조회 중 오류가 발생했습니다'
    });
  }
}

module.exports = {
  getAccountLedger,
  getAccountSummary,
  updateVoucherLine,
  addVoucherLine,
  deleteVoucherLine,
  getClientLedgerSummary,
  getClientLedgerDetail
};
