# 챗봇 UI 사양

**🌐 Language:** [日本語](../ui-specification.md) | [English](../en/ui-specification.md) | **한국어** | [简体中文](../zh-CN/ui-specification.md) | [繁體中文](../zh-TW/ui-specification.md) | [Français](../fr/ui-specification.md) | [Deutsch](../de/ui-specification.md) | [Español](../es/ui-specification.md)

**작성일**: 2026-03-26  
**대상 독자**: 개발자 및 운영자  
**애플리케이션**: Permission-aware RAG 챗봇

---

## 개요

이 문서는 RAG 챗봇의 각 UI 요소 사양과 백엔드와의 통합을 설명합니다.

---

## 1. 사이드바 — 사용자 정보 섹션

### 표시 내용

| 항목 | 데이터 소스 | 설명 |
|------|-----------|------|
| 사용자 이름 | Cognito JWT | 로그인 시 이메일 주소 |
| 역할 | Cognito JWT | `admin` 또는 `user` |

### 접근 권한 표시

| 항목 | 데이터 소스 | 설명 |
|------|-----------|------|
| 디렉토리 | `/api/fsx/directories` | SID 기반 접근 가능 디렉토리 |
| 읽기 | 위와 동일 | SID 데이터가 있으면 `✅` |
| 쓰기 | 위와 동일 | Domain Admins SID를 가진 사용자만 `✅` |

### 접근 가능 디렉토리 작동 방식

Introduction Message에 세 가지 유형의 디렉토리 정보가 표시됩니다.

| 항목 | 아이콘 | 데이터 소스 | 설명 |
|------|--------|-----------|------|
| FSx 접근 가능 디렉토리 | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | FSx ONTAP에서 파일 수준으로 접근 가능한 디렉토리 |
| RAG 검색 가능 디렉토리 | 🔍 | S3 `.metadata.json`의 SID 매칭 | KB 검색에서 SID가 매칭되는 문서의 디렉토리 |
| Embedding 대상 디렉토리 | 📚 | S3 버킷의 모든 `.metadata.json` | KB에 인덱싱된 모든 디렉토리 |

#### 사용자별 표시 예시

| 사용자 | FSx 접근 | RAG 검색 | Embedding 대상 |
|--------|---------|---------|---------------|
| admin@example.com | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` (표시) |
| user@example.com | `public/` | `public/` | 숨김 (보안을 위해 접근 불가 디렉토리의 존재를 숨김) |

Embedding 대상 디렉토리는 일반 사용자에게 표시되지 않습니다 (접근할 수 없는 디렉토리의 존재를 노출하지 않기 위해). 📚 Embedding 대상 디렉토리는 관리자의 경우처럼 RAG 검색 가능 디렉토리와 Embedding 대상 디렉토리가 동일한 경우에만 표시됩니다.

#### 데이터 조회 흐름

```
/api/fsx/directories?username={email}
  ↓
1. DynamoDB user-access → 사용자 SID 조회
  ↓
2. FSx 디렉토리: SID → SID_DIRECTORY_MAP을 통해 계산
  ↓
3. RAG/Embedding 디렉토리: S3 버킷의 .metadata.json 스캔
   - 각 파일의 allowed_group_sids를 사용자 SID와 매칭
   - 매칭 → RAG 접근 가능
   - 모든 디렉토리 → Embedding 대상
  ↓
4. 세 가지 유형의 디렉토리 정보 반환
```

#### SID-디렉토리 매핑

| SID | 이름 | 접근 가능 디렉토리 |
|-----|------|-------------------|
| `S-1-1-0` | Everyone | `public/` |
| `S-1-5-21-...-512` | Domain Admins | `confidential/`, `restricted/` |
| `S-1-5-21-...-1100` | Engineering | `restricted/` |

#### 사용자별 표시 예시

| 사용자 | 보유 SID | 표시 디렉토리 |
|--------|---------|-------------|
| admin@example.com | Everyone + Domain Admins | `public/`, `confidential/`, `restricted/` |
| user@example.com | Everyone만 | `public/` |

#### 환경 유형 표시

| directoryType | 표시 | 조건 |
|--------------|------|------|
| `sid-based` | 🔐 SID 기반 접근 권한 | DynamoDB SID 데이터에서 성공적으로 조회 |
| `actual` | 🟢 FSx for ONTAP 프로덕션 환경 | FSx API에서 직접 조회 (향후 지원) |
| `fallback` | ⚠️ 시뮬레이션 환경 | DynamoDB 오류 |
| `no-table` | ⚠️ 시뮬레이션 환경 | USER_ACCESS_TABLE_NAME 미설정 |

### 새 디렉토리 추가

1. S3에 문서와 `.metadata.json` 업로드
2. `.metadata.json`의 `allowed_group_sids`에 적절한 SID 설정
3. Bedrock KB 데이터 소스 동기화
4. `/api/fsx/directories`의 `SID_DIRECTORY_MAP`에 매핑 추가

```typescript
// docker/nextjs/src/app/api/fsx/directories/route.ts
const SID_DIRECTORY_MAP: Record<string, string[]> = {
  'S-1-1-0': ['public/'],
  'S-1-5-21-...-512': ['confidential/', 'restricted/'],
  'S-1-5-21-...-1100': ['restricted/'],
  // 새 디렉토리 추가:
  'S-1-5-21-...-1200': ['engineering-docs/'],
};
```

---

## 2. 사이드바 — Bedrock 리전 섹션

### 표시 내용

| 항목 | 데이터 소스 | 설명 |
|------|-----------|------|
| 리전 이름 | `RegionConfigManager` | 선택된 리전의 표시 이름 |
| 리전 ID | `regionStore` | 예: `ap-northeast-1` |
| 모델 수 | `/api/bedrock/region-info` | 선택된 리전에서 사용 가능한 모델 수 |

### 리전 변경 흐름

```
사용자가 리전 선택
  ↓
RegionSelector → /api/bedrock/change-region (POST)
  ↓
Cookie bedrock_region 업데이트
  ↓
페이지 새로고침
  ↓
/api/bedrock/region-info → 새 리전의 모델 목록 조회
  ↓
/api/bedrock/models → 모델 선택기 업데이트
```

### 리전별 모델 수 (2026-03-25 기준)

| 리전 | 모델 수 | 비고 |
|------|---------|------|
| 도쿄 (ap-northeast-1) | 57 | 기본 |
| 오사카 (ap-northeast-3) | 9 | |
| 싱가포르 (ap-southeast-1) | 18 | |
| 시드니 (ap-southeast-2) | 59 | |
| 뭄바이 (ap-south-1) | 58 | |
| 서울 (ap-northeast-2) | 19 | |
| 아일랜드 (eu-west-1) | 50 | |
| 프랑크푸르트 (eu-central-1) | 29 | |
| 런던 (eu-west-2) | 52 | |
| 파리 (eu-west-3) | 25 | |
| 버지니아 (us-east-1) | 96 | |
| 오레곤 (us-west-2) | 103 | 최다 |
| 오하이오 (us-east-2) | 76 | |
| 상파울루 (sa-east-1) | 43 | |

> 모델 수는 `ListFoundationModels(byOutputModality=TEXT)` 결과입니다. 새 모델 추가 시 `/api/bedrock/region-info`의 `REGION_MODEL_COUNTS`를 업데이트하세요.

---

## 3. AI 모델 선택 섹션

### 모델 목록 조회

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
provider-patterns.ts를 통해 프로바이더 자동 감지
  ↓
모든 모델 반환 (Unknown 프로바이더 포함)
```

### 지원 프로바이더 (13개)

amazon, anthropic, cohere, deepseek, google, minimax, mistral, moonshot, nvidia, openai, qwen, twelvelabs, zai

### 모델 선택 시 처리

KB Retrieve API 사용 시 선택된 모델 ID에 따라 Converse API 호출 방식이 달라집니다.

| 모델 ID 패턴 | 처리 |
|-------------|------|
| `apac.xxx` / `us.xxx` / `eu.xxx` | 추론 프로파일로 그대로 사용 |
| `anthropic.xxx` | 온디맨드로 직접 호출 |
| `google.xxx`, `qwen.xxx`, `deepseek.xxx` 등 | 온디맨드로 직접 호출 |
| `amazon.nova-pro-v1:0` 등 (프레픽스 없음) | Claude Haiku로 폴백 |
| 레거시 모델 | 자동 폴백 (Nova Lite → Claude Haiku) |

### 폴백 체인

```
선택된 모델 → (실패) → apac.amazon.nova-lite-v1:0 → (실패) → anthropic.claude-3-haiku-20240307-v1:0
```

레거시 모델 오류, 온디맨드 미사용 오류, ValidationException 발생 시 자동으로 다음 모델을 시도합니다.

---

## 4. 채팅 영역 — Introduction Message

### 표시 내용

로그인 후 자동 생성되는 초기 메시지입니다.

| 섹션 | 내용 |
|------|------|
| 인사말 | 사용자 이름을 포함한 환영 메시지 |
| 접근 권한 | 사용자 이름, 역할, 접근 가능 디렉토리 |
| 환경 유형 | SID 기반 / FSx 프로덕션 / 시뮬레이션 |
| 권한 상세 | 읽기 / 쓰기 / 실행 가능 여부 |
| 사용 가능 기능 | 문서 검색 및 Q&A, 권한 기반 접근 제어 |

### 다국어 지원

8개 언어 지원 (ja, en, de, es, fr, ko, zh-CN, zh-TW). 번역 키는 `docker/nextjs/src/messages/{locale}.json`의 `introduction` 섹션에 정의됩니다.

---

## 5. 채팅 영역 — RAG 검색 흐름

### 2단계 방식 (Retrieve + Converse)

```
사용자 질문
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
단계 1: DynamoDB user-access → 사용자 SID 조회
  ↓
단계 2: Bedrock KB Retrieve API → 벡터 검색 (메타데이터 포함)
  ↓
단계 3: SID 필터링
  - 문서의 allowed_group_sids를 사용자 SID와 매칭
  - 매칭 → 허용, 미매칭 → 거부
  ↓
단계 4: Converse API → 허용된 문서만으로 응답 생성
  ↓
응답 + Citation + filterLog 반환
```

### RetrieveAndGenerate API를 사용하지 않는 이유

RetrieveAndGenerate API는 Citation의 `metadata` 필드에 `.metadata.json`의 `allowed_group_sids`를 포함하지 않습니다. Retrieve API는 메타데이터를 올바르게 반환하므로 2단계 방식을 채택합니다.

### 프론트엔드 폴백

KB Retrieve API가 500 오류를 반환하면, 프론트엔드는 일반 Bedrock Chat API(`/api/bedrock/chat`)로 폴백합니다. 이 경우 KB 문서를 참조하지 않는 일반 AI 응답이 반환됩니다.

---

## 6. API 목록

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/bedrock/kb/retrieve` | POST | RAG 검색 + SID 필터링 + 응답 생성 |
| `/api/bedrock/chat` | POST | 일반 채팅 (KB 없음, 폴백용) |
| `/api/bedrock/models` | GET | 사용 가능한 모델 목록 |
| `/api/bedrock/region-info` | GET | 리전 정보 + 모델 수 |
| `/api/bedrock/change-region` | POST | 리전 변경 (Cookie 업데이트) |
| `/api/fsx/directories` | GET | 사용자의 접근 가능 디렉토리 (SID 기반) |
| `/api/auth/signin` | POST | Cognito 인증 |
| `/api/auth/session` | GET | 세션 정보 |
| `/api/auth/signout` | POST | 로그아웃 |
| `/api/health` | GET | 헬스 체크 |

---

## 7. 환경 변수

Lambda 함수에 설정되는 환경 변수입니다.

| 변수 이름 | 설명 | 예시 |
|----------|------|------|
| `DATA_BUCKET_NAME` | KB 데이터 소스 S3 버킷 이름 | `perm-rag-demo-demo-kb-data-${ACCOUNT_ID}` |
| `BEDROCK_KB_ID` | Knowledge Base ID | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Bedrock 리전 | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | DynamoDB user-access 테이블 이름 | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | 권한 확인 활성화 | `true` |

---

## 8. 문제 해결

### 채팅에서 문서 정보가 반환되지 않음

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| 모든 사용자에게 정보 미반환 | KB 미동기화 또는 BEDROCK_KB_ID 미설정 | `sync-kb-datasource.sh` 실행, 환경 변수 확인 |
| admin에게도 기밀 정보 미반환 | SID 데이터 미등록 | `setup-user-access.sh` 실행 |
| 응답은 반환되지만 Citation 없음 | 폴백 Chat API 사용 중 | Lambda 로그에서 500 오류 확인 |
| "접근 권한이 있는 문서를 찾을 수 없습니다" | SID 매칭 없음 | DynamoDB의 SID 데이터와 메타데이터의 SID 확인 |

### 모델 선택 시 500 오류

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| 특정 모델에서 500 | 레거시 모델 또는 온디맨드 미사용 | 자동 폴백으로 처리됨 |
| 모든 모델에서 500 | Lambda 타임아웃 | Lambda 타임아웃을 30초 이상으로 설정 |

### 디렉토리 표시에 "❓ 알 수 없는 환경" 표시

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| 알 수 없는 환경 표시 | `directoryType`에 미지원 값 | `page.tsx`의 switch 케이스 확인 |
| 디렉토리가 비어 있음 | SID 데이터 미등록 | `setup-user-access.sh` 실행 |

---

## 8. KB/Agent 모드 전환

### 개요

헤더에 KB/Agent 모드 토글이 배치되어 두 모드 간 원활한 전환이 가능합니다.

```
┌─────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵  │
│                                                         │
│    📚 Knowledge Base  ← 모드에 따라 동적 변경           │
│    🤖 Agent                                             │
└─────────────────────────────────────────────────────────┘
```

### 모드 전환 메커니즘

| 항목 | 설명 |
|------|------|
| 토글 위치 | 헤더 타이틀 오른쪽 |
| 상태 관리 | `useState` + URL 파라미터 (`?mode=agent`) |
| 영속화 | URL 파라미터를 통해 영속화 (북마크 가능) |
| 기본값 | KB 모드 (`?mode` 파라미터 없음) |

### 모드별 동작

| 기능 | KB 모드 | Agent 모드 |
|------|---------|-----------|
| 사이드바 | KBModeSidebar (인라인) | AgentModeSidebar (컴포넌트) |
| 모델 목록 | `/api/bedrock/region-info` (모든 모델) | `/api/bedrock/agent-models` (Agent 호환 모델만) |
| 모델 조회 방식 | 정적 설정 + API | Bedrock `ListFoundationModels` API (`ON_DEMAND` + `TEXT` 필터) |
| 채팅 API | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve` (`agentMode=true` 플래그 포함) |
| SID 필터링 | ✅ 예 | ✅ 예 (하이브리드 방식) |
| 헤더 배지 | 📚 Knowledge Base (파란색) | 🤖 Agent (보라색) |
| 운영 모드 표시 | 📚 Knowledge Base | 🤖 Agent |

### Agent 모드 하이브리드 방식

Agent 모드는 Permission-aware RAG를 실현하기 위해 하이브리드 방식을 채택합니다.

```
사용자 질문
  │
  ▼
KB Retrieve API (벡터 검색)
  │
  ▼
SID 필터링 (KB 모드와 동일한 파이프라인)
  │ 사용자 SID ∩ 문서 SID → 허용/거부
  ▼
허용된 문서만 컨텍스트로
  │
  ▼
Converse API (Agent 시스템 프롬프트 포함)
  │ "다단계 추론과 문서 검색을 사용하여 AI 에이전트로서 응답"
  ▼
응답 + Citation 표시
```

**하이브리드 방식의 이유:**
- Bedrock Agent InvokeAgent API는 애플리케이션 측에서 SID 필터링을 허용하지 않음
- KB Retrieve API는 메타데이터(`allowed_group_sids`)를 반환하여 SID 필터링 가능
- 기존 SID 필터링 파이프라인을 그대로 재사용 가능

### Agent 호환 모델 동적 조회

Agent 호환 모델은 하드코딩이 아닌 Bedrock API에서 동적으로 조회됩니다.

```
/api/bedrock/agent-models?region=ap-northeast-1
  │
  ▼
BedrockClient.ListFoundationModels({
  byOutputModality: 'TEXT',
  byInferenceType: 'ON_DEMAND',
})
  │
  ▼
필터:
  - TEXT 입력 + TEXT 출력
  - ON_DEMAND 추론 지원
  - Embedding 모델 제외
  │
  ▼
Agent 호환 모델 목록 (유지보수 불필요)
```

### AgentModeSidebar 구조

워크플로우 선택이 중앙 카드 그리드에 통합되어 사이드바에서 제거되었습니다. 사이드바는 Agent 정보 표시와 접을 수 있는 시스템 관리 섹션으로 구성됩니다.

```
┌─────────────────────────┐
│ 워크플로우 정보          │
│  [Agent 선택 ▼]         │
│  Agent ID: 1YZW9MRRSA   │
│  Agent 이름: presentation│
│  상태: ✅ PREPARED       │
│  설명: Based on..       │
│  [🚀 새로 생성] [🗑️ 삭제]│
├─────────────────────────┤
│ ▶ ⚙️ 시스템 관리        │  ← CollapsiblePanel (기본 접힘)
│   리전 설정              │
│   AI 모델 선택           │
│   기능                   │
│   채팅 기록              │
└─────────────────────────┘
```

![Agent Mode Sidebar](screenshots/agent-mode-sidebar.png)

### 워크플로우 선택

워크플로우 선택은 중앙 카드 그리드에 통합되어 있습니다 (섹션 9 참조). 카드 클릭 시 카테고리에 해당하는 Bedrock Agent가 자동으로 검색 및 동적 생성되고, 프롬프트가 채팅 입력 필드에 자동 설정됩니다 (`agent-workflow-selected` 커스텀 이벤트).

### Agent 호출 흐름 (전체 구현)

```
사용자 질문 또는 워크플로우 선택
  │
  ▼
InvokeAgent API (Bedrock Agent Runtime)
  │ Agent ID + Alias ID + Session ID
  │ 스트리밍 응답
  ▼
Agent 다단계 추론
  ├── KB 검색 (Agent 내부)
  ├── Action Group 호출 (구성 시)
  └── 응답 생성
  │
  ▼
성공 → Agent 응답 + Citation (trace에서 추출)
  │
  ▼ 실패 시 폴백
KB Retrieve API → SID 필터링 → Converse API
  │ (하이브리드 방식, Permission-aware 보장)
  ▼
응답 + Citation 표시
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | 모드 토글, 조건부 사이드바 렌더링 |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agent 모드 사이드바 |
| `docker/nextjs/src/components/bedrock/AgentInfoSection.tsx` | Agent 선택 및 정보 표시 |
| `docker/nextjs/src/components/bedrock/ModelSelector.tsx` | 모델 선택 (KB/Agent 전환용 `mode` 속성) |
| `docker/nextjs/src/app/api/bedrock/agent-models/route.ts` | Agent 호환 모델 API (동적 조회) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Agent API (invoke, create, delete, list) |
| `docker/nextjs/src/hooks/useAgentMode.ts` | 모드 전환 로직 |
| `docker/nextjs/src/hooks/useAgentsList.ts` | Agent 목록 조회 |
| `docker/nextjs/src/store/useAgentStore.ts` | Agent 상태 관리 (Zustand) |

---

## 9. 카드 기반 태스크 지향 UI

### 개요

채팅 영역의 초기 상태(사용자 메시지가 없는 경우)에 카드 그리드를 표시하는 기능입니다. KB 모드에서는 14개의 목적별 카드(문서 검색, 요약 작성 등), Agent 모드에서는 14개의 워크플로우 카드(재무 분석, 프로젝트 관리, 프레젠테이션 작성 등)가 제시되어 원클릭으로 프롬프트를 입력할 수 있습니다.

![KB Mode Card Grid](screenshots/kb-mode-cards-full.png)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ InfoBanner ──────────────────────────────────────────┐  │
│  │ admin@example.com | admin | 📁 3개 디렉토리  ▼       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [전체] [검색] [요약] [학습] [분석] ← CategoryFilter        │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ 🔍       │ │ 📝       │ │ 📚       │                    │
│  │ 문서     │ │ 요약     │ │ 퀴즈     │  ← TaskCard        │
│  │ 검색     │ │ 작성     │ │ 생성기   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ ⚖️       │ │ 🏷️       │ │ 📊       │                    │
│  │ 비교     │ │ 키워드   │ │ 보고서   │                    │
│  │ 분석     │ │ 검색     │ │ 요약     │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 컴포넌트 구조

| 컴포넌트 | 파일 경로 | 역할 |
|----------|----------|------|
| CardGrid | `docker/nextjs/src/components/cards/CardGrid.tsx` | 메인 컨테이너. InfoBanner, CategoryFilter, TaskCard를 통합; 모드별 카드 표시, 필터링, 즐겨찾기 정렬 처리 |
| TaskCard | `docker/nextjs/src/components/cards/TaskCard.tsx` | 개별 카드 컴포넌트 (KB/Agent 공유). 아이콘, 제목, 설명, 즐겨찾기 토글 표시 |
| InfoBanner | `docker/nextjs/src/components/cards/InfoBanner.tsx` | 권한 정보 배너. 기존 Introduction Text 정보를 컴팩트한 접기/펼치기 형식으로 표시 |
| CategoryFilter | `docker/nextjs/src/components/cards/CategoryFilter.tsx` | 카테고리 필터 칩. 모드별 카테고리로 카드 필터링 |

#### 컴포넌트 계층

```
CardGrid
├── InfoBanner          # 권한 정보 배너 (접기/펼치기)
├── CategoryFilter      # 카테고리 필터 칩
└── TaskCard × N        # 개별 카드 (그리드 표시)
    └── 즐겨찾기 버튼    # ★/☆ 토글
```

#### CardGrid Props

```typescript
interface CardGridProps {
  mode: 'kb' | 'agent';
  locale: string;
  onCardClick: (promptTemplate: string, label: string) => void;
  username: string;
  role: string;
  userDirectories: any | null;
}
```

#### TaskCard Props

```typescript
interface TaskCardProps {
  card: CardData;
  isFavorite: boolean;
  onFavoriteToggle: (cardId: string) => void;
  onClick: (promptTemplate: string, label: string) => void;
  locale: string;
}
```

### 카드 데이터

카드 데이터는 `docker/nextjs/src/constants/card-constants.ts`에서 중앙 관리됩니다.

#### CardData 타입 정의

```typescript
interface CardData {
  id: string;                // 고유 식별자 (예: 'kb-doc-search')
  icon: string;              // emoji (예: '🔍')
  titleKey: string;          // 번역 키 (예: 'cards.kb.docSearch.title')
  descriptionKey: string;    // 번역 키 (예: 'cards.kb.docSearch.description')
  promptTemplateKey: string; // 번역 키 (예: 'cards.kb.docSearch.prompt')
  category: string;          // 카테고리 ID (예: 'search')
  mode: 'kb' | 'agent';     // 표시 모드
}
```

#### KB 모드 카드 목록 (14개 카드)

##### 리서치 카테고리 (8개 카드)

| ID | 아이콘 | 카테고리 | 용도 |
|----|--------|---------|------|
| `kb-doc-search` | 🔍 | search | 문서 검색 |
| `kb-doc-summary` | 📝 | summary | 요약 작성 |
| `kb-quiz-gen` | 📚 | learning | 퀴즈 생성 |
| `kb-compare` | ⚖️ | analysis | 비교 분석 |
| `kb-keyword-search` | 🏷️ | search | 키워드 검색 |
| `kb-report-summary` | 📊 | summary | 보고서 요약 |
| `kb-qa-gen` | ❓ | learning | Q&A 생성 |
| `kb-trend-analysis` | 📈 | analysis | 트렌드 분석 |

##### 출력 카테고리 (6개 카드)

| ID | 아이콘 | 카테고리 | 용도 |
|----|--------|---------|------|
| `kb-presentation` | 🎬 | output | 프레젠테이션 작성 |
| `kb-approval` | 📋 | output | 품의서 작성 |
| `kb-minutes` | 🗒️ | output | 회의록 작성 |
| `kb-report-gen` | 📑 | output | 보고서 자동 생성 |
| `kb-contract` | 📄 | output | 계약서 검토 |
| `kb-onboarding` | 🎓 | output | 온보딩 자료 |

#### Agent 모드 카드 목록 (14개 카드)

##### 리서치 카테고리 (8개 카드)

| ID | 아이콘 | 카테고리 | 용도 |
|----|--------|---------|------|
| `agent-financial` | 📊 | financial | 재무 보고서 분석 |
| `agent-project` | 📝 | project | 프로젝트 진행 확인 |
| `agent-cross-search` | 🔍 | search | 크로스 문서 검색 |
| `agent-hr` | 📋 | hr | HR 정책 확인 |
| `agent-risk` | ⚠️ | financial | 리스크 분석 |
| `agent-milestone` | 🎯 | project | 마일스톤 관리 |
| `agent-compliance` | 🔐 | hr | 컴플라이언스 확인 |
| `agent-data-analysis` | 📉 | search | 데이터 분석 |

##### 출력 카테고리 (6개 카드)

| ID | 아이콘 | 카테고리 | 용도 |
|----|--------|---------|------|
| `agent-presentation` | 📊 | presentation | 프레젠테이션 작성 |
| `agent-approval` | 📋 | approval | 품의서 작성 |
| `agent-minutes` | 📝 | minutes | 회의록 작성 |
| `agent-report` | 📈 | report | 보고서 작성 |
| `agent-contract` | 📄 | contract | 계약서 검토 |
| `agent-onboarding` | 🎓 | onboarding | 온보딩 자료 작성 |

![Agent Mode Card Grid](screenshots/agent-mode-card-grid.png)

### 표시 조건

CardGrid 표시는 사용자 메시지의 존재 여부로 제어됩니다.

| 조건 | 표시 내용 |
|------|----------|
| 사용자 메시지 없음 (`messages`에 `role === 'user'` 항목 0개) | CardGrid 표시 |
| 사용자 메시지 있음 (`role === 'user'` 항목 1개 이상) | 일반 메시지 목록 표시 + "🔄 워크플로우 선택으로 돌아가기" 버튼 |
| "새 채팅" 버튼 클릭 | 새 세션 생성 → CardGrid 재표시 |
| "🔄 워크플로우 선택으로 돌아가기" 버튼 클릭 | 새 세션 생성 → CardGrid 재표시 |

```typescript
// page.tsx의 표시 전환 로직
const hasUserMessages = currentSession?.messages?.some(m => m.role === 'user') ?? false;

{!hasUserMessages ? (
  <CardGrid
    mode={agentMode ? 'agent' : 'kb'}
    locale={memoizedLocale}
    onCardClick={(prompt, label) => {
      setInputText(prompt);
      if (agentMode) {
        window.dispatchEvent(new CustomEvent('agent-workflow-selected', {
          detail: { prompt, label }
        }));
      }
    }}
    username={user?.email || ''}
    role={user?.role || ''}
    userDirectories={userDirectories}
  />
) : (
  // 기존 메시지 목록 표시
  currentSession?.messages?.map(...)
)}
```

### "워크플로우 선택으로 돌아가기" 버튼

채팅 중(사용자 메시지 1개 이상 존재 시) 채팅 입력 영역 위에 "🔄 워크플로우 선택으로 돌아가기" 버튼이 표시됩니다. 클릭하면 새 세션이 생성되어 카드 그리드로 돌아갑니다.

![Chat Response + Citation + Back Button](screenshots/kb-mode-chat-citation.png)

| 항목 | 설명 |
|------|------|
| 표시 조건 | `currentSession.messages`에 `role === 'user'` 항목 1개 이상 |
| 위치 | 채팅 입력 영역 위 |
| 동작 | 새 ChatSession을 생성하고 `setCurrentSession`으로 설정. 카드 그리드 재표시 |
| 스타일 | 텍스트 링크 스타일 (`text-blue-600`), 🔄 아이콘 포함 |

### 즐겨찾기 관리

#### Zustand Store

**파일**: `docker/nextjs/src/store/useFavoritesStore.ts`

```typescript
interface FavoritesStore {
  favorites: string[];                        // 즐겨찾기 카드 ID 목록
  toggleFavorite: (cardId: string) => void;   // 즐겨찾기 토글 (추가/제거)
  isFavorite: (cardId: string) => boolean;    // 즐겨찾기 확인
}
```

| 항목 | 설명 |
|------|------|
| 영속화 방식 | Zustand `persist` 미들웨어 + localStorage |
| localStorage 키 | `card-favorites-storage` |
| 폴백 | localStorage 사용 불가 시 인메모리만 (세션 중 유지) |
| 정렬 동작 | 즐겨찾기 카드가 그리드 상단에 표시. 각 그룹 내 상대적 순서 유지 |

#### 정렬 로직

```typescript
// card-constants.ts
function sortCardsByFavorites(cards: CardData[], favorites: string[]): CardData[] {
  const favoriteSet = new Set(favorites);
  const favoriteCards = cards.filter((card) => favoriteSet.has(card.id));
  const nonFavoriteCards = cards.filter((card) => !favoriteSet.has(card.id));
  return [...favoriteCards, ...nonFavoriteCards];
}
```

### 카테고리 필터링

#### KB 모드 카테고리

| 카테고리 ID | 번역 키 | 표시 이름 (ko) |
|------------|---------|---------------|
| `all` | `cards.categories.all` | 전체 |
| `search` | `cards.categories.search` | 검색 |
| `summary` | `cards.categories.summary` | 요약 |
| `learning` | `cards.categories.learning` | 학습 |
| `analysis` | `cards.categories.analysis` | 분석 |
| `output` | `cards.categories.output` | 문서 작성 |

#### Agent 모드 카테고리

| 카테고리 ID | 번역 키 | 표시 이름 (ko) |
|------------|---------|---------------|
| `all` | `cards.categories.all` | 전체 |
| `financial` | `cards.categories.financial` | 재무 |
| `project` | `cards.categories.project` | 프로젝트 |
| `hr` | `cards.categories.hr` | HR |
| `search` | `cards.categories.search` | 검색 |
| `presentation` | `cards.categories.presentation` | 문서 작성 |
| `approval` | `cards.categories.approval` | 품의 |
| `minutes` | `cards.categories.minutes` | 회의록 |
| `report` | `cards.categories.report` | 보고서 |
| `contract` | `cards.categories.contract` | 계약 |
| `onboarding` | `cards.categories.onboarding` | 온보딩 |

#### 필터링 동작

| 액션 | 동작 |
|------|------|
| 카테고리 선택 | 선택된 카테고리와 매칭되는 카드만 표시 |
| "전체" 선택 | 현재 모드의 모든 카드 표시 |
| 모드 전환 (KB↔Agent) | 카테고리 선택을 "전체"로 초기화 |

### InfoBanner

기존 Introduction Text 정보를 컴팩트한 배너로 통합합니다.

#### 접힌 상태 (기본값)

한 줄 표시: `사용자 이름 | 역할 | 📁 N개 디렉토리 접근`

#### 펼친 상태

| 표시 항목 | 설명 |
|----------|------|
| 사용자 이름 | Cognito JWT의 이메일 주소 |
| 역할 | `admin` 또는 `user` |
| SID | 사용자의 보안 식별자 |
| 디렉토리 목록 | 세 가지 유형: FSx / RAG / Embedding |
| 권한 상세 | 읽기 ✅/❌, 쓰기 ✅/❌, 실행 ✅/❌ |

기존 Introduction Text에 포함된 모든 정보(사용자 이름, 역할, SID, 디렉토리 목록, 권한 상세)가 보존됩니다.

#### InfoBanner Props

```typescript
interface InfoBannerProps {
  username: string;
  role: string;
  userDirectories: any | null;
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
```

### 번역

8개 언어 모두 지원합니다. 번역 키는 각 언어의 `messages/{locale}.json` 내 `cards` 네임스페이스에 정의됩니다.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/components/cards/CardGrid.tsx` | 카드 그리드 메인 컨테이너 |
| `docker/nextjs/src/components/cards/TaskCard.tsx` | 개별 카드 컴포넌트 (KB/Agent 공유) |
| `docker/nextjs/src/components/cards/InfoBanner.tsx` | 권한 정보 배너 (접기/펼치기) |
| `docker/nextjs/src/components/cards/CategoryFilter.tsx` | 카테고리 필터 칩 |
| `docker/nextjs/src/constants/card-constants.ts` | 카드 데이터 정의, 헬퍼 함수, AGENT_CATEGORY_MAP |
| `docker/nextjs/src/store/useFavoritesStore.ts` | 즐겨찾기 관리 Zustand 스토어 |
| `docker/nextjs/src/services/cardAgentBindingService.ts` | Agent 검색, 동적 생성, 카드 바인딩 서비스 |
| `docker/nextjs/src/store/useCardAgentMappingStore.ts` | 카드-Agent 매핑 영속화 |
| `docker/nextjs/src/messages/{locale}.json` | 번역 파일 (`cards` 네임스페이스) |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | CardGrid 통합, 표시 조건 제어, 뒤로가기 버튼 |

---

## 10. 사이드바 레이아웃 재설계

### 개요

Agent 모드 사이드바의 재설계로, 시스템 설정(리전, 모델 선택 등)을 접을 수 있게 하고 워크플로우 섹션을 사이드바 상단에 배치합니다.

### 레이아웃 구조

KB 모드와 Agent 모드 모두에서 시스템 관리 섹션(리전, 모델 선택 등)이 접을 수 있습니다.

#### KB 모드

```
┌─────────────────────────┐
│ 사용자 정보              │
│  admin@example.com       │
│  (administrator)         │
├─────────────────────────┤
│ 접근 권한                │
│  📁 디렉토리 ✅ 읽기    │
├─────────────────────────┤
│ ▶ ⚙️ 시스템 관리        │  ← CollapsiblePanel (접기 가능)
│   Bedrock 리전           │
│   AI 모델 선택           │
│   채팅 기록              │
│   KB 기능                │
└─────────────────────────┘
```

#### Agent 모드

```
┌─────────────────────────┐
│ 워크플로우 정보          │
│  [Agent 선택 ▼]         │
│  Agent ID / Agent 이름   │
│  상태 / 설명             │
│  [🚀 새로 생성] [🗑️ 삭제]│
├─────────────────────────┤
│ ▶ ⚙️ 시스템 관리        │  ← CollapsiblePanel (기본 접힘)
│   리전 설정              │
│   AI 모델 선택           │
│   기능                   │
│   채팅 기록              │
└─────────────────────────┘
```

### 새 컴포넌트

| 컴포넌트 | 파일 경로 | 역할 |
|----------|----------|------|
| CollapsiblePanel | `docker/nextjs/src/components/ui/CollapsiblePanel.tsx` | 접기/펼치기 패널. 시스템 설정 섹션을 래핑 |
| WorkflowSection | `docker/nextjs/src/components/ui/WorkflowSection.tsx` | 워크플로우 카드 목록. Agent 모드에서 사이드바 상단에 표시 |

### 상태 관리

| 스토어 | 파일 경로 | 역할 |
|--------|----------|------|
| useSidebarStore | `docker/nextjs/src/store/useSidebarStore.ts` | 사이드바 접힘 상태 관리 (Zustand + localStorage 영속화) |

### 동작 사양

| 항목 | 설명 |
|------|------|
| 기본 상태 | 시스템 설정: 접힘 (KB/Agent 모드 모두) |
| 영속화 | Zustand persist 미들웨어를 통한 localStorage |
| KB 모드 | 사용자 정보 + 접근 권한 + 접을 수 있는 시스템 관리 |
| Agent 모드 | Agent 정보 (선택, 생성, 삭제) + 접을 수 있는 시스템 관리 |

---

## 11. 동적 Agent-카드 바인딩

### 개요

카드 클릭 시 카테고리에 해당하는 Agent를 검색하고, 존재하지 않으면 동적으로 생성하여 카드에 바인딩하는 기능입니다.

### 흐름

```
카드 클릭
  │
  ▼
cardAgentBindingService
  │ 1. AGENT_CATEGORY_MAP을 통해 카테고리 판정
  │ 2. 기존 Agent 검색 (이름 매칭)
  │ 3. 미발견 시 → Bedrock CreateAgent API로 동적 생성
  │ 4. 카드-Agent 매핑 영속화
  ▼
Agent InvokeAgent API로 실행
```

### AGENT_CATEGORY_MAP (10개 카테고리)

카드 카테고리와 Agent 간의 대응을 정의하는 매핑입니다. 각 카테고리에는 Agent 이름 프레픽스, 시스템 프롬프트, 권장 모델이 구성되어 있습니다.

| 카테고리 | Agent 이름 프레픽스 | 용도 |
|---------|-------------------|------|
| financial | FinancialAnalysis | 재무 보고서 분석 및 리스크 분석 |
| project | ProjectManagement | 프로젝트 진행 및 마일스톤 관리 |
| hr | HRPolicy | HR 정책 및 컴플라이언스 |
| search | DocumentSearch | 크로스 문서 검색 및 데이터 분석 |
| presentation | PresentationDraft | 프레젠테이션 작성 |
| approval | ApprovalDocument | 품의서 작성 |
| minutes | MeetingMinutes | 회의록 작성 |
| report | ReportGeneration | 보고서 작성 |
| contract | ContractReview | 계약서 검토 |
| onboarding | OnboardingGuide | 온보딩 |

### 관련 파일

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/services/cardAgentBindingService.ts` | Agent 검색, 동적 생성, 카드 바인딩 서비스 |
| `docker/nextjs/src/store/useCardAgentMappingStore.ts` | 카드-Agent 매핑 영속화 (Zustand + localStorage) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Agent CRUD API (create, list, delete, invoke) |

---

## 12. 출력 지향 워크플로우 카드

### 개요

Agent 모드 카드를 총 14개로 확장: "리서치" 8개 + "출력" 6개. 출력 카드는 특정 산출물(프레젠테이션, 품의서, 회의록, 보고서, 계약서, 온보딩 자료) 생성을 위해 설계되었습니다.

### 카드 클릭 동작

1. 카드의 카테고리에서 `AGENT_CATEGORY_MAP` 참조
2. `cardAgentBindingService`가 해당 Agent를 검색하거나 동적 생성
3. `useCardAgentMappingStore`에 매핑 영속화
4. Agent InvokeAgent API로 프롬프트 실행

---

## 13. Citation 표시 — 파일 경로 표시 및 접근 수준 배지

### 개요

CitationDisplay 컴포넌트(`docker/nextjs/src/components/chat/CitationDisplay.tsx`)는 RAG 검색 결과의 각 소스 문서에 대해 FSx 파일 경로와 접근 수준 배지를 표시합니다.

### 파일 경로 표시

S3 URI에서 FSx의 파일 경로를 추출하여 표시합니다. 파일 이름만이 아닌 디렉토리 경로를 포함하여 다른 폴더에 동일한 이름의 파일이 있을 때의 혼동을 방지합니다.

| 표시 형식 | 예시 |
|----------|------|
| S3 URI | `s3://bucket-alias/confidential/financial-report.md` |
| 표시 경로 | `confidential/financial-report.md` |

```typescript
// S3 URI에서 FSx 파일 경로 추출
function extractFilePath(s3Uri: string, fileName: string): string {
  if (!s3Uri) return fileName;
  const withoutProtocol = s3Uri.replace(/^s3:\/\/[^/]+\//, '');
  return withoutProtocol || fileName;
}
```

### 접근 수준 배지

| `access_level` 값 | 배지 색상 | 표시 라벨 | 의미 |
|-------------------|----------|----------|------|
| `public` | 녹색 | 모든 사용자 접근 가능 | Everyone SID — 모든 사용자 접근 가능 |
| `confidential` | 빨간색 | 관리자 전용 | Domain Admins SID만 접근 가능 |
| `restricted` | 노란색 | 특정 그룹 | 특정 그룹 (예: Engineering + Domain Admins) |
| 기타 / 미설정 | 노란색 | (원시 값 그대로 표시) | 미분류 접근 수준 |

`access_level`이 설정되지 않은 경우(`metadata.access_level`이 존재하지 않음) 배지 자체가 표시되지 않습니다.

### 데이터 소스

배지 라벨은 S3의 문서에 첨부된 `.metadata.json`의 `access_level` 필드에서 조회됩니다.

```json
{
  "metadataAttributes": {
    "access_level": "public",
    "allowed_group_sids": ["S-1-1-0"]
  }
}
```

`access_level`은 문서의 분류 라벨(표시용)이며, 실제 접근 제어는 `allowed_group_sids`를 사용한 SID 필터링으로 수행됩니다. 즉:
- **`access_level`**: UI에서 배지 표시에 사용 (시각적 분류)
- **`allowed_group_sids`**: 서버 측 SID 매칭에 사용 (실제 권한 제어)

둘은 독립적이며, `access_level`을 변경해도 접근 제어에 영향을 미치지 않습니다.

---

## 10. Agent Directory — Agent 관리 화면

**최종 업데이트**: 2026-03-29

### 개요

Agent Directory(`/[locale]/genai/agents`)는 Bedrock Agent를 카탈로그 형식으로 나열하고 관리하기 위한 전용 화면입니다. Bedrock Engineer Agent Directory UX 패턴을 참고하여 설계되었습니다.

### 접근 방법

- URL: `/{locale}/genai/agents` (예: `/ja/genai/agents`, `/en/genai/agents`)
- 헤더의 "📋 Agent 목록" 링크를 통해 접근
- 내비게이션 바의 "Agent 목록" 탭을 통해 접근

![Agent Directory — 엔터프라이즈 탭이 있는 목록 화면](screenshots/agent-directory-enterprise.png)

### 내비게이션 바

화면 상단에 세 개의 탭이 표시됩니다.

| 탭 | 이동 대상 | 설명 |
|-----|----------|------|
| Agent 모드 | `/genai?mode=agent` | Agent 모드 카드 그리드 화면 |
| Agent 목록 | `/genai/agents` | Agent Directory (현재 화면) |
| KB 모드 | `/genai` | KB 모드 카드 그리드 화면 |

내비게이션 바 오른쪽에 다크 모드 토글(☀️/🌙)과 언어 전환 드롭다운이 배치됩니다.

### Agent 목록 (그리드 뷰)

#### 검색 및 필터링

| 기능 | 설명 |
|------|------|
| 텍스트 검색 | Agent 이름과 설명에 대한 대소문자 무시 부분 일치 검색 |
| 카테고리 필터 | 10개 카테고리 (financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding) + "전체" |

검색과 카테고리 필터를 조합할 수 있습니다 (AND 조건).

#### Agent 카드

각 카드에 다음 정보가 표시됩니다.

| 항목 | 설명 |
|------|------|
| Agent 이름 | Bedrock Agent 이름 |
| 상태 배지 | Ready (녹색) / Creating/Preparing (파란색 + 스피너) / Failed (빨간색) / 기타 (회색) |
| 설명 | Agent 설명 (최대 2줄) |
| 카테고리 태그 | Agent 이름/설명에서 키워드 매칭으로 자동 추론 (보라색 태그) |

카드 클릭 시 상세 패널로 이동합니다.

### Agent 상세 패널

Agent 카드 클릭 시 표시되는 상세 화면입니다.

#### 표시 항목

| 항목 | 데이터 소스 |
|------|-----------|
| Agent ID | `GetAgentCommand` |
| Agent 이름 | 위와 동일 |
| 설명 | 위와 동일 |
| 상태 | 위와 동일 |
| 모델 | `foundationModel` |
| 버전 | `agentVersion` |
| 생성일 | `createdAt` (로케일 인식 날짜 표시) |
| 최종 업데이트 | `updatedAt` (로케일 인식 날짜 표시) |
| 시스템 프롬프트 | `instruction` (접기 가능) |
| Action Groups | `actionGroups[]` (목록 표시) |

#### 액션 버튼

| 버튼 | 동작 |
|------|------|
| 채팅에서 사용 | `useAgentStore.selectedAgentId`를 설정하고 `/genai?mode=agent`로 이동 |
| 편집 | 인라인 편집 폼으로 전환 |
| 내보내기 | Agent 구성을 JSON 파일로 다운로드 (`enableAgentSharing` 시) |
| 공유 버킷에 업로드 | Agent 구성을 S3 공유 버킷에 업로드 (`enableAgentSharing` 시) |
| 스케줄 생성 | EventBridge Scheduler로 cron 정기 실행 설정 (`enableAgentSchedules` 시) |
| 삭제 | Agent 이름을 포함한 확인 다이얼로그 → Delete API 실행 |

![Agent 상세 패널 (Export, Sharing, Schedule 기능 포함)](screenshots/agent-detail-panel.png)

### Agent 편집 폼

상세 패널에서 "편집" 버튼 클릭 시 표시되는 폼입니다.

| 필드 | 유형 | 유효성 검사 |
|------|------|-----------|
| Agent 이름 | 텍스트 입력 | 최소 3자 필요 |
| 설명 | 텍스트 입력 | 선택 사항 |
| 시스템 프롬프트 | 텍스트 영역 | 선택 사항 |
| 모델 | 드롭다운 | 7개 모델에서 선택 |

저장 시 `Update API` → `PrepareAgent`가 실행됩니다. 오류 시 폼 입력 내용이 보존됩니다.

### Agent 생성 폼 (템플릿에서 생성)

템플릿 카드에서 "템플릿에서 생성" 클릭 시 또는 Agent 모드에서 카드 클릭 시 Agent가 생성되지 않은 경우 표시됩니다.

#### 템플릿 목록 (10개 카테고리)

| 카테고리 | Agent 이름 패턴 | 모델 |
|---------|---------------|------|
| financial | financial-analysis-agent | Claude 3 Haiku |
| project | project-management-agent | Claude 3 Haiku |
| hr | hr-policy-agent | Claude 3 Haiku |
| search | cross-search-agent | Claude 3 Haiku |
| presentation | presentation-creator-agent | Claude 3 Haiku |
| approval | approval-document-agent | Claude 3 Haiku |
| minutes | meeting-minutes-agent | Claude 3 Haiku |
| report | report-generator-agent | Claude 3 Haiku |
| contract | contract-review-agent | Claude 3 Haiku |
| onboarding | onboarding-guide-agent | Claude 3 Haiku |

템플릿 값이 미리 채워지지만, 모든 필드(Agent 이름, 설명, 시스템 프롬프트, 모델)를 생성 전에 편집할 수 있습니다.

![Agent 생성 폼](screenshots/agent-creator-form.png)

#### 생성 흐름

```
템플릿 선택 → 생성 폼 표시 (값 편집 가능)
  → "생성 및 배포" 클릭
  → CreateAgent → PrepareAgent → CreateAgentAlias
  → 진행 상황 표시 (생성 중 → 준비 중 → 완료)
  → Agent 목록에 자동 추가
```

### 상태 관리

| 스토어 | 용도 | 영속화 |
|--------|------|--------|
| `useAgentDirectoryStore` | Agent 목록, 선택된 Agent, 검색 쿼리, 카테고리, 뷰 모드, 생성 진행 상황 | 없음 (매번 API에서 조회) |
| `useAgentStore` | `selectedAgentId` (채팅 화면에서 사용하는 Agent) | localStorage |
| `useCardAgentMappingStore` | 카드 ID → Agent ID 매핑 | localStorage |

### i18n 지원

8개 언어 (ja, en, ko, zh-CN, zh-TW, fr, de, es)를 `agentDirectory` 네임스페이스로 지원합니다.

### 오류 처리

| 오류 케이스 | 대응 |
|-----------|------|
| Agent 목록 조회 실패 | 오류 메시지 + 재시도 버튼 |
| Agent 상세 조회 실패 | 오류 메시지, 그리드 뷰로 복귀 |
| Agent 생성 실패 | 진행 바에 오류 표시, 폼 입력 보존 |
| Agent 업데이트 실패 | 오류 메시지, 폼 입력 보존 |
| Agent 삭제 실패 | 오류 메시지 |
| 필터 결과 0건 | "매칭되는 Agent를 찾을 수 없습니다" 메시지 |

---

## 11. 사이드바 — 채팅 기록 설정

**최종 업데이트**: 2026-03-29

### 개요

채팅 기록 저장 설정이 사이드바에 독립 섹션으로 표시되며, KB 모드와 Agent 모드 모두에서 공통입니다 (시스템 관리 CollapsiblePanel 위에 배치).

### 표시 내용

| 상태 | 아이콘 | 텍스트 | 배경색 |
|------|--------|------|--------|
| 저장 활성화 | 💾 | "기록 저장" + "자동 저장" | 녹색 (`bg-green-100`) |
| 저장 비활성화 | 🚫 | "기록 비활성화" + "세션만" | 회색 (`bg-gray-50`) |

---

## 12. 메시지 입력 영역

**최종 업데이트**: 2026-03-29

### 레이아웃

```
[➕] [텍스트 입력 필드                              ] [전송 버튼]
```

| 요소 | 설명 |
|------|------|
| ➕ 버튼 | 새 채팅 세션 시작. 카드 그리드로 복귀 |
| 텍스트 입력 | 메시지 입력. 전송 중 비활성화 |
| 전송 버튼 | 메시지 전송. 입력이 비어 있거나 전송 중일 때 비활성화 |

채팅 중에는 입력 영역 위에 "🔄 워크플로우 선택으로 돌아가기" 링크가 표시됩니다.

---

## 14. 엔터프라이즈 Agent 기능 (선택 사항)

**최종 업데이트**: 2026-03-30

### 개요

CDK 배포 시 선택적 파라미터로 활성화할 수 있는 엔터프라이즈 지향 Agent 관리 기능 세트입니다.

### 활성화 방법

```bash
# Agent 공유 기능 활성화
npx cdk deploy --all -c enableAgentSharing=true

# Agent 스케줄 실행 기능 활성화
npx cdk deploy --all -c enableAgentSchedules=true

# 둘 다 활성화
npx cdk deploy --all -c enableAgent=true -c enableAgentSharing=true -c enableAgentSchedules=true
```

### 5가지 기능

| # | 기능 | CDK 파라미터 | 추가 리소스 |
|---|------|------------|-----------|
| 1 | Agent 도구 선택 UI | 없음 (UI 기능만) | 없음 |
| 2 | Guardrails UI 설정 | `enableGuardrails` | Bedrock Guardrail |
| 3 | 애플리케이션 추론 프로파일 | 없음 (UI 기능만) | 없음 |
| 4 | 조직 공유 | `enableAgentSharing` | S3 버킷 (`${prefix}-shared-agents`) |
| 5 | 백그라운드 Agent | `enableAgentSchedules` | Lambda + DynamoDB + EventBridge Scheduler |

---

## 14. AD 로그인 UI — SAML Federation 지원

### 개요

AD SAML federation이 활성화된 경우(`enableAdFederation=true`), 로그인 페이지에 "AD로 로그인" 버튼이 추가되어 Cognito Hosted UI를 통한 SAML 흐름을 지원합니다.

### 표시 조건

| 조건 | 표시 내용 |
|------|----------|
| `COGNITO_DOMAIN` 환경 변수 설정됨 | "AD로 로그인" 버튼 + 기존 이메일/비밀번호 폼 |
| `COGNITO_DOMAIN` 환경 변수 미설정 | 기존 이메일/비밀번호 폼만 (하위 호환성) |

### SAML 리다이렉트 URL 구성

"AD로 로그인" 버튼 클릭 시 다음 URL로 리다이렉트됩니다:

```
https://{COGNITO_DOMAIN}.auth.{COGNITO_REGION}.amazoncognito.com/oauth2/authorize
  ?identity_provider={IDP_NAME}
  &response_type=code
  &client_id={COGNITO_CLIENT_ID}
  &redirect_uri={encodeURIComponent(CALLBACK_URL + '/api/auth/callback')}
  &scope=openid+email+profile
```

### OAuth 콜백 흐름

`/api/auth/callback` 라우트가 인가 코드를 수신하고 다음을 수행합니다:

1. Cognito Token Endpoint에서 인가 코드를 토큰으로 교환
2. ID 토큰에서 사용자 속성(email, custom:role, custom:ad_groups) 조회
3. ID 토큰 기반 역할 판정 (`custom:role === 'admin'` 또는 `custom:ad_groups`에 admin 그룹 포함 → `administrator`)
4. 세션 Cookie 설정
5. 채팅 화면(`/[locale]/genai`)으로 리다이렉트

---

## 이미지 업로드 UI (고급 RAG 기능)

### ImageUploadZone

채팅 입력 영역 내에 배치된 드래그 앤 드롭 영역 및 파일 선택 버튼입니다.

| 항목 | 사양 |
|------|------|
| 배치 | 채팅 입력 폼 내, 텍스트 입력 왼쪽 |
| 지원 형식 | JPEG, PNG, GIF, WebP |
| 크기 제한 | 3MB |
| 드래그 중 | 드롭 영역 강조 (`border-blue-500 bg-blue-50`) |
| 오류 표시 | 미지원 형식 → `imageUpload.invalidFormat`, 3MB 초과 → `imageUpload.fileTooLarge` |
| i18n 키 | `imageUpload.dropzone`, `imageUpload.selectFile` |

### ImagePreview

첨부 이미지의 미리보기 표시입니다. 입력 영역 위에 배치됩니다.

| 항목 | 사양 |
|------|------|
| 크기 | 80×80px, `object-cover` |
| 삭제 버튼 | 오른쪽 상단 "×" 버튼 |

### ImageThumbnail

채팅 메시지 버블 내 이미지 썸네일입니다.

| 항목 | 사양 |
|------|------|
| 최대 크기 | 200×200px, `object-contain` |
| alt 속성 | `imageUpload.uploadedImage` (i18n 번역 값) |
| 로딩 | 스켈레톤 로더 (`animate-pulse`) |
| 클릭 | ImageModal에서 전체 크기 표시 |

### ImageModal

전체 크기 이미지 표시 모달입니다.

| 항목 | 사양 |
|------|------|
| 최대 크기 | 90vw × 90vh |
| 닫기 | "×" 버튼 + 배경 클릭 |

---

## Knowledge Base 연결 UI (고급 RAG 기능)

### KBSelector

Agent 생성 및 편집 폼 내 Knowledge Base 선택 컴포넌트입니다.

| 항목 | 사양 |
|------|------|
| 표시 항목 | KB 이름, 설명, 상태 배지, 데이터 소스 수 |
| 상태 배지 색상 | ACTIVE → 녹색, CREATING → 파란색, FAILED → 빨간색 |
| 선택 제한 | ACTIVE만 체크박스 활성화 |
| 다중 선택 | 지원 (선택 시 강조) |
| 로딩 | 스켈레톤 로더 (3행) |
| 오류 | 오류 메시지 + 재시도 버튼 |
| i18n 키 | `kbSelector.*` |

### ConnectedKBList

Agent 상세 패널 내 연결된 KB 목록 표시입니다.

| 항목 | 사양 |
|------|------|
| 표시 항목 | KB 이름, 설명, 상태 배지 |
| 0건 시 | `kbSelector.noKBConnected` 메시지 표시 |

---

## Smart Routing UI (고급 RAG 기능)

### RoutingToggle

사이드바 설정 섹션에 배치된 Smart Routing ON/OFF 토글입니다.

| 항목 | 사양 |
|------|------|
| 배치 | KB 모드 사이드바, ModelSelector 아래 |
| 토글 | `role="switch"`, `aria-checked` |
| ON 시 | 경량 모델 이름 / 고성능 모델 이름 쌍 표시 (파란색 배경) |
| OFF 시 | 모델 쌍 미표시 |
| 영속화 | localStorage (`smart-routing-enabled` 키) |
| 기본값 | OFF |
| i18n 키 | `smartRouting.*` |

### ResponseMetadata

어시스턴트 메시지 아래 모델 정보 표시입니다.

| 항목 | 사양 |
|------|------|
| 모델 이름 | 클릭 가능 (상세 팝오버) |
| Auto 배지 | 파란색 (`bg-blue-100`), Smart Routing ON + 자동 선택 시 |
| Manual 배지 | 회색 (`bg-gray-100`), 수동 오버라이드 시 |
| 카메라 아이콘 | 📷, 이미지 분석 사용 시 |
| 툴팁 | 분류 결과 (simple/complex) + 신뢰도 |

### ModelSelector 확장

Smart Routing ON 시 모델 목록 상단에 "Auto" 옵션을 추가합니다.

| 항목 | 사양 |
|------|------|
| Auto 옵션 | ⚡ 아이콘 + `smartRouting.auto` 라벨 |
| 선택 시 | `isAutoMode = true` (Zustand 스토어) |
| 수동 선택 시 | `isAutoMode = false` (수동 오버라이드) |
| Smart Routing OFF 시 | Auto 옵션 숨김 (기존 동작 변경 없음) |