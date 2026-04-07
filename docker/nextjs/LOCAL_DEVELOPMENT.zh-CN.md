# 本地开发指南

无需 AWS 环境（Cognito / DynamoDB / Bedrock）即可验证和开发 Next.js 应用的 UI。

认证中间件（JWT 验证、CSRF 保护、i18n 路由）不会被绕过，与生产环境以相同的流程运行。

---

## 前提条件

| 工具 | 版本 | 确认命令 |
|------|------|---------|
| Node.js | 22 以上 | `node -v` |
| npm | 10 以上 | `npm -v` |

Docker 不是必需的（下文也介绍了使用 Docker 的方法）。

---

## 方法 1：npm run dev（最简单）

### 1. 安装依赖

```bash
cd docker/nextjs
npm install
```

### 2. 准备环境变量

```bash
cp .env.development .env.local
```

`.env.local` 不会被 Git 跟踪。其中的值全部是可公开的虚拟值。

### 3. 启动开发服务器

```bash
npm run dev
```

在浏览器中打开 http://localhost:3000。

### 4. 登录

中间件会自动重定向到登录页面（`/zh-CN/signin`）。请使用以下演示用户登录。

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| `admin` | `admin123` | administrator | 全部权限 |
| `developer` | `dev123` | developer | 读写 + Agent 创建 |
| `user` | `user123` | user | 仅读取 |

### 工作原理

```
浏览器 → http://localhost:3000
  ↓ 中间件：无 JWT → 重定向到 /zh-CN/signin
  ↓ 提交登录表单
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID 未设置 → 使用演示用户认证
  ↓   签发 JWT → 设置 session-token Cookie
  ↓ 中间件：JWT 验证通过 → 显示页面
```

不会连接 Cognito 或 DynamoDB。JWT 的签名和验证使用与生产环境相同的 `jose` 库，因此中间件的认证流程与生产环境完全一致。

### 限制

| 功能 | 状态 | 原因 |
|------|------|------|
| 登录·登出 | ✅ 可用 | 仅 JWT 签发和 Cookie 管理 |
| 页面导航·认证守卫 | ✅ 可用 | 中间件 JWT 验证 |
| 语言切换 | ✅ 可用 | next-intl（8 种语言） |
| 暗色模式 | ✅ 可用 | Zustand + localStorage |
| 卡片 UI·布局 | ✅ 可用 | 静态组件 |
| RAG 搜索（KB/Agent） | ❌ 不可用 | 需要 Bedrock 连接 |
| 会话持久化 | ❌ 不可用 | 需要 DynamoDB 连接 |
| 用户权限（SID） | ❌ 不可用 | 需要 DynamoDB + FSx 联动 |

> 如需会话持久化，请使用方法 2（Docker Compose + DynamoDB Local）。

---

## 方法 2：Docker Compose（含 DynamoDB Local）

使用 DynamoDB Local 进行包含会话持久化的验证。

### 额外前提条件

- Docker / Docker Compose

### 1. 启动

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

以下服务会自动启动：

| 服务 | 端口 | 说明 |
|------|------|------|
| app | 3000 | Next.js 开发服务器（支持热重载） |
| dynamodb-local | 8000 | DynamoDB Local（内存模式） |
| dynamodb-setup | — | 会话表自动创建（仅启动时） |

### 2. 访问

打开 http://localhost:3000，使用与方法 1 相同的演示用户登录。

### 3. 停止

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local 以内存模式运行，停止后会话数据将丢失。

---

## 登录页面功能

登录页面包含以下控件：

- 语言选择器（右上角）：可切换 8 种语言。选择的语言会延续到登录后的页面。
- 暗色模式切换（右上角）：切换亮色/暗色。登录后仍然保持。

---

## 模式切换与语言·主题继承

| 切换 | 语言 | 主题 |
|------|------|------|
| 登录 → 主页面 | ✅ URL 区域设置保持 | ✅ localStorage 保持 |
| KB 模式 ↔ Agent 模式 | ✅ URL 区域设置保持 | ✅ localStorage 保持 |
| 主页面 → Agent 列表 | ✅ URL 区域设置保持 | ✅ localStorage 保持 |
| Agent 列表 → KB 模式 | ✅ URL 区域设置保持 | ✅ localStorage 保持 |

语言通过 URL 的区域设置前缀（`/en/genai`、`/zh-CN/genai` 等）管理，因此在所有页面切换中都会保持。主题通过 Zustand 存储（localStorage 持久化）在所有页面间共享。

---

## 故障排除

### 端口 3000 被占用

```bash
lsof -i :3000
kill -9 <PID>
```

### 无法登录

确认 `.env.local` 存在且 `COGNITO_CLIENT_ID` 未设置。如果已设置，将尝试 Cognito 认证并失败。

```bash
# 确认
grep COGNITO_CLIENT_ID .env.local
# → 无输出表示 OK
```

### 上次会话残留，无法进入登录页面

删除浏览器 Cookie（`session-token`）或使用无痕窗口打开。

### `Module not found` 错误

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## 文件结构

```
docker/nextjs/
├── .env.development          # 开发用环境变量（Git 跟踪，仅安全值）
├── .env.local                # 本地覆盖（不被 Git 跟踪，.env.development 的副本）
├── docker-compose.dev.yml    # Docker Compose（含 DynamoDB Local）
├── Dockerfile.dev            # 开发用 Dockerfile
├── src/
│   ├── middleware.ts          # 认证中间件（JWT 验证·CSRF·i18n）
│   └── app/api/auth/signin/
│       └── route.ts           # 登录 API（含演示认证回退）
└── messages/                  # 翻译文件（8 种语言）
```
