<p align="center">
  <img src="public/icons/logo.png" width="180" height="180" alt="词笺 Logo" />
</p>

<p align="center">
  <strong>词笺 · ThaiDict</strong><br/>
  <em>中泰双语智能词典 — A Chinese-Thai Bilingual Intelligent Dictionary</em>
</p>

<p align="center">
  <a href="https://thaidict.182183.xyz" target="_blank"><strong>🌐 thaidict.182183.xyz</strong></a>
</p>

---

<details open>
<summary><strong>🇨🇳 中文</strong> — 点击展开 English ↓</summary>

## 目录

- [一、项目概述](#一项目概述)
- [二、技术栈](#二技术栈)
- [三、系统架构](#三系统架构)
- [四、目录结构](#四目录结构)
- [五、核心模块与实现方式](#五核心模块与实现方式)
  - [5.1 认证与权限](#51-认证与权限)
  - [5.2 词典层](#52-词典层)
  - [5.3 每日推荐](#53-每日推荐)
  - [5.4 短语库](#54-短语库)
  - [5.5 学习中心](#55-学习中心)
  - [5.6 单词本](#56-单词本)
  - [5.7 AI 词条与审批](#57-ai-词条与审批)
  - [5.8 导出与备份](#58-导出与备份)
- [六、安全说明](#六安全说明)
- [七、环境变量](#七环境变量)
- [八、本地开发与部署](#八本地开发与部署)
- [九、许可证](#九许可证)

---

## 一、项目概述

**词笺（ThaiDict）** 是一款面向中泰双语学习者的智能词典应用，目标是让泰语学习者在移动端即可高效查词、例句、短语，并通过打卡、单词本、成就系统持续积累。

核心能力：

- **词典检索**：覆盖 **62,000+ 泰语词汇**，支持泰语、中文、拼音/罗马音多维度搜索
- **每日推荐**：每日一词 + 每日一句，由后端脚本自动写入 `daily_picks`
- **短语库**：按主题（问候、餐饮、交通、购物等）浏览常用泰语短语
- **学习中心**：打卡任务、连续天数、学习热力图、成就系统、学习日记与笔记
- **单词本**：最近浏览、收藏文件夹、单词书、学习进度
- **AI 辅助**：用户可提交 AI 生成词条，审批后进入主词典；支持自定义 AI API Key
- **导出与备份**：JSON / Markdown / Word 多格式导出，WebDAV 加密上传
- **多平台登录**：邮箱密码 / Google / GitHub OAuth / Brevo 邮箱验证码 / 魔法链接

---

## 二、技术栈

| 层 | 技术选型 | 说明 |
| --- | --- | --- |
| 框架 | [Next.js 14](https://nextjs.org)（App Router）+ React 18 | 全栈同仓，API 与页面同源 |
| 样式 | CSS Variables + 新中式奶油风格 | 低饱和暖色调、圆角卡片 |
| 图标 | [Lucide React](https://lucide.dev) | 线性图标 |
| 图表 | [recharts](https://recharts.org) | 学习热力、周时长等图表 |
| 后端 | [Supabase](https://supabase.com)（PostgreSQL + Auth + RLS + Edge Functions） | 数据库、认证、实时订阅 |
| 部署 | [Vercel](https://vercel.com) | push 即自动构建部署 |
| 分词 | 基于词典的最大正向匹配 | `src/utils/thaiToken.ts` |
| 邮件 | Brevo（Sendinblue）API | 验证码、登录链接、学习提醒 |
| 导出 | 自研纯 JS docx 生成器 | 零服务端依赖生成 Word |

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 / PWA（移动端优先）                                    │
│  · Next.js App Router 页面                                   │
│  · React Context 全局状态（AppContext）                       │
│  · localStorage 缓存（每日推荐、学习中心、单词本）             │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS（页面 + API 同源）
┌───────────────▼─────────────────────────────────────────────┐
│  Next.js（Vercel）                                            │
│  · app/page.jsx：客户端 AppShell                              │
│  · app/api/* Route Handlers：OTP / Magic Link / 学习提醒      │
│  · src/lib/db/*：统一数据层（mock / Supabase 自动切换）        │
└───────────────┬─────────────────────────────────────────────┘
                │  REST + Realtime
┌───────────────▼─────────────────────────────────────────────┐
│  Supabase                                                     │
│  · PostgreSQL：词典、用户数据、学习记录                        │
│  · Auth：邮箱 / OAuth / Magic Link                            │
│  · RLS：按 user_id 隔离                                       │
└─────────────────────────────────────────────────────────────┘
```

要点：

- **数据层单一入口**：所有页面只通过 `src/lib/db/*` 读写数据，mock/真实后端自动切换。
- **缓存优先**：学习中心、单词本、首页每日推荐均先读本地缓存，后台静默刷新。
- **密钥不出前端**：Supabase Anon Key、Brevo Key、AI Key 均不暴露于前端业务代码。

---

## 四、目录结构

```
thaidict-v2/
├── app/                          # Next.js App Router
│   ├── page.jsx                  # 入口：挂载 AppShell
│   ├── layout.jsx                # 根布局、字体、主题变量
│   └── api/                      # Route Handlers
│       ├── send-otp/
│       ├── verify-otp/
│       ├── send-magic-link/
│       ├── send-reminder/
│       └── ...
├── public/                       # 静态资源
│   └── icons/                    # logo、PWA 图标
├── src/
│   ├── App.jsx                   # 状态驱动的四标签页主框架
│   ├── index.css                 # 全局 CSS 变量与动画
│   ├── context/
│   │   └── AppContext.jsx        # 全局状态（session、toast、字体等）
│   ├── screens/                  # 四大主页面
│   │   ├── HomePage.jsx          # 首页、搜索、每日推荐
│   │   ├── WordBookPage.jsx      # 单词本
│   │   ├── LearnPage.jsx         # 学习中心
│   │   ├── ProfilePage.jsx       # 我的
│   │   └── subsections/          # 子页面（短语库、日记、设置等）
│   ├── components/               # 通用组件
│   │   ├── UIComponents.jsx      # Btn、Card、AsyncBadge、Spinner 等
│   │   ├── ThaiSentence.jsx      # 泰文分词与发音
│   │   └── ...
│   ├── icons/
│   │   └── CulturalIcons.jsx     # 主 logo、佛塔、莲花等图标
│   ├── lib/
│   │   ├── db/                   # 数据层（auth/dictionary/wordbook/...）
│   │   ├── asyncCache.js         # 本地缓存工具
│   │   ├── webdav.js             # WebDAV 与多格式导出
│   │   ├── docx.js               # 最小 docx 生成器
│   │   └── supabase.js           # Supabase 客户端
│   ├── utils/
│   │   ├── thaiToken.ts          # 泰语分词
│   │   └── tts.js                # 语音合成
│   └── screens/subsections/      # 各二级页面
├── supabase/migrations/          # DDL 迁移脚本
├── scripts/
│   └── daily_pick.py             # 每日推荐抓取脚本
├── .env.local                    # 本地环境变量（gitignored）
├── next.config.mjs               # Next.js 配置（含 git 哈希注入）
└── LICENSE                       # MIT + AI/数据声明
```

---

## 五、核心模块与实现方式

### 5.1 认证与权限

- **登录方式**：邮箱密码、Google OAuth、GitHub OAuth、Brevo 邮箱验证码、Brevo 魔法链接。
- **密码管理**：真实模式通过 Supabase Auth；第三方登录账号不可设置密码。
- **权限角色**：`super_admin > admin > user`，管理员可进入后台审批 AI 词条、管理用户。

### 5.2 词典层

- 前端只读 `dictionary_full` 视图，该视图综合 `dictionary` 基表、`word_freqs` 词频表、`word_sources` 来源表。
- 写入统一落到基表 `dictionary`，审批后自动反映到视图。
- 分词使用基于词典的最大正向匹配，前端高亮并支持逐词发音与中文释义。

### 5.3 每日推荐

- `scripts/daily_pick.py` 每天运行一次，随机选取一条已富化词条 + 一条句子写入 `daily_picks`。
- 前端按 `pick_date = 今天` 精确读取，缓存优先，后台静默刷新。
- 同一天多次运行脚本会更新同一行，保证刷新不变。

### 5.4 短语库

- 内置分类：全部、成语、佛学、日常。
- 模块级缓存：分类、卡片、滚动位置退出后保持；完全返回首页时清空。

### 5.5 学习中心

- 一级页面展示今日打卡、连续打卡、近 7 天热力、本周分钟、学习计划。
- 子页面包括统计、成就、笔记、学习日记、调整计划、练习。
- 全部接入 `asyncCache.js`：先显示缓存，后台拉取，右上角 `AsyncBadge` 提示「检测更改…」。

### 5.6 单词本

- 最近浏览、单词夹、句子夹、单词书。
- 与学习中信采用相同的缓存优先策略，退出子页保留位置与数据。

### 5.7 AI 词条与审批

- 用户可在「AI 造词」输入泰语单词，系统调用大模型生成释义、例句、罗马音等。
- 生成后进入 `pending_approvals` 表，管理员审批后写入 `dictionary` 主表。
- 支持用户自定义 AI API Key（加密存储于用户设置）。

### 5.8 导出与备份

- 导出格式：JSON（原始数据）、Markdown（阅读友好）、Word（`.docx`，自研零依赖生成器）。
- WebDAV：配置地址、账号、密码（AES-GCM 加密存储本地）后上传备份文件。

---

## 六、安全说明

- `.env.local` 与 `.env*` 已加入 `.gitignore`，不会进入版本控制。
- 仓库源码中无硬编码云密钥；本脚本内嵌的 `SUPABASE_SERVICE_ROLE_KEY` 仅用于私有仓库的自动化脚本，**请勿提交到公开仓库**。
- 用户 AI Key、WebDAV 密码均在前端本地加密（AES-GCM）后存储或走服务端代理。
- 生产部署前请 rotate Service Role Key，并通过 Vercel Environment Variables 注入。

---

## 七、环境变量

| 变量 | 说明 | 必需 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key（前端） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（仅服务端） | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 站点域名，用于 OAuth/Magic Link 回调 | ✅ |
| `BREVO_API_KEY` | Brevo 邮件 API Key | ✅ |
| `BREVO_SENDER_EMAIL` | Brevo 发件邮箱 | ✅ |
| `BREVO_SENDER_NAME` | Brevo 发件人名称 | ✅ |

---

## 八、本地开发与部署

### 本地开发

```bash
git clone https://github.com/jimmy2rak/thaidict-v2.git
cd thaidict-v2
npm install
cp .env.example .env.local   # 按上表填写
npm run dev                  # http://localhost:3000
```

### 生产部署

1. 推送代码到 GitHub → Vercel 导入仓库（Framework 自动识别为 Next.js）。
2. Vercel **Environment Variables** 填入第七节变量。
3. Supabase 项目按 `supabase/migrations/` 顺序执行迁移（已有库用 `02-sync-existing.sql` + `03-extend-dictionary-full.sql` + `04-fix-missing-after-02.sql` + `05-daily-picks-pickdate-unique.sql`）。
4. Cloudflare 域名 CNAME 指向 `cname.vercel-dns.com`，Vercel Domains 绑定后自动 SSL。
5. 每次 `git push` 触发自动构建与部署。

---

## 九、许可证

本项目基于 **MIT License** 开源。详见 [LICENSE](./LICENSE)。

### 版权与致谢

- **本项目由 AI 辅助开发**（WorkBuddy AI，https://www.codebuddy.cn）
- **Logo 由 AI 制作，版权归 ThaiDict 项目所有**
- **词典数据源自 [pythai](https://pypi.org/project/pythai/)**（泰语开源词典项目）
- **贡献者**：[jimmy2rak](https://github.com/jimmy2rak)、[WorkBuddy](https://www.codebuddy.cn)

</details>

<details>
<summary><strong>🇺🇸 English</strong> — Click to expand Chinese ↑</summary>

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Tech Stack](#2-tech-stack)
- [3. System Architecture](#3-system-architecture)
- [4. Directory Structure](#4-directory-structure)
- [5. Core Modules](#5-core-modules)
  - [5.1 Authentication & Roles](#51-authentication--roles)
  - [5.2 Dictionary Layer](#52-dictionary-layer)
  - [5.3 Daily Picks](#53-daily-picks)
  - [5.4 Phrase Library](#54-phrase-library)
  - [5.5 Learning Center](#55-learning-center)
  - [5.6 Word Book](#56-word-book)
  - [5.7 AI Entries & Approvals](#57-ai-entries--approvals)
  - [5.8 Export & Backup](#58-export--backup)
- [6. Security Notes](#6-security-notes)
- [7. Environment Variables](#7-environment-variables)
- [8. Local Development & Deployment](#8-local-development--deployment)
- [9. License](#9-license)

---

## 1. Project Overview

**ThaiDict** is an intelligent Chinese-Thai bilingual dictionary for learners, covering **62,000+ Thai words**.

Key features:

- **Dictionary Search**: Thai, Chinese, and romanization search with real-time tokenization
- **Daily Picks**: Word of the Day + Sentence of the Day, written by `scripts/daily_pick.py`
- **Phrase Library**: Common Thai phrases by topic
- **Learning Center**: Check-ins, streaks, heatmap, achievements, diary, and notes
- **Word Book**: Recent, folders, and word lists with progress
- **AI Assistant**: AI-generated entries submitted for admin approval
- **Export & Backup**: JSON / Markdown / Word export, encrypted WebDAV upload
- **Multi-platform Login**: Email, Google, GitHub OAuth, Brevo OTP, Magic Link

---

## 2. Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) + React 18 | Full-stack monorepo |
| Styling | CSS Variables + Neo-Chinese Cream aesthetic | Low-saturation warm palette |
| Icons | Lucide React | |
| Charts | recharts | |
| Backend | Supabase (PostgreSQL + Auth + RLS) | |
| Deployment | Vercel | Auto CI/CD on push |
| Tokenization | Dictionary-based max forward matching | `src/utils/thaiToken.ts` |
| Email | Brevo API | OTP, magic link, reminders |
| Export | Custom pure-JS docx generator | Zero server dependency |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser / PWA (mobile-first)                               │
│  · Next.js App Router pages                                 │
│  · React Context global state (AppContext)                  │
│  · localStorage cache (daily picks, learning, word book)    │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS (pages + API same origin)
┌───────────────▼─────────────────────────────────────────────┐
│  Next.js (Vercel)                                           │
│  · app/page.jsx: client AppShell                            │
│  · app/api/* Route Handlers: OTP / magic link / reminders   │
│  · src/lib/db/*: unified data layer with mock/real switch   │
└───────────────┬─────────────────────────────────────────────┘
                │  REST + Realtime
┌───────────────▼─────────────────────────────────────────────┐
│  Supabase                                                   │
│  · PostgreSQL: dictionary, user data, learning records      │
│  · Auth: email / OAuth / magic link                         │
│  · RLS: isolated by user_id                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
thaidict-v2/
├── app/                 # Next.js App Router entry & API routes
├── public/icons/        # Logo & PWA icons
├── src/
│   ├── App.jsx          # Main 4-tab shell
│   ├── context/         # AppContext
│   ├── screens/         # Main pages & subsections
│   ├── components/      # Shared UI components
│   ├── icons/           # Cultural SVG icons
│   ├── lib/db/          # Data layer
│   ├── lib/asyncCache.js
│   ├── lib/webdav.js
│   ├── lib/docx.js
│   └── utils/           # Tokenization & TTS
├── supabase/migrations/
├── scripts/daily_pick.py
└── .env.local
```

---

## 5. Core Modules

### 5.1 Authentication & Roles

- Email/password, Google OAuth, GitHub OAuth, Brevo OTP, and Magic Link.
- Roles: `super_admin > admin > user`.

### 5.2 Dictionary Layer

- Frontend reads from the `dictionary_full` view (base table + frequencies + sources).
- Writes go to the `dictionary` base table and reflect in the view.
- Segmentation uses dictionary-based max forward matching with per-word TTS and meanings.

### 5.3 Daily Picks

- `scripts/daily_pick.py` runs daily and writes a random enriched word + sentence to `daily_picks`.
- Frontend reads by today's `pick_date`, cache-first.

### 5.4 Phrase Library

- Categories: All, Idioms, Buddhism, Daily.
- Module-level cache preserves scroll position and cards until returning to home.

### 5.5 Learning Center

- Dashboard: today's tasks, streak, 7-day heatmap, weekly minutes, study plan.
- Subpages: stats, achievements, notes, diary, plan adjustment, practice.
- All cache-first via `asyncCache.js` with an `AsyncBadge` spinner.

### 5.6 Word Book

- Recent, word folders, sentence folders, and word lists.
- Same cache-first pattern as the Learning Center.

### 5.7 AI Entries & Approvals

- Users can ask AI to generate an entry; it lands in `pending_approvals`.
- Admins approve entries into the main `dictionary` table.
- Custom AI API Keys are encrypted in user settings.

### 5.8 Export & Backup

- Export: JSON, Markdown, or `.docx` (custom no-dependency generator).
- WebDAV upload with AES-GCM encrypted credentials stored locally.

---

## 6. Security Notes

- `.env.local` and `.env*` are gitignored.
- No cloud keys are hardcoded in source; the embedded `SUPABASE_SERVICE_ROLE_KEY` in `daily_pick.py` is only for private-repo automation.
- User AI keys and WebDAV passwords are encrypted (AES-GCM) before storage.
- Rotate the Service Role Key before production deployment and inject it via Vercel Environment Variables.

---

## 7. Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key for frontend | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key for server only | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Site URL for OAuth/Magic Link callbacks | ✅ |
| `BREVO_API_KEY` | Brevo email API key | ✅ |
| `BREVO_SENDER_EMAIL` | Brevo sender email | ✅ |
| `BREVO_SENDER_NAME` | Brevo sender name | ✅ |

---

## 8. Local Development & Deployment

```bash
git clone https://github.com/jimmy2rak/thaidict-v2.git
cd thaidict-v2
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

Deploy to Vercel by importing the GitHub repo and filling in the environment variables above.

---

## 9. License

This project is open source under the **MIT License**. See [LICENSE](./LICENSE).

### Credits

- **Developed with AI assistance** (WorkBuddy AI, https://www.codebuddy.cn)
- **Logo designed by AI; copyright owned by the ThaiDict project**
- **Dictionary data sourced from [pythai](https://pypi.org/project/pythai/)**
- **Contributors**: [jimmy2rak](https://github.com/jimmy2rak), [WorkBuddy](https://www.codebuddy.cn)

</details>

---

<p align="center">
  <sub>Built with ❤️ by AI &amp; Humans</sub>
</p>
