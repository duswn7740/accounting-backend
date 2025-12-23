-- 매입매출전표 라인에 거래처 ID 컬럼 추가
-- 이제 각 라인마다 다른 거래처를 설정할 수 있습니다

ALTER TABLE sales_purchase_voucher_lines
ADD COLUMN client_id INT NULL
AFTER account_id;

-- 외래키 제약 조건 추가
ALTER TABLE sales_purchase_voucher_lines
ADD CONSTRAINT fk_sp_line_client
FOREIGN KEY (client_id) REFERENCES clients(client_id)
ON DELETE SET NULL;

-- 기존 데이터 마이그레이션: 전표 헤더의 client_id를 라인에 복사
UPDATE sales_purchase_voucher_lines spl
INNER JOIN sales_purchase_vouchers spv ON spl.voucher_id = spv.voucher_id
SET spl.client_id = spv.client_id;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_sp_line_client ON sales_purchase_voucher_lines(client_id);
