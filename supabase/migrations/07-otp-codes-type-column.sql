-- ============================================================================
-- 07-otp-codes-type-column.sql
-- 补齐 otp_codes 表的 purpose / type 列，消除 send-otp 的 not-null 约束报错。
-- 幂等：适合在已有生产库上直接执行。
-- ============================================================================

-- 1. purpose 列（若 06 未执行过）
alter table otp_codes
  add column if not exists purpose text not null default 'login';

-- 2. type 列：现有库为 NOT NULL，但新代码未写入 -> 报
--    "null value in column \"type\" of relation \"otp_codes\""
--    补齐默认值 'email'，并回填旧记录。
alter table otp_codes
  add column if not exists type text not null default 'email';

-- 3. 回填已有记录的空值（仅当列允许 null 的历史残留，add column 已带默认则无需，但保险）
update otp_codes set purpose = 'login' where purpose is null or purpose = '';
update otp_codes set type = 'email'  where type is null or type = '';

-- 4. 为 (email, purpose) 查询建索引（verify-otp 使用）
create index if not exists idx_otp_email_purpose on otp_codes (email, purpose);
