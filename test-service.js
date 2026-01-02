const mysql = require('mysql2/promise');
const settlementQueries = require('./queries/settlementQueries');
require('dotenv').config();

async function testService() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const connection = await pool.getConnection();

  try {
    const companyId = 1;
    const fiscalYear = 1;
    
    const [periods] = await connection.query(
      'SELECT * FROM fiscal_periods WHERE company_id = ? AND fiscal_year = ?',
      [companyId, fiscalYear]
    );

    const period = periods[0];

    const [accounts] = await connection.query(
      settlementQueries.getTrialBalanceQuery,
      [companyId, fiscalYear, companyId, period.start_date, period.end_date]
    );

    const found = accounts.find(row => row.account_code === '103');
    console.log('보통예금 raw row:', found);
    console.log('Keys:', Object.keys(found));

    const mapped = {
      accountCode: found.account_code,
      accountName: found.account_name,
      accountType: found.account_type,
      accountCategory: found.account_category
    };
    console.log('Mapped:', mapped);

  } finally {
    connection.release();
    await pool.end();
  }
}

testService().catch(console.error);
