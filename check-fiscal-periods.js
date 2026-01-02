const db = require('./config/database');

async function checkFiscalPeriods() {
  try {
    const [rows] = await db.query(`
      SELECT company_id, fiscal_year, start_date, end_date, is_closed
      FROM fiscal_periods
      WHERE fiscal_year = 1
      ORDER BY company_id
    `);

    console.log('1기 회계기수 정보:');
    console.table(rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFiscalPeriods();
