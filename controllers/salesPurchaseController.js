const salesPurchaseService = require('../services/salesPurchaseService');

// 매입매출 전표 등록
async function createVoucher(req, res) {
  try {
    const userId = req.user.userId;
    const { voucherData, lines } = req.body;

    const result = await salesPurchaseService.createVoucher(userId, voucherData, lines);

    res.status(201).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 회사별 전표 조회
async function getVouchersByCompany(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId } = req.query;

    const result = await salesPurchaseService.getVouchersByCompany(
      userId,
      parseInt(companyId)
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 기간별 전표 조회
async function getVouchersByDateRange(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId, startDate, endDate } = req.query;

    const result = await salesPurchaseService.getVouchersByDateRange(
      userId,
      parseInt(companyId),
      startDate,
      endDate
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 상세 조회
async function getVoucherById(req, res) {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;

    const result = await salesPurchaseService.getVoucherById(
      userId,
      parseInt(voucherId)
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 수정
async function updateVoucher(req, res) {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;
    const { voucherData, lines } = req.body;

    const result = await salesPurchaseService.updateVoucher(
      userId,
      parseInt(voucherId),
      voucherData,
      lines
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 삭제
async function deleteVoucher(req, res) {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;

    const result = await salesPurchaseService.deleteVoucher(
      userId,
      parseInt(voucherId)
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

module.exports = {
  createVoucher,
  getVouchersByCompany,
  getVouchersByDateRange,
  getVoucherById,
  updateVoucher,
  deleteVoucher
};
