# Supabase 配置教程：Google / GitHub 登录 + 让邮件走 Brevo 发送

> 适用：thaidict 项目（`https://thaidict.182183.xyz`）
> 你的 Supabase 项目 ref：`zvemahqskgluhirzbcqu`
> 所有操作都在 **Supabase 控制台** 完成，无需改代码。

---

## 0. 先搞清楚：为什么邮件现在不是 Brevo 发的

代码里有两条邮件链路：

| 功能 | 代码调用 | 实际发送方 |
|------|----------|-----------|
| 验证码登录（6 位码） | `/api/send-otp` → `sendBrevoEmail()` | ✅ **Brevo**（已正确） |
| Magic Link / 密码重置 / 注册确认 | `supabase.auth.signInWithOtp()` | ❌ **Supabase 自带邮件器** |

`signInWithOtp` 是 Supabase 官方方法，邮件由 Supabase 自己的邮件服务发出，**不经过 Brevo**。
要让它也走 Brevo，唯一正解：在 Supabase 里把 **Auth 的 SMTP 指向 Brevo 中继**（见第 3 节）。设好后 Supabase 仍负责流程，但真正发信走 Brevo。

---

## 1. 通用前置：配置回调白名单（必做）

进 **Authentication → URL Configuration**，设置：

- **Site URL**：`https://thaidict.182183.xyz`
- **Redirect URLs**（每行一个，带 `**` 通配）：
  ```
  https://thaidict.182183.xyz/**
  https://thaidict-jimmywang.vercel.app/**
  ```

OAuth / Magic Link 回跳地址必须是这里的子集，否则会报 `redirect_uri` 错误。

---

## 2. 开启 Google 登录

### 2.1 在 Google Cloud 创建 OAuth 凭据
1. 打开 <https://console.cloud.google.com/>，选/建一个项目。
2. 左侧 **API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID**。
3. 应用类型选 **Web 应用**。
4. **已获授权的重定向 URI** 添加一条（注意是 Supabase 的回调地址，不是你的域名）：
   ```
   https://zvemahqskgluhirzbcqu.supabase.co/auth/v1/callback
   ```
5. 点创建，复制 **客户端 ID** 和 **客户端密钥**。

### 2.2 在 Supabase 启用
1. 进 **Authentication → Providers → Google**。
2. 开关打开。
3. 粘贴 **Client ID** / **Client Secret**。
4. （可选）**Authorized Client IDs** 填同一个 Client ID，防滥用。
5. 保存。

---

## 3. 开启 GitHub 登录

### 3.1 在 GitHub 创建 OAuth App
1. GitHub → 右上角头像 → **Settings → Developer settings → OAuth Apps → New OAuth App**。
2. **Homepage URL**：`https://thaidict.182183.xyz`
3. **Authorization callback URL**（必须是这条）：
   ```
   https://zvemahqskgluhirzbcqu.supabase.co/auth/v1/callback
   ```
4. 点 **Register application**。
5. 进入该 App → **Generate a new client secret**，复制 **Client ID** 和 **Client Secret**。

### 3.2 在 Supabase 启用
1. **Authentication → Providers → GitHub**。
2. 开关打开。
3. 粘贴 **Client ID** / **Client Secret**。
4. 保存。

---

## 4. 让 Magic Link / 注册确认 / 密码重置 走 Brevo 发信

> 这一步不改代码，只配 Supabase 的 SMTP。配完后 Supabase 的邮件全部经 Brevo 中继发出。

### 4.1 取 Brevo 的 SMTP 凭据
1. 登录 Brevo → **SMTP & API → SMTP**。
2. 记录：
   - **SMTP 服务器**：`smtp-relay.brevo.com`
   - **端口**：`587`（STARTTLS）
   - **SMTP 登录**：你的 Brevo SMTP 用户名（通常是注册邮箱，或页面显示的一串登录名）
   - **SMTP 密码（密钥）**：点 "生成 SMTP 密钥" 得到的那串
3. 确认发件地址 `noreply@thaidict.182183.xyz` 已在 Brevo 验证（**Senders → Manage → 已验证发件域名/地址**）。

### 4.2 填进 Supabase
1. **Authentication → Providers → Email**（不是上面的第三方，是 "Email" 这一项）。
2. 打开 **Custom SMTP** 开关。
3. 填写：
   - Host：`smtp-relay.brevo.com`
   - Port：`587`
   - User：`你的 Brevo SMTP 登录`
   - Password：`你的 Brevo SMTP 密钥`
4. 保存。

### 4.3 把发件人改成你的域名（重要）
1. **Authentication → Email Templates**（或 Settings → Auth → 邮件模板）。
2. 把每个模板的 **From** / **Sender** 改成 `中泰词典 <noreply@thaidict.182183.xyz>`。
3. 保存。

完成后，Magic Link / 注册确认 / 密码重置 都会以 Brevo 名义发出，可在 Brevo 后台看到发送日志。

---

## 5. 验证清单

- [ ] URL Configuration 已加两个 `**` 白名单
- [ ] Google Provider 已启用并填 Client ID/Secret
- [ ] GitHub Provider 已启用并填 Client ID/Secret
- [ ] Email 的 Custom SMTP 指向 Brevo（587 / smtp-relay.brevo.com）
- [ ] Brevo 发件域名 `thaidict.182183.xyz` 已验证
- [ ] 登录页点 Google / GitHub 能跳转第三方并回跳登录
- [ ] 点 "发送登录链接"，Brevo 后台出现该邮件记录

---

## 常见问题

**Q：点 Google 后报 `redirect_uri_mismatch`？**
A：Google Cloud 里的 "已获授权的重定向 URI" 必须是 `https://zvemahqskgluhirzbcqu.supabase.co/auth/v1/callback`，少一个字符都不行。

**Q：GitHub 报 `The redirect_uri MUST match`？**
A：GitHub OAuth App 的 Authorization callback URL 必须同样是上面的 Supabase 回调地址。

**Q：Magic Link 发了但还是 Supabase 官方发件人？**
A：Custom SMTP 没保存成功，或 Brevo 发件域名未验证——检查第 4.2 / 4.3 步。

**Q：验证码登录（6 位码）一直是 Brevo 发的吗？**
A：是的，它走 `/api/send-otp`（Next.js Route Handler → Brevo API），与上面的 Custom SMTP 无关，无需额外配置。
