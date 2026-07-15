-- ============================================================================
-- 05-add-user-settings-columns.sql
-- 用途：线上 user_settings 是旧版建表，缺失多个前端会写入的列
--       （speech_rate / font_size / chinese_font / thai_font / reminder_* /
--        webdav_* / default_api_id / updated_at 等），导致保存设置时
--        POST user_settings?on_conflict=user_id 返回 400
--        "Could not find the 'xxx' column in the schema cache"。
-- 执行：在 Supabase Dashboard → SQL Editor 里贴入执行。
-- 说明：全部 ADD COLUMN IF NOT EXISTS，幂等可重复跑，不影响已有数据。
-- ============================================================================

alter table user_settings add column if not exists dict_direction     text    default 'th_to_zh';
alter table user_settings add column if not exists color_mode         text    default 'light';
alter table user_settings add column if not exists speech_rate        numeric default 1.0;
alter table user_settings add column if not exists font_size          text    default 'medium';
alter table user_settings add column if not exists chinese_font       text    default 'noto_sans_sc';
alter table user_settings add column if not exists thai_font          text    default 'noto_sans_thai';
alter table user_settings add column if not exists reminder_enabled   boolean default false;
alter table user_settings add column if not exists reminder_time      text    default '20:00';
alter table user_settings add column if not exists reminder_frequency text    default 'daily';
alter table user_settings add column if not exists webdav_url          text    default '';
alter table user_settings add column if not exists webdav_user         text    default '';
alter table user_settings add column if not exists webdav_pass_enc     text    default '';
alter table user_settings add column if not exists default_api_id      uuid;
alter table user_settings add column if not exists updated_at          timestamptz default now();
