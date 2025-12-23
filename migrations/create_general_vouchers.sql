-- 일반전표 헤더 테이블
CREATE TABLE IF NOT EXISTS general_vouchers (
  voucher_id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  voucher_date DATE NOT NULL,
  voucher_no VARCHAR(10) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT '확정',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,

  FOREIGN KEY (company_id) REFERENCES companies(company_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_company_date (company_id, voucher_date),
  INDEX idx_voucher_no (voucher_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 일반전표 라인 테이블
CREATE TABLE IF NOT EXISTS general_voucher_lines (
  line_id INT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  line_no INT NOT NULL,
  debit_credit VARCHAR(10) NOT NULL,
  account_id INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description VARCHAR(255),
  description_code VARCHAR(50),
  department_code VARCHAR(50),
  project_code VARCHAR(50),

  FOREIGN KEY (voucher_id) REFERENCES general_vouchers(voucher_id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  INDEX idx_voucher (voucher_id),
  INDEX idx_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
