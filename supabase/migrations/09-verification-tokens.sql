-- 09-verification-tokens.sql
-- 自建邮箱验证表：验证码 + 魔法令牌同表，彻底取代 Supabase 自带 OTP / 魔法链接，
-- 从而绕开 Auth 面板「Email 登录关闭」的限制（参考 gongwen-os-v2 的 verification_tokens 实现）。
-- 仅由服务端 Route Handler 写入（service_role），前端不直接访问。

create table if not exists verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code       text not null,
  token      text not null,
  purpose    text default 'login',
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_vt_email     on verification_tokens (email);
create index if not exists idx_vt_token     on verification_tokens (token);
create index if not exists idx_vt_expires   on verification_tokens (expires_at);

-- 仅 service_role 可访问（写入由服务端 Route Handler 用 service_role 绕过 RLS）；
-- 不建 anon/auth 策略，开启 RLS 即拒绝前两者，避免验证码/令牌被外部读取。
alter table verification_tokens enable row level security;

-- 频率限制（60 秒）改用 verification_tokens（原 otp_codes 不再写入）
create or replace function check_otp_rate_limit(p_email text)
returns boolean language sql stable security definer as $$
  select not exists (
    select 1 from verification_tokens
    where email = p_email and created_at > now() - interval '60 seconds'
  );
$$;

-- 兼容旧名 cleanup_expired_otps：同时清理两张表，避免残留堆积
create or replace function cleanup_expired_otps()
returns void language sql security definer as $$
  delete from otp_codes         where expires_at < now();
  delete from verification_tokens where expires_at < now();
$$;
