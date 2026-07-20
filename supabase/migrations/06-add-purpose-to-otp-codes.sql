-- ============================================================================
-- 06-add-purpose-to-otp-codes.sql
-- 为 otp_codes 表补齐 purpose 列，供 /api/send-otp 与 /api/verify-otp 使用。
-- 幂等：适合在已有生产库（含 6 万词）上直接执行。
-- ============================================================================

-- 1. 添加 purpose 列（如果不存在）
alter table otp_codes
  add column if not exists purpose text not null default 'login';

-- 2. 为 email + purpose 查询建索引，加速 verify-otp 的最新一条查找
--    先删后建，避免同名索引冲突
-- 注意：PostgreSQL 的 DROP INDEX 不存在 IF EXISTS 会报错，需用 DO 块包裹
-- 或者用 CREATE INDEX IF NOT EXISTS。这里使用 CREATE INDEX IF NOT EXISTS 即可。
create index if not exists idx_otp_email_purpose on otp_codes (email, purpose);

-- 3. 可选：把已存在记录的 purpose 统一为 'login'（发送-otp/验证-otp 的默认用途）
--    这些记录只是验证码，无业务数据，可安全覆盖
update otp_codes
  set purpose = 'login'
  where purpose is null or purpose = '';

-- 4. 检查约束：若存在重复的 (email, purpose, created_at) 时业务上无意义，但保留原表主键 id 即可
