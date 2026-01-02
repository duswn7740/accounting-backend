const fiscalPeriodService = require('../services/fiscalPeriodService');

// 마감 후 이월
async function carryForward(req, res) {
  try {
    const { fiscalYear } = req.params;
    const { companyId } = req.body;

    console.log(`[이월 처리] ${fiscalYear}기 → ${parseInt(fiscalYear) + 1}기, 회사 ID: ${companyId}`);

    const result = await fiscalPeriodService.carryForwardBalances(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    console.error('이월 처리 실패:', error);
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

    console.log(`[마감 처리] ${fiscalYear}기, 회사 ID: ${companyId}`);

    const result = await fiscalPeriodService.closeFiscalPeriod(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    console.error('마감 처리 실패:', error);
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

    console.log(`[마감 취소] ${fiscalYear}기, 회사 ID: ${companyId}`);

    const result = await fiscalPeriodService.reopenFiscalPeriod(
      companyId,
      parseInt(fiscalYear)
    );

    res.json(result);
  } catch (error) {
    console.error('마감 취소 실패:', error);
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
