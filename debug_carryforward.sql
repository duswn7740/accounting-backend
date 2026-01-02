-- 이월 데이터 확인용 SQL 쿼리

-- 1. 회계기수 확인
SELECT * FROM fiscal_periods ORDER BY fiscal_year;

-- 2. 이월잔액 테이블 확인 (계정별)
SELECT
  cfb.*,
  a.account_code,
  a.account_name,
  a.account_type
FROM carry_forward_balances cfb
INNER JOIN accounts a ON cfb.account_id = a.account_id
WHERE cfb.client_id IS NULL
ORDER BY cfb.fiscal_year, a.account_code;

-- 3. 이월잔액 테이블 확인 (거래처별)
SELECT
  cfb.*,
  a.account_code,
  a.account_name,
  c.client_code,
  c.client_name
FROM carry_forward_balances cfb
INNER JOIN accounts a ON cfb.account_id = a.account_id
INNER JOIN clients c ON cfb.client_id = c.client_id
WHERE cfb.client_id IS NOT NULL
ORDER BY cfb.fiscal_year, a.account_code, c.client_code;

-- 4. 1기 전표 확인 (일반전표)
SELECT
  gv.voucher_date,
  gv.voucher_no,
  a.account_code,
  a.account_name,
  gvl.debit_amount,
  gvl.credit_amount
FROM general_vouchers gv
INNER JOIN general_voucher_lines gvl ON gv.voucher_id = gvl.voucher_id
INNER JOIN accounts a ON gvl.account_id = a.account_id
WHERE gv.company_id = 1
  AND gv.voucher_date BETWEEN (SELECT start_date FROM fiscal_periods WHERE fiscal_year = 1)
  AND (SELECT end_date FROM fiscal_periods WHERE fiscal_year = 1)
ORDER BY a.account_code, gv.voucher_date;

-- 5. 1기 전표 확인 (매입매출전표)
SELECT
  spv.voucher_date,
  spv.voucher_no,
  a.account_code,
  a.account_name,
  spvl.debit_credit,
  spvl.amount
FROM sales_purchase_vouchers spv
INNER JOIN sales_purchase_voucher_lines spvl ON spv.voucher_id = spvl.voucher_id
INNER JOIN accounts a ON spvl.account_id = a.account_id
WHERE spv.company_id = 1
  AND spv.voucher_date BETWEEN (SELECT start_date FROM fiscal_periods WHERE fiscal_year = 1)
  AND (SELECT end_date FROM fiscal_periods WHERE fiscal_year = 1)
  AND spv.is_active = TRUE
ORDER BY a.account_code, spv.voucher_date;
