-- ============================================================================
-- 08-drop-otp-type-check.sql
-- 现有生产库 otp_codes.type 列带有一个 CHECK 约束（otp_codes_type_check），
-- 其允许值集合与当前路由写入的 'email' 不符，导致 send-otp 写入时 500：
--   "new row for relation \"otp_codes\" violates check constraint \"otp_codes_type_check\""
-- 该约束是旧 schema 遗留，与当前「邮箱验证码」业务无关，直接移除即可。
-- 幂等：使用 DROP CONSTRAINT IF EXISTS（PostgreSQL 11+ 支持）。
-- ============================================================================

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'otp_codes_type_check'
  ) then
    alter table otp_codes drop constraint otp_codes_type_check;
    raise notice 'dropped constraint otp_codes_type_check';
  else
    raise notice 'constraint otp_codes_type_check not found, skip';
  end if;
end $$;
