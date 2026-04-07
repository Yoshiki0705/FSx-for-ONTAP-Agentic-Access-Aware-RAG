# Local Development Guide

Steps to verify and develop the Next.js application UI without an AWS environment (Cognito / DynamoDB / Bedrock).

The authentication middleware (JWT verification, CSRF protection, i18n routing) is not bypassed — it runs with the same flow as production.

---

## Prerequisites

| Tool | Version | Check command |
|------|---------|---------------|
| Node.js | 22 or later | `node -v` |
| npm | 10 or later | `npm -v` |

Docker is not required (a Docker-based method is also described below).

---

## Method 1: npm run dev (simplest)

### 1. Install dependencies

```bash
cd docker/nextjs
npm install
```

### 2. Prepare environment variables

```bash
cp .env.development .env.local
```

`.env.local` is not tracked by Git. All values inside are safe dummy values.

### 3. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 4. Sign in

The middleware automatically redirects to the sign-in page (`/en/signin`). Log in with one of the demo users below.

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| `admin` | `admin123` | administrator | Full access |
| `developer` | `dev123` | developer | Read/write + Agent creation |
| `user` | `user123` | user | Read only |

### How it works

```
Browser → http://localhost:3000
  ↓ Middleware: no JWT → redirect to /en/signin
  ↓ Submit sign-in form
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID not set → authenticate with demo user
  ↓   Issue JWT → set session-token cookie
  ↓ Middleware: JWT valid → render page
```

No connection to Cognito or DynamoDB is made. JWT signing and verification use the same `jose` library as production, so the middleware authentication flow is fully production-equivalent.

### Limitations

| Feature | Status | Reason |
|---------|--------|--------|
| Sign in / sign out | ✅ Works | JWT issuance and cookie management only |
| Page navigation / auth guard | ✅ Works | Middleware JWT verification |
| Language switching | ✅ Works | next-intl (8 languages) |
| Dark mode | ✅ Works | Zustand + localStorage |
| Card UI / layout | ✅ Works | Static components |
| RAG search (KB/Agent) | ❌ Unavailable | Requires Bedrock |
| Session persistence | ❌ Unavailable | Requires DynamoDB |
| User permissions (SID) | ❌ Unavailable | Requires DynamoDB + FSx |

> If you need session persistence, use Method 2 (Docker Compose + DynamoDB Local).

---

## Method 2: Docker Compose (with DynamoDB Local)

A method that includes session persistence using DynamoDB Local.

### Additional prerequisites

- Docker / Docker Compose

### 1. Start

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

The following services start automatically:

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Next.js dev server (hot reload) |
| dynamodb-local | 8000 | DynamoDB Local (in-memory) |
| dynamodb-setup | — | Session table auto-creation (startup only) |

### 2. Access

Open http://localhost:3000 and sign in with the same demo users as Method 1.

### 3. Stop

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local runs in in-memory mode, so session data is lost when stopped.

---

## Sign-in page features

The sign-in page includes the following controls:

- Language selector (top right): Switch between 8 languages. The selected language carries over to the post-login screen.
- Dark mode toggle (top right): Switch between light/dark. Persists after sign-in.

---

## Mode switching and language/theme inheritance

| Transition | Language | Theme |
|------------|----------|-------|
| Sign-in → Main screen | ✅ URL locale preserved | ✅ localStorage preserved |
| KB mode ↔ Agent mode | ✅ URL locale preserved | ✅ localStorage preserved |
| Main screen → Agent Directory | ✅ URL locale preserved | ✅ localStorage preserved |
| Agent Directory → KB mode | ✅ URL locale preserved | ✅ localStorage preserved |

Language is managed via the URL locale prefix (`/en/genai`, `/ja/genai`, etc.), so it is preserved across all page transitions. Theme is shared across all pages via a Zustand store (localStorage persistence).

---

## Troubleshooting

### Port 3000 is in use

```bash
lsof -i :3000
kill -9 <PID>
```

### Cannot sign in

Verify that `.env.local` exists and `COGNITO_CLIENT_ID` is not set. If it is set, Cognito authentication will be attempted and fail.

```bash
# Check
grep COGNITO_CLIENT_ID .env.local
# → No output means OK
```

### Previous session remains and cannot reach the sign-in page

Delete the browser cookie (`session-token`) or open in an incognito window.

### `Module not found` error

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## File structure

```
docker/nextjs/
├── .env.development          # Dev environment variables (Git-tracked, safe values only)
├── .env.local                # Local override (not Git-tracked, copy of .env.development)
├── docker-compose.dev.yml    # Docker Compose (with DynamoDB Local)
├── Dockerfile.dev            # Dev Dockerfile
├── src/
│   ├── middleware.ts          # Auth middleware (JWT verification, CSRF, i18n)
│   └── app/api/auth/signin/
│       └── route.ts           # Sign-in API (with demo auth fallback)
└── messages/                  # Translation files (8 languages)
```
