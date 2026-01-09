const fiscalPeriodService = require('../services/fiscalPeriodService');

// 마감 후 이월
async function carryForward(req, res) {
  try {
    const { fiscalYear } = req.params;
    const { companyId } = req.body;

    const result = await fiscalPeriodService.carryForwardBalances(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '이월 처리 중 오류가 발생했습니다'
    });
  }
}

// 회계기수 마감
async function closePeriod(req, res) {
  try {
    const { fiscalYear } = req.params;
    const { companyId } = req.body;

    const result = await fiscalPeriodService.closeFiscalPeriod(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '마감 처리 중 오류가 발생했습니다'
    });
  }
}

// 회계기수 마감 취소
async function reopenPeriod(req, res) {
  try {
    const { fiscalYear } = req.params;
    const { companyId } = req.body;

    const result = await fiscalPeriodService.reopenFiscalPeriod(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '마감 취소 중 오류가 발생했습니다'
    });
  }
}

module.exports = {
  carryForward,
  closePeriod,
  reopenPeriod
};
