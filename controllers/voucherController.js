const voucherService = require('../services/voucherService');

// 전표 라인 조회
async function getVoucherLinesByDate(req, res) {
  try {
    const userId = req.user.userId;
    const { companyId, startDate, endDate } = req.query;

    if (!companyId || !startDate || !endDate) {
      return res.status(400).json({
        error: '회사 ID, 시작일, 종료일이 필요합니다'
      });
    }

    const result = await voucherService.getVoucherLinesByDate(
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

// 전표 라인 생성
async function createVoucherLine(req, res) {
  try {
    const userId = req.user.userId;
    const lineData = req.body;

    const result = await voucherService.createVoucherLine(userId, lineData);

    res.status(201).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 라인 수정
async function updateVoucherLine(req, res) {
  try {
    const userId = req.user.userId;
    const { lineId } = req.params;
    const lineData = req.body;

    const result = await voucherService.updateVoucherLine(
      userId,
      parseInt(lineId),
      lineData
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 라인 삭제
async function deleteVoucherLine(req, res) {
  try {
    const userId = req.user.userId;
    const { lineId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: '회사 ID가 필요합니다'
      });
    }

    const result = await voucherService.deleteVoucherLine(
      userId,
      parseInt(lineId),
      parseInt(companyId)
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 여러 라인을 한 번에 저장하는 전표 생성
async function createVoucherWithLines(req, res) {
  try {
    const userId = req.user.userId;
    const voucherData = req.body;

    const result = await voucherService.createVoucherWithLines(userId, voucherData);

    res.status(201).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

// 전표 전체 수정 (여러 라인)
async function updateVoucherWithLines(req, res) {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;
    const voucherData = req.body;

    const result = await voucherService.updateVoucherWithLines(
      userId,
      parseInt(voucherId),
      voucherData
    );

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
}

module.exports = {
  getVoucherLinesByDate,
  createVoucherLine,
  updateVoucherLine,
  deleteVoucherLine,
  createVoucherWithLines,
  updateVoucherWithLines
};