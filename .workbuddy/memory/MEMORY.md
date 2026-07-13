# 中泰词典 ThaiDict · 项目长期记忆（MEMORY）

> 这份文档是「项目说明书 + 长期备忘」，写给未来接手的人（包括未来的自己）。
> 目标：即使从没见过这个项目，读完这一篇也能马上明白它是什么、怎么跑、代码怎么组织的。
> 最后更新：2026-07-13

---

## 1. 这是什么项目

**中泰双语词典网页应用**（中文 ↔ 泰语），采用 **Next.js 14（App Router）** 作为外壳、
内部以「客户端全量渲染的 SPA 内核」运行（整个 App 通过 `dynamic(ssr:false)` 加载，
行为与原 Vite SPA 完全一致，但获得了 Next 的路由/构建/部署能力）。
功能包含：查词、例句、发音朗读、单词收藏、单词本管理、学习日记、短语库、构词法、
练习测验、学习统计图表、学习提醒、WebDAV 云备份、AI 智能查词、审批工作流、权限管理等。

**当前阶段**：本地开发阶段。所有数据都是 **mock（模拟）数据**，存在浏览器 localStorage 里。
功能全部做完、测试通过后，再一次性接入真实云端数据库（Supabase）并部署上线。

---

## 2. 怎么运行（快速上手）

- **最简单**：双击项目根目录的 `启动中泰词典.command`，自动装依赖、起服务、开浏览器。
- **命令行**：
  ```bash
  cd /Users/jimmywang/多媒体/开发者/thaidict
  npm install      # 首次（会安装 next 等依赖）
  npm run dev      # 启动 Next.js 开发服务器，http://localhost:3000
  npm run build    # 生产构建，输出到 .next/
  npm run start    # 本地以生产模式运行构建结果
  ```
- **「localhost:3000 打不开」的唯一常见原因**：dev server 没启动。启动它即可。
- 端口固定 **3000**（`next dev` 默认端口；如需改在 `next.config.mjs` 或命令行 `-p` 指定）。

---

## 3. 技术栈

- **框架/构建**：**Next.js 14（App Router）** + React 18.3.1（页面用 JSX，**不用 TypeScript**，
  仅 `src/utils/thaiToken.ts` 为 TS；`next.config.mjs` 已设 `typescript.ignoreBuildErrors`）
- **样式**：CSS 变量 + 内联样式（**不用 Tailwind**），全局样式在 `src/index.css`（由 `app/layout.jsx` 引入）
- **图标**：lucide-react
- **图表**：recharts（学习统计页）
- **数据库客户端**：@supabase/supabase-js（上线时才真正使用）
- **运行环境**：Node 22.x（WorkBuddy 托管版路径 `~/.workbuddy/binaries/node/versions/22.22.2/bin`）

**6 个运行时依赖**：`next`、`@supabase/supabase-js`、`lucide-react`、`react`、`react-dom`、`recharts`。

---

## 4. 目录结构（重点看这里）

```
thaidict/
├── 启动中泰词典.command   # 一键启动脚本（双击运行）
├── todo.md                # 开发待办清单（进度总览）
├── next.config.mjs        # Next.js 配置（端口/构建选项/忽略TS校验）
├── jsconfig.json          # 路径别名 @/* → ./src
├── app/                   # ⭐ Next.js App Router 入口
│   ├── layout.jsx         #   根布局：引入全局 CSS、Google Fonts、title/manifest
│   ├── page.jsx           #   入口页：dynamic(ssr:false) 加载 AppShell
│   └── AppShell.jsx       #   客户端外壳：ErrorBoundary + AppProvider + App（等价于原 main.jsx）
├── rebuild/               # 6 份需求/设计文档（项目的"图纸"）
│   ├── 01-项目基础信息与锁定清单.md
│   ├── 02-全量Bug汇总与修复方案.md
│   ├── 03-未完成功能需求说明书.md
│   ├── 04-新版架构优化规范.md
│   ├── 05-全路由页面详细需求文档.md
│   └── 06-从零搭建分步执行开发手册.md
└── src/
    ├── (入口在 app/)       # React 入口已迁至 app/layout.jsx + app/page.jsx + app/AppShell.jsx
    ├── App.jsx            # 顶层：4 个标签页 + 3 个浮层 + 页面切换
    ├── index.css          # 全局样式 + CSS 变量
    ├── context/
    │   └── AppContext.jsx # 全局状态中枢（登录、导航栈、字体、AI 生成路由等）
    ├── components/        # 通用组件（UIComponents / SentenceDetail / WordBubble / ThaiSentence / PhraseCard / SentenceDetailView）
    ├── icons/             # 自定义图标
    ├── data/              # mock 静态数据（mockData / phraseData）。phraseData 现含 literal（字面意义）/ actual（实际意义）/ advice（学习者建议）/ tags（标签分类）四段式字段
    ├── utils/             # 泰语分词、TTS 朗读
    │   ├── thaiToken.ts   # ⭐ 纯前端 newmm 泰语分词（normalize+正向最长匹配+音节兜底+自定义词库+缓存/防抖客户端）
    │   └── tts.js / thaiSegment.js
    ├── screens/           # 页面（原 pages/，改名避免被 Next Pages Router 误当路由预渲染）
    │   ├── HomePage / WordBookPage / LearnPage / ProfilePage  # 4 大标签页
    │   ├── LoginPage / ResetPasswordPage                       # 登录相关
    │   ├── WordDetailPage / UnknownWordPage                    # 词条详情 / AI 未知词
    │   └── subsections/   # 「我的」页下的各种子页面（设置/统计/日记/审批...）
    └── lib/
        ├── supabase.js    # Supabase 客户端 + isSupabaseConfigured 判断
        ├── ai-proxy.js    # AI 调用代理
        ├── utils.js       # 通用工具（含 getTodayCST 等）
        ├── webdav.js      # WebDAV 导出/上传
        ├── mock/          # 模拟层
        │   ├── store.js   # localStorage 读写（getUserColl/setUserColl/getGlobal/setGlobal/seedIfNeeded）
        │   └── aiProxy.js # 模拟 AI 返回
        └── db/            # ⭐ 数据访问层（页面只依赖这里）
            ├── index.js   # 统一导出所有 db 模块
            ├── auth / search / bookmarks / folders / wordbooks
            ├── sentences / recent / diaries / notes / practice
            ├── checkin / learning / achievements / daily-picks
            ├── community / api-keys / settings
            ├── roles.js       # 权限（super_admin/admin/user）
            └── approvals.js   # AI 生成词条审批（pending_approvals）
```

---

## 5. 核心架构约定（最重要，改代码前必读）

1. **数据层单一入口**：所有页面**只**从 `src/lib/db/*` 取数据，**绝不**在页面里直接写数据库/localStorage 逻辑。
2. **mock / 真实自动切换**：`src/lib/supabase.js` 的 `isSupabaseConfigured` 根据环境变量
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否存在来判断
   （Next.js 中客户端可读的环境变量必须加 `NEXT_PUBLIC_` 前缀）。
   - 没配 → 走 mock（localStorage）
   - 配了 → 走真实 Supabase
   - **页面代码零改动**即可上线。这是整个项目的设计核心。
3. **无路由库**：不用 react-router。用状态驱动导航：4 个标签页 + 3 个浮层 + `navStack`/`navForward` 导航栈（支持前进/后退）。
4. **子页面位置**：「我的」下的子页面放在 `src/screens/subsections/`（原 `src/pages/`，
   Next 的 Pages Router 会把 `pages/` 下每个文件当路由预渲染，故改名为 `screens/`），
   引用通用组件用 `../../components/UIComponents.jsx`（注意是两层 `../../`）。
5. **mock 存储键约定**：
   - 用户私有集合：`getUserColl(userId, key)` / `setUserColl`
   - 全局集合：`getGlobal('__') / setGlobal`（如单词夹内容 folder_words/folder_sentences 用全局键 `'__'`）
6. **权限**：`super_admin`（超管，只能在数据库手动设，UI 不可创建）> `admin`（管理员，权限可勾选）> `user`。
   相关：`roles.js` 的 `hasPermission / isSuperAdmin / PERMISSION_OPTIONS / ROLE_LABELS`。
7. **AI 审批流**：AI 生成的词条先进 `pending_approvals`（`approvals.js`），
   管理员在「审批中心」批准后写入 `community_words` **并**通过 `search.js` 的 `addDictionaryWord` 加入主词典。

---

## 6. 关键工具函数速查

- **朗读发音**：`src/utils/tts.js` 的 `speak()`。
- **泰语分词**：`src/utils/thaiSegment.js`。
- **词义查询**：`search.js` 的 `getWordMeanings(word)`（返回中文含义数组，查不到返回 null）。
- **加词入库**：`search.js` 的 `addDictionaryWord`（mock 写 dictionary / 真实写 dictionary_full 标准格式）。
- **WebDAV**：`src/lib/webdav.js`（`downloadJson` 导出 + `uploadToWebdav` PUT + `saveLocalBackup` 回退）。
- **字体**：`settings.js` 导出 `CHINESE_FONTS / THAI_FONTS / getFontFamily`；
  `AppContext` 启动时把选择应用到 CSS 变量 `--zh-font` / `--th-font`。

---

## 7. 踩过的坑（教训，别再犯）

- **React TDZ 报错**：被 `useEffect`/`useCallback` 依赖数组引用的派生 `const`（如 `userId`），
  必须声明在**所有 hooks 调用之前**（hooks 一执行就会求值依赖数组），否则 `Cannot access 'X' before initialization`。
- **中文路径「开发者」**：写文件/命令时极易误打成「developer」，每次都要核对绝对路径。
- **IconButton 的 disabled**：`UIComponents.IconButton` 曾经忽略 `disabled` prop，后来补上（置灰 + 禁点击）。
- **文件夹计数恒为 0**：统计读的键和写入的键必须一致（统一用全局键 `'__'`）。
- **页面无法滚动**：外层容器要 `display:flex; flexDirection:column; height:100%`，
  内部 `flex:1` 才能拿到约束高度，`overflow-y:auto` 才生效。
- **subsections 引用路径**：通用组件是 `../../components/...`，工具函数在 `mock/store.js` 或 `utils.js`，
  **不能**从 `db/index.js` 导入 `getGlobal/enrichSegmented/transformWordData/getTodayCST`。
- **Next.js 客户端环境变量**：在浏览器端读取的环境变量必须加 `NEXT_PUBLIC_` 前缀
  （原 Vite 的 `VITE_*` 在 Next 里不生效，`supabase.js` 已改为 `NEXT_PUBLIC_SUPABASE_*`）。
- **Next.js 全量客户端渲染**：原 Vite SPA 全靠 `window/localStorage`，直接 SSR 会崩。
  实际采用 `mounted` 守卫方案：`app/page.jsx` 标 `'use client'` 直接 `import AppShell`；
  `AppShell` 用 `useState(false)` + `useEffect(()=>setMounted(true))` 守卫，服务端/首帧只渲染占位，
  浏览器挂载后再渲染 `AppProvider + App`。**不要用 `dynamic(ssr:false)` 包整个 App**。
- **Next dev 错误遮罩会「假死」整页**：任一未捕获的点击事件异常（如 `xxx is not a function`）会触发
  Next 开发模式的**全屏红色 error overlay**，盖在最上层拦截所有点击 → 表现为「卡片、底部菜单全都点不动」。
  排查「点不动」优先看浏览器 console 的 `is not a function` 类报错（曾因 context 漏暴露 `setSelectedSentence` 触发），
  而非只盯 CSS 遮罩。`next build` 生产构建不会出此遮罩。
- **`import.meta` 在 Next 不可用**：任何 `import.meta.env` 都要改成 `process.env.NEXT_PUBLIC_*`，
  `next build` 对 `import.meta.env` 会直接报语法错误。

---

## 8. Git / 部署现状

- 目前**只在本地 commit，没有远程仓库**（按计划阶段 6 上线时再加 remote 并 push）。
- 已有提交（最新在前）：
  - `feat: 修复文件夹计数/滚动/箭头 + 搜索AI按钮 + 词条详情增强 + WebDAV上传导出`
  - `fix: 修复 AppProvider 中 userId TDZ 报错`
  - `feat: 字体设置、权限组、AI 审批、收藏弹层修复`
  - `feat: 完成核心页面与 9 项新功能（Phase 3）`
- 上线目标：Vercel（Next.js 自动部署，**无需 vercel.json**，Vercel 会按 `next` 依赖自动识别）。
  后端接口用 **Next Route Handlers** 实现（对应原计划的 4 个 Edge Function）：
  `app/api/ai-proxy`、`app/api/send-otp`、`app/api/verify-otp`、`app/api/send-reminder`。
  真实上线前需新建数据表：`user_roles`、`pending_approvals`（字段见 `roles.js` / `approvals.js`）。

---

## 9. 下一步（详见 todo.md）

1. **阶段 4**：对照 `rebuild/02-全量Bug汇总与修复方案.md` 逐条核对 A~G 类 Bug 是否已规避。
2. **阶段 5**：整体自测 + 样式打磨（政务 OA 沉稳风：蓝色主调、灰底、细线边框）。
3. **阶段 6**：接入真实 Supabase + 部署 Edge Function + Vercel 上线。
