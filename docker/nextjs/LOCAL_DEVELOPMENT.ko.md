# 로컬 개발 가이드

AWS 환경(Cognito / DynamoDB / Bedrock) 없이 Next.js 애플리케이션의 UI를 검증·개발하기 위한 절차입니다.

인증 미들웨어(JWT 검증·CSRF 보호·i18n 라우팅)를 우회하지 않고, 프로덕션과 동일한 플로우로 동작합니다.

---

## 사전 요구 사항

| 도구 | 버전 | 확인 명령어 |
|------|------|------------|
| Node.js | 22 이상 | `node -v` |
| npm | 10 이상 | `npm -v` |

Docker는 필수가 아닙니다(Docker를 사용하는 방법도 아래에 설명합니다).

---

## 방법 1: npm run dev (가장 간단)

### 1. 의존성 설치

```bash
cd docker/nextjs
npm install
```

### 2. 환경 변수 준비

```bash
cp .env.development .env.local
```

`.env.local`은 Git에서 추적되지 않습니다. 내용은 모두 공개 가능한 더미 값입니다.

### 3. 개발 서버 시작

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

### 4. 로그인

미들웨어가 자동으로 로그인 페이지(`/ko/signin`)로 리다이렉트합니다. 아래 데모 사용자로 로그인하세요.

| 사용자명 | 비밀번호 | 역할 | 권한 |
|---------|---------|------|------|
| `admin` | `admin123` | administrator | 전체 권한 |
| `developer` | `dev123` | developer | 읽기/쓰기 + Agent 생성 |
| `user` | `user123` | user | 읽기 전용 |

### 동작 원리

```
브라우저 → http://localhost:3000
  ↓ 미들웨어: JWT 없음 → /ko/signin으로 리다이렉트
  ↓ 로그인 폼 제출
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID 미설정 → 데모 사용자로 인증
  ↓   JWT 발급 → session-token 쿠키 설정
  ↓ 미들웨어: JWT 검증 OK → 페이지 표시
```

Cognito나 DynamoDB에는 전혀 연결하지 않습니다. JWT 서명·검증은 프로덕션과 동일한 `jose` 라이브러리로 수행되므로, 미들웨어의 인증 플로우는 완전히 프로덕션과 동일합니다.

### 제한 사항

| 기능 | 상태 | 이유 |
|------|------|------|
| 로그인·로그아웃 | ✅ 동작 | JWT 발급·쿠키 관리만 |
| 페이지 이동·인증 가드 | ✅ 동작 | 미들웨어 JWT 검증 |
| 언어 전환 | ✅ 동작 | next-intl (8개 언어) |
| 다크 모드 | ✅ 동작 | Zustand + localStorage |
| 카드 UI·레이아웃 | ✅ 동작 | 정적 컴포넌트 |
| RAG 검색 (KB/Agent) | ❌ 불가 | Bedrock 연결 필요 |
| 세션 영속화 | ❌ 불가 | DynamoDB 연결 필요 |
| 사용자 권한 (SID) | ❌ 불가 | DynamoDB + FSx 연동 필요 |

> 세션 영속화가 필요한 경우 방법 2(Docker Compose + DynamoDB Local)를 사용하세요.

---

## 방법 2: Docker Compose (DynamoDB Local 포함)

DynamoDB Local을 사용하여 세션 영속화를 포함한 검증을 수행하는 방법입니다.

### 추가 사전 요구 사항

- Docker / Docker Compose

### 1. 시작

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

다음 서비스가 자동으로 시작됩니다:

| 서비스 | 포트 | 설명 |
|--------|------|------|
| app | 3000 | Next.js 개발 서버 (핫 리로드 지원) |
| dynamodb-local | 8000 | DynamoDB Local (인메모리) |
| dynamodb-setup | — | 세션 테이블 자동 생성 (시작 시에만) |

### 2. 접속

http://localhost:3000 을 열고 방법 1과 동일한 데모 사용자로 로그인합니다.

### 3. 중지

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local은 인메모리 모드이므로 중지하면 세션 데이터가 사라집니다.

---

## 로그인 페이지 기능

로그인 페이지에는 다음 컨트롤이 있습니다:

- 언어 선택기 (우측 상단): 8개 언어를 전환할 수 있습니다. 선택한 언어는 로그인 후 화면에 그대로 유지됩니다.
- 다크 모드 토글 (우측 상단): 라이트/다크를 전환합니다. 로그인 후에도 유지됩니다.

---

## 모드 전환과 언어·테마 상속

| 전환 | 언어 | 테마 |
|------|------|------|
| 로그인 → 메인 화면 | ✅ URL 로케일 유지 | ✅ localStorage 유지 |
| KB 모드 ↔ Agent 모드 | ✅ URL 로케일 유지 | ✅ localStorage 유지 |
| 메인 화면 → Agent 목록 | ✅ URL 로케일 유지 | ✅ localStorage 유지 |
| Agent 목록 → KB 모드 | ✅ URL 로케일 유지 | ✅ localStorage 유지 |

언어는 URL의 로케일 접두사(`/en/genai`, `/ko/genai` 등)로 관리되므로 모든 화면 전환에서 유지됩니다. 테마는 Zustand 스토어(localStorage 영속화)로 모든 페이지에서 공유됩니다.

---

## 문제 해결

### 포트 3000이 사용 중

```bash
lsof -i :3000
kill -9 <PID>
```

### 로그인할 수 없음

`.env.local`이 존재하고 `COGNITO_CLIENT_ID`가 설정되어 있지 않은지 확인하세요. 설정되어 있으면 Cognito 인증이 시도되어 실패합니다.

```bash
# 확인
grep COGNITO_CLIENT_ID .env.local
# → 출력이 없으면 OK
```

### 이전 세션이 남아 로그인 페이지에 접근할 수 없음

브라우저 쿠키(`session-token`)를 삭제하거나 시크릿 창에서 열어주세요.

### `Module not found` 오류

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## 파일 구성

```
docker/nextjs/
├── .env.development          # 개발용 환경 변수 (Git 추적 대상, 안전한 값만)
├── .env.local                # 로컬 오버라이드 (Git 추적 외, .env.development 복사본)
├── docker-compose.dev.yml    # Docker Compose (DynamoDB Local 포함)
├── Dockerfile.dev            # 개발용 Dockerfile
├── src/
│   ├── middleware.ts          # 인증 미들웨어 (JWT 검증·CSRF·i18n)
│   └── app/api/auth/signin/
│       └── route.ts           # 로그인 API (데모 인증 폴백 포함)
└── messages/                  # 번역 파일 (8개 언어)
```
