# 本機開發指南

無需 AWS 環境（Cognito / DynamoDB / Bedrock）即可驗證和開發 Next.js 應用的 UI。

認證中介軟體（JWT 驗證、CSRF 保護、i18n 路由）不會被繞過，與正式環境以相同的流程運作。

---

## 先決條件

| 工具 | 版本 | 確認指令 |
|------|------|---------|
| Node.js | 22 以上 | `node -v` |
| npm | 10 以上 | `npm -v` |

Docker 並非必要（下文也介紹了使用 Docker 的方法）。

---

## 方法 1：npm run dev（最簡單）

### 1. 安裝相依套件

```bash
cd docker/nextjs
npm install
```

### 2. 準備環境變數

```bash
cp .env.development .env.local
```

`.env.local` 不會被 Git 追蹤。其中的值全部是可公開的虛擬值。

### 3. 啟動開發伺服器

```bash
npm run dev
```

在瀏覽器中開啟 http://localhost:3000。

### 4. 登入

中介軟體會自動重新導向至登入頁面（`/zh-TW/signin`）。請使用以下示範使用者登入。

| 使用者名稱 | 密碼 | 角色 | 權限 |
|-----------|------|------|------|
| `admin` | `admin123` | administrator | 全部權限 |
| `developer` | `dev123` | developer | 讀寫 + Agent 建立 |
| `user` | `user123` | user | 僅讀取 |

### 運作原理

```
瀏覽器 → http://localhost:3000
  ↓ 中介軟體：無 JWT → 重新導向至 /zh-TW/signin
  ↓ 提交登入表單
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID 未設定 → 使用示範使用者認證
  ↓   簽發 JWT → 設定 session-token Cookie
  ↓ 中介軟體：JWT 驗證通過 → 顯示頁面
```

不會連線至 Cognito 或 DynamoDB。JWT 的簽署和驗證使用與正式環境相同的 `jose` 函式庫，因此中介軟體的認證流程與正式環境完全一致。

### 限制

| 功能 | 狀態 | 原因 |
|------|------|------|
| 登入·登出 | ✅ 可用 | 僅 JWT 簽發和 Cookie 管理 |
| 頁面導覽·認證守衛 | ✅ 可用 | 中介軟體 JWT 驗證 |
| 語言切換 | ✅ 可用 | next-intl（8 種語言） |
| 深色模式 | ✅ 可用 | Zustand + localStorage |
| 卡片 UI·版面配置 | ✅ 可用 | 靜態元件 |
| RAG 搜尋（KB/Agent） | ❌ 不可用 | 需要 Bedrock 連線 |
| 工作階段持久化 | ❌ 不可用 | 需要 DynamoDB 連線 |
| 使用者權限（SID） | ❌ 不可用 | 需要 DynamoDB + FSx 聯動 |

> 如需工作階段持久化，請使用方法 2（Docker Compose + DynamoDB Local）。

---

## 方法 2：Docker Compose（含 DynamoDB Local）

使用 DynamoDB Local 進行包含工作階段持久化的驗證。

### 額外先決條件

- Docker / Docker Compose

### 1. 啟動

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

以下服務會自動啟動：

| 服務 | 連接埠 | 說明 |
|------|--------|------|
| app | 3000 | Next.js 開發伺服器（支援熱重載） |
| dynamodb-local | 8000 | DynamoDB Local（記憶體模式） |
| dynamodb-setup | — | 工作階段資料表自動建立（僅啟動時） |

### 2. 存取

開啟 http://localhost:3000，使用與方法 1 相同的示範使用者登入。

### 3. 停止

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local 以記憶體模式運作，停止後工作階段資料將遺失。

---

## 登入頁面功能

登入頁面包含以下控制項：

- 語言選擇器（右上角）：可切換 8 種語言。選擇的語言會延續到登入後的頁面。
- 深色模式切換（右上角）：切換亮色/深色。登入後仍然保持。

---

## 模式切換與語言·主題繼承

| 切換 | 語言 | 主題 |
|------|------|------|
| 登入 → 主頁面 | ✅ URL 地區設定保持 | ✅ localStorage 保持 |
| KB 模式 ↔ Agent 模式 | ✅ URL 地區設定保持 | ✅ localStorage 保持 |
| 主頁面 → Agent 列表 | ✅ URL 地區設定保持 | ✅ localStorage 保持 |
| Agent 列表 → KB 模式 | ✅ URL 地區設定保持 | ✅ localStorage 保持 |

語言透過 URL 的地區設定前綴（`/en/genai`、`/zh-TW/genai` 等）管理，因此在所有頁面切換中都會保持。主題透過 Zustand 儲存（localStorage 持久化）在所有頁面間共享。

---

## 疑難排解

### 連接埠 3000 被佔用

```bash
lsof -i :3000
kill -9 <PID>
```

### 無法登入

確認 `.env.local` 存在且 `COGNITO_CLIENT_ID` 未設定。如果已設定，將嘗試 Cognito 認證並失敗。

```bash
# 確認
grep COGNITO_CLIENT_ID .env.local
# → 無輸出表示 OK
```

### 上次工作階段殘留，無法進入登入頁面

刪除瀏覽器 Cookie（`session-token`）或使用無痕視窗開啟。

### `Module not found` 錯誤

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## 檔案結構

```
docker/nextjs/
├── .env.development          # 開發用環境變數（Git 追蹤，僅安全值）
├── .env.local                # 本機覆寫（不被 Git 追蹤，.env.development 的副本）
├── docker-compose.dev.yml    # Docker Compose（含 DynamoDB Local）
├── Dockerfile.dev            # 開發用 Dockerfile
├── src/
│   ├── middleware.ts          # 認證中介軟體（JWT 驗證·CSRF·i18n）
│   └── app/api/auth/signin/
│       └── route.ts           # 登入 API（含示範認證回退）
└── messages/                  # 翻譯檔案（8 種語言）
```
