# Permission-Aware RAG 시스템 — 구현 개요

**🌐 Language:** [日本語](../implementation-overview.md) | [English](../en/implementation-overview.md) | **한국어** | [简体中文](../zh-CN/implementation-overview.md) | [繁體中文](../zh-TW/implementation-overview.md) | [Français](../fr/implementation-overview.md) | [Deutsch](../de/implementation-overview.md) | [Español](../es/implementation-overview.md)

**작성일**: 2026-03-25  
**버전**: 3.3.0

---

## 개요

이 시스템은 Amazon FSx for NetApp ONTAP과 Amazon Bedrock을 결합한 RAG(Retrieval-Augmented Generation) 챗봇 시스템으로, 파일 접근 권한(SID) 기반 필터링을 제공합니다. 사용자별 NTFS ACL 정보를 메타데이터로 관리하고, 검색 결과를 실시간으로 필터링하여 안전한 문서 검색과 AI 기반 답변 생성을 가능하게 합니다.

모든 인프라는 AWS CDK(TypeScript)로 정의되며, `npx cdk deploy --all`로 한 번에 배포할 수 있습니다.

---

## 1. 챗봇 애플리케이션 — AWS Lambda 기반 Next.js RAG 챗봇

### 구현 상세

Next.js 15(App Router)로 구축된 RAG 챗봇 애플리케이션이 AWS Lambda Web Adapter를 통해 서버리스로 실행됩니다.

### 아키텍처

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 15 (App Router, standalone output) |
| UI | React 18 + Tailwind CSS |
| 인증 | Amazon Cognito (JWT) |
| AI/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| 런타임 | Lambda Web Adapter (Rust) + Docker Container |
| CDN | Amazon CloudFront |

### 주요 기능

- **RAG 검색**: Bedrock Knowledge Base를 통한 벡터 검색 수행 및 관련 문서를 참조한 답변 생성
- **SID 필터링**: 사용자 SID 정보에 기반한 검색 결과 필터링 (섹션 7에서 상세 설명)
- **KB/Agent 모드 전환**: 헤더 토글을 통해 KB 모드(문서 검색)와 Agent 모드(다단계 추론) 간 전환
- **카드 기반 태스크 지향 UI**: 채팅 시작 전 KB 모드에서는 목적별 카드(문서 검색, 요약 작성, 퀴즈 생성 등), Agent 모드에서는 워크플로우 카드(재무 분석, 프로젝트 관리 등)를 그리드 레이아웃으로 표시. 즐겨찾기 관리 및 카테고리 필터링 지원
- **Agent 모드 (InvokeAgent API)**: Bedrock Agent + Permission-aware Action Group을 통한 SID 필터링 포함 다단계 추론 실현. Agent 호출 실패 시 KB 하이브리드 모드로 폴백
- **다국어 지원**: 8개 언어 — 일본어, 영어, 한국어, 중국어(간체/번체), 프랑스어, 독일어, 스페인어
- **Citation 표시**: 답변의 근거가 된 문서의 소스 정보 표시
- **Cognito 인증**: 로그인/로그아웃 및 세션 관리

### CDK 스택

`DemoWebAppStack` (`lib/stacks/demo/demo-webapp-stack.ts`)은 다음을 생성합니다:
- Lambda DockerImageFunction (ECR 이미지, 1024MB 메모리, 30초 타임아웃)
- Lambda Function URL (IAM 인증)
- CloudFront Distribution (OAC + Geo 제한 + WAF 통합)
- CloudFront 접근 로그용 S3 버킷

---

## 2. AWS WAF — IP 및 Geo 정보를 통한 보호

### 구현 상세

CloudFront용 WAFv2 WebACL이 `us-east-1`에 배포되어 여러 보안 규칙으로 애플리케이션을 보호합니다.

### WAF 규칙 구성 (우선순위별)

| 우선순위 | 규칙 이름 | 유형 | 설명 |
|---------|----------|------|------|
| 100 | RateLimit | 커스텀 | 5분 내 IP당 3,000건 초과 시 차단 |
| 200 | AWSIPReputationList | AWS 관리형 | 봇넷, DDoS 소스 등의 악성 IP 차단 |
| 300 | AWSCommonRuleSet | AWS 관리형 | OWASP Top 10 준수 (XSS, LFI, RFI 등). RAG 호환성을 위해 일부 규칙 제외 |
| 400 | AWSKnownBadInputs | AWS 관리형 | Log4j 등 알려진 취약점을 악용하는 요청 차단 |
| 500 | AWSSQLiRuleSet | AWS 관리형 | SQL 인젝션 공격 패턴 감지 및 차단 |
| 600 | IPAllowList | 커스텀 (선택 사항) | `allowedIps` 구성 시에만 활성화. 목록에 없는 IP 차단 |

### Geo 제한

CloudFront 수준에서 지리적 접근 제한이 적용됩니다 (기본값: 일본만).

### CDK 스택

`DemoWafStack` (`lib/stacks/demo/demo-waf-stack.ts`)은 다음을 생성합니다:
- WAFv2 WebACL (CLOUDFRONT 범위, `us-east-1`)
- IP Set (`allowedIps` 구성 시)

### 구성

`cdk.context.json`으로 제어:
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. IAM 인증 — Lambda Function URL IAM Auth + CloudFront OAC

### 구현 상세

Lambda Function URL에 IAM 인증(`AWS_IAM`)이 구성되고, CloudFront Origin Access Control(OAC)이 SigV4 서명을 통한 오리진 접근 제어를 제공합니다.

### 인증 흐름

```
Browser
  │
  ▼
CloudFront (OAC: SigV4 서명 자동 추가)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → SigV4 서명 검증
  │ → CloudFront에서의 요청만 허용
  ▼
Next.js 애플리케이션
  │
  ▼
Cognito JWT 검증 (애플리케이션 수준 인증)
```

### 보안 레이어

| 레이어 | 기술 | 목적 |
|--------|------|------|
| L1: 네트워크 | CloudFront Geo 제한 | 지리적 접근 제한 |
| L2: WAF | AWS WAF | 공격 패턴 감지 및 차단 |
| L3: 오리진 인증 | OAC (SigV4) | CloudFront를 우회한 직접 접근 방지 |
| L4: API 인증 | Lambda Function URL IAM Auth | IAM 인증을 통한 접근 제어 |
| L5: 사용자 인증 | Cognito JWT | 사용자 수준 인증 및 인가 |
| L6: 데이터 인가 | SID 필터링 | 문서 수준 접근 제어 |

### CDK 구현

`DemoWebAppStack` 내:
- `lambda.FunctionUrlAuthType.AWS_IAM`으로 Function URL 생성
- `cloudfront.CfnOriginAccessControl`로 OAC 생성 (`signingBehavior: 'always'`)
- L1 escape hatch를 사용하여 Distribution에 OAC 연결

### 배포 후 참고사항

위의 IAM 인증 + OAC 구성은 프로덕션 사용에 권장됩니다. 그러나 검증 환경에서 POST 요청(채팅 등)과의 호환성 문제가 발생하는 경우, 다음과 같은 수동 조정이 필요할 수 있습니다:
- Lambda Function URL AuthType을 `NONE`으로 변경
- CloudFront OAC 연결 제거

---

## 4. 벡터 데이터베이스 — S3 Vectors / Amazon OpenSearch Serverless

### 구현 상세

RAG 검색에 사용되는 벡터 데이터베이스는 CDK 컨텍스트 파라미터 `vectorStoreType`으로 선택할 수 있습니다:
- **S3 Vectors** (기본값): 저비용, 서브초 지연 시간. Bedrock KB의 벡터 스토어로 직접 사용
- **Amazon OpenSearch Serverless (AOSS)**: 고성능 (~10ms), 고비용 (~$700/월)

### 설계 결정

S3 Vectors를 기본값으로 선택한 이유:
- 비용이 월 수 달러(소규모)로, OpenSearch Serverless의 ~$700/월에 비해 크게 저렴
- Bedrock KB의 벡터 스토어로 네이티브 지원
- 메타데이터 필터링 지원 (`$eq`, `$in`, `$and`, `$or`)
- 고성능이 필요한 경우 S3 Vectors에서 AOSS로의 원클릭 내보내기 가능

AOSS 선택 시 비교:

| 측면 | S3 Vectors | AOSS | Aurora Serverless v2 (pgvector) |
|------|-----------|------|------|
| Bedrock KB 통합 | 네이티브 지원 | 네이티브 지원 | 커스텀 통합 필요 |
| 비용 | 수 달러/월 (종량제) | ~$700/월 (2 OCU 최소) | 인스턴스 비용에 따라 다름 |
| 지연 시간 | 서브초~100ms | ~10ms | ~10ms |
| 메타데이터 검색 | 필터링 연산자 지원 | 텍스트 필드에 저장 | SQL 쿼리를 통한 유연한 검색 |
| 운영 오버헤드 | 서버리스 (자동 스케일링) | 용량 관리 필요 |
| 비용 | 검색 볼륨 기반 종량제 | 최소 ACU 요금 적용 |
| 메타데이터 검색 | 텍스트 필드에 저장 | SQL 쿼리를 통한 유연한 검색 |

### 벡터 스토어 구성

S3 Vectors 구성 (기본값):
- S3 Vectors 벡터 버킷 + 벡터 인덱스 (1024차원, cosine)
- 커스텀 리소스 Lambda를 통해 생성 (CloudFormation 미지원)

AOSS 구성 (`vectorStoreType=opensearch-serverless`):

| 리소스 | 설명 |
|--------|------|
| Collection | `VECTORSEARCH` 유형, 암호화 정책 (AWS 소유 키) |
| Network Policy | 퍼블릭 접근 (Bedrock KB API에서의 접근용) |
| Data Access Policy | KB IAM 역할 + 인덱스 생성 Lambda + Embedding EC2 역할 |
| Index | `bedrock-knowledge-base-default-index` (knn_vector 1024차원, HNSW/faiss/l2) |

### 인덱스 매핑

```json
{
  "bedrock-knowledge-base-default-vector": { "type": "knn_vector", "dimension": 1024 },
  "AMAZON_BEDROCK_TEXT_CHUNK": { "type": "text" },
  "AMAZON_BEDROCK_METADATA": { "type": "text", "index": false }
}
```

### CDK 스택

`DemoAIStack` (`lib/stacks/demo/demo-ai-stack.ts`)은 다음을 생성합니다:
- `vectorStoreType=s3vectors`: S3 Vectors 벡터 버킷 + 인덱스 (커스텀 리소스 Lambda)
- `vectorStoreType=opensearch-serverless`: OpenSearch Serverless 컬렉션 + 보안 정책 (암호화, 네트워크, 데이터 접근)
- 자동 인덱스 생성을 위한 커스텀 리소스 Lambda
- Bedrock Knowledge Base + S3 데이터 소스

---

## 5. Embedding 서버 — FSx ONTAP CIFS 마운트 + 벡터 DB 쓰기

### 구현 상세

Amazon FSx for NetApp ONTAP 볼륨이 CIFS/SMB로 마운트된 EC2 인스턴스에서 Docker 컨테이너가 문서를 읽고, 벡터화하여 OpenSearch Serverless(AOSS)에 인덱싱합니다. S3 Vectors 구성에서는 사용되지 않습니다 (AOSS 구성만 해당).

### 데이터 수집 경로 개요

| 경로 | 방법 | CDK 활성화 | 상태 |
|------|------|-----------|------|
| 옵션 A (기본값) | S3 버킷 → Bedrock KB S3 데이터 소스 | 항상 활성화 | ✅ |
| 옵션 B (선택 사항) | Embedding 서버 (CIFS 마운트) → 벡터 스토어 직접 쓰기 | `-c enableEmbeddingServer=true` | ✅ (AOSS 구성만 해당) |
| 옵션 C (선택 사항) | S3 Access Point → Bedrock KB | 배포 후 수동 설정 | ✅ SnapMirror 지원, FlexCache 곧 지원 예정 |

> **S3 Access Point에 대해**: StorageStack은 FSx ONTAP 볼륨에 S3 Access Point를 자동으로 생성합니다. 볼륨의 보안 스타일(NTFS/UNIX)과 AD 참가 상태에 따라 WINDOWS 또는 UNIX 사용자 유형의 S3 AP가 생성됩니다. CDK 컨텍스트 파라미터 `volumeSecurityStyle`, `s3apUserType`, `s3apUserName`으로 명시적으로 제어할 수 있습니다.

#### S3 Access Point 사용자 유형 설계

| 패턴 | 사용자 유형 | 사용자 소스 | 볼륨 Style | 조건 |
|------|-----------|-----------|-----------|------|
| A | WINDOWS | 기존 AD 사용자 (Admin) | NTFS/UNIX | AD 참가 SVM (권장: NTFS 환경) |
| B | WINDOWS | 신규 전용 AD 사용자 | NTFS/UNIX | AD 참가 SVM + 최소 권한 |
| C | UNIX | 기존 UNIX 사용자 (root) | UNIX | AD 비참가 (권장: UNIX 환경) |
| D | UNIX | 신규 전용 UNIX 사용자 | UNIX | AD 비참가 + 최소 권한 |

SID 필터링은 모든 패턴에서 동일한 로직(`.metadata.json` 메타데이터 기반)으로 동작하며, 볼륨의 보안 스타일이나 S3 AP 사용자 유형에 의존하지 않습니다.

### 아키텍처

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ 1. 스캔      │ │
                                       │ │ 2. 청크      │ │
                                       │ │ 3. Embedding │ │
                                       │ │ 4. 인덱싱    │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    └──────────────────┘              └──────────────────┘
```

### 처리 흐름

1. CIFS 마운트된 디렉토리를 재귀적으로 스캔 (`.md`, `.txt`, `.html` 등 텍스트 파일)
2. 각 문서의 `.metadata.json`에서 SID 정보(`allowed_group_sids`) 읽기
   - `.metadata.json`이 없고 `ENV_AUTO_METADATA=true`인 경우, ONTAP REST API(`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)를 통해 ACL을 자동 취득하고, SID를 추출하여 `.metadata.json`을 자동 생성
3. 텍스트를 1,000자 청크로 분할 (200자 오버랩)
4. Amazon Bedrock Titan Embed Text v2로 1024차원 벡터 생성
5. Bedrock KB 호환 형식(`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`)으로 AOSS(OpenSearch Serverless)에 인덱싱
6. 처리된 파일을 `processed.json`에 기록 (증분 처리 지원)

### 실행 모드

| 모드 | 설명 | 구성 |
|------|------|------|
| 배치 모드 | 모든 파일을 한 번 처리하고 종료 | `ENV_WATCH_MODE=false` (기본값) |
| 감시 모드 | 파일 변경을 감지하여 자동 처리 | `ENV_WATCH_MODE=true` |

감시 모드에서는 `chokidar` 라이브러리를 사용하여 파일 시스템 변경(추가/업데이트)을 실시간으로 감지하고 자동으로 벡터화 및 인덱싱을 수행합니다. 정기 실행의 경우, EventBridge Scheduler 또는 cron을 통해 배치 모드 컨테이너를 주기적으로 시작하는 구성도 가능합니다.

### CDK 스택

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`)은 다음을 생성합니다:
- EC2 인스턴스 (m5.large, IMDSv2 강제)
- ECR 리포지토리 (Embedding 컨테이너 이미지용)
- IAM 역할 (SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager)
- 보안 그룹
- UserData (자동 CIFS 마운트 + Docker 자동 시작)

### 소스 코드

```
docker/embed/
├── src/index.ts      # 메인 처리 (스캔 → 청크 → Embedding → 인덱싱)
├── src/oss-client.ts  # AOSS SigV4 서명 클라이언트 (IMDS 인증 지원)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild 빌드 정의
└── package.json       # AWS SDK v3, chokidar, dotenv
```

---

## 6. Amazon Titan Text Embeddings — 벡터화 모델

### 구현 상세

문서 벡터화에 `amazon.titan-embed-text-v2:0`을 사용합니다.

### 모델 사양

| 항목 | 값 |
|------|-----|
| 모델 ID | `amazon.titan-embed-text-v2:0` |
| 벡터 차원 | 1024 |
| 최대 입력 길이 | 8,000자 |
| 정규화 | 활성화 (`normalize: true`) |

### 사용처

| 컴포넌트 | 용도 |
|----------|------|
| Bedrock Knowledge Base | S3 데이터 소스에서 문서 수집 시 벡터화 |
| Embedding 서버 | CIFS 마운트된 문서의 벡터화 (`docker/embed/src/index.ts`) |

### Embedding 호출

```typescript
// Bedrock InvokeModel API
const body = JSON.stringify({
  inputText: text.substring(0, 8000),
  dimensions: 1024,
  normalize: true,
});
const resp = await bedrock.send(new InvokeModelCommand({
  modelId: 'amazon.titan-embed-text-v2:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: Buffer.from(body),
}));
```

### CDK 구성

`DemoAIStack`의 Knowledge Base 구성:
```typescript
embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`
```

---

## 7. SID 메타데이터 + 권한 필터링

### 구현 상세

문서 벡터화 시, 파일의 NTFS ACL에 기반한 SID(Security Identifier) 정보가 `.metadata.json` 파일에 메타데이터로 첨부됩니다. 채팅 인터페이스에서 로그인한 사용자의 SID를 각 문서의 SID와 비교하여, SID가 매칭되는 문서만 검색 결과에 포함합니다.

### SID란?

SID(Security Identifier)는 Windows/NTFS에서 보안 주체(사용자, 그룹)의 고유 식별자입니다.

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
```

| SID | 이름 | 설명 |
|-----|------|------|
| `S-1-1-0` | Everyone | 모든 사용자 |
| `S-1-5-21-...-512` | Domain Admins | 도메인 관리자 그룹 |
| `S-1-5-21-...-1001` | User | 일반 사용자 |

### 메타데이터 파일 (`.metadata.json`)

각 문서에 대응하는 `.metadata.json` 파일이 허용된 접근 SID 목록을 정의합니다.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
    "access_level": "confidential"
  }
}
```

### 문서-SID 매핑

| 디렉토리 | 접근 수준 | allowed_group_sids | 관리자 | 일반 사용자 |
|----------|----------|-------------------|--------|-----------|
| `public/` | 공개 | `S-1-1-0` (Everyone) | ✅ 허용 | ✅ 허용 |
| `confidential/` | 기밀 | `...-512` (Domain Admins) | ✅ 허용 | ❌ 거부 |
| `restricted/` | 제한 | `...-1100` (Engineering) + `...-512` (DA) | ✅ 허용 | ❌ 거부 |

### 사용자 SID 관리

사용자 SID 정보는 DynamoDB `user-access` 테이블에서 관리됩니다. 애플리케이션의 JWT는 이메일 주소를 `userId`로 사용합니다.

```
DynamoDB user-access 테이블
┌──────────────────────┬──────────────────────┬────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ admin@example.com    │ S-1-5-21-...-500     │ [S-1-5-21-...-512,     │
│                      │ (Administrator)      │  S-1-1-0]              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ user@example.com     │ S-1-5-21-...-1001    │ [S-1-1-0]              │
│                      │ (일반 사용자)        │                        │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

### 필터링 처리 흐름 (2단계 방식)

```
User            Next.js API         DynamoDB        Bedrock KB      Converse API
  |                  |                  |                |                |
  | 1. Send query    |                  |                |                |
  |----------------->|                  |                |                |
  |                  | 2. Get user SIDs |                |                |
  |                  |----------------->|                |                |
  |                  |<-----------------|                |                |
  |                  | userSID+groupSIDs|                |                |
  |                  |                  |                |                |
  |                  | 3. Retrieve API  |                |                |
  |                  |  (vector search) |                |                |
  |                  |----------------->|--------------->|                |
  |                  |<-----------------|                |                |
  |                  | Results+metadata |                |                |
  |                  | (allowed_group   |                |                |
  |                  |  _sids)          |                |                |
  |                  |                  |                |                |
  |                  | 4. SID matching  |                |                |
  |                  |  userSIDs n      |                |                |
  |                  |  documentSIDs    |                |                |
  |                  |  Match->ALLOW    |                |                |
  |                  |  No match->DENY  |                |                |
  |                  |                  |                |                |
  |                  | 5. Converse API  |                |                |
  |                  |  (allowed docs)  |                |                |
  |                  |----------------->|--------------->|--------------->|
  |                  |<-----------------|                |                |
  |                  |                  |                |                |
  | 6. Filtered      |                  |                |                |
  |    result        |                  |                |                |
  |<-----------------|                  |                |                |
```

Retrieve API를 사용하는 이유: RetrieveAndGenerate API는 Citation 메타데이터(`allowed_group_sids`)를 반환하지 않아 SID 필터링이 작동하지 않습니다. Retrieve API는 메타데이터를 올바르게 반환하므로, 2단계 방식(Retrieve → SID 필터 → Converse)을 채택합니다.

### Fail-Closed 폴백

권한 확인이 실패하면 모든 문서에 대한 접근을 거부합니다.

| 상황 | 동작 |
|------|------|
| DynamoDB 연결 오류 | 모든 문서 거부 |
| 사용자 SID 레코드 없음 | 모든 문서 거부 |
| 메타데이터에 SID 정보 없음 | 해당 문서 거부 |
| SID 매칭 없음 | 해당 문서 거부 |
| SID 매칭 발견 | 해당 문서 허용 |

### 구현 파일

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | KB 검색 API + SID 필터링 통합 (Lambda/인라인 전환 지원) |
| `lambda/permissions/metadata-filter-handler.ts` | 메타데이터 기반 권한 필터링 Lambda (`-c usePermissionFilterLambda=true`로 활성화) |
| `lambda/permissions/permission-filter-handler.ts` | ACL 기반 권한 필터링 Lambda (향후 확장용) |
| `lambda/permissions/permission-calculator.ts` | SID/ACL 매칭 로직 |
| `demo-data/scripts/setup-user-access.sh` | 사용자 SID 데이터 등록 스크립트 |
| `demo-data/documents/**/*.metadata.json` | 문서 SID 메타데이터 |

---

## 8. Bedrock Agent — 권한 인식 Agentic AI

### 구현 상세

Bedrock Agent를 사용하여 다단계 추론 AI 에이전트를 구현합니다. Agent는 Permission-aware Action Group을 통해 KB 검색을 수행하고, 사용자의 SID 권한에 기반하여 필터링된 문서만 참조하여 답변을 생성합니다.

### 아키텍처

```
User → InvokeAgent API → Bedrock Agent (Claude 3 Haiku)
  │
  ├── Permission-aware Search Action Group
  │   ├── KB Retrieve API (벡터 검색)
  │   ├── DynamoDB user-access (사용자 SID 조회)
  │   ├── SID 매칭 (allowed_group_sids ∩ userSIDs)
  │   └── 허용된 문서만 반환
  │
  └── Agent 다단계 추론 → 답변 생성
```

### CDK 리소스 (`enableAgent=true`)

| 리소스 | 설명 |
|--------|------|
| Bedrock Agent | Claude 3 Haiku, KB 직접 연결 없음 (Action Group만) |
| Agent Alias | 안정적 호출을 위한 별칭 |
| Action Group Lambda | 권한 인식 KB 검색 (SID 필터링 포함) |
| Agent IAM Role | Bedrock InvokeModel + KB Retrieve 권한 |

### Permission-aware Action Group

Agent는 KB를 직접 검색하지 않고 항상 Action Group(`permissionAwareSearch`)을 통해 접근합니다. 이를 통해:
- 사용자 SID 정보에 기반한 필터링이 항상 적용됨
- 관리자는 모든 문서를 참조할 수 있고, 일반 사용자는 공개 문서만 참조 가능
- Agent 다단계 추론은 필터링된 문서만으로 실행됨

### 카드 기반 태스크 지향 UI

채팅 시작 전 모드별 카드 그리드가 표시됩니다. KB 모드 8개 카드 + Agent 모드 14개 카드(리서치 8개 + 출력 6개)로 구성되어 원클릭 프롬프트 입력을 지원합니다. 즐겨찾기 관리 및 카테고리 필터링을 지원합니다.

### 사이드바 레이아웃

AgentModeSidebar는 CollapsiblePanel을 사용하여 시스템 설정(리전/모델 선택 등)을 접을 수 있게 하고, WorkflowSection을 사이드바 상단에 배치합니다. KB 모드에서는 시스템 설정이 기본 펼침, Agent 모드에서는 워크플로우가 기본 펼침입니다.

### 동적 Agent-카드 바인딩

카드 클릭 시 AGENT_CATEGORY_MAP(10개 카테고리: financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding)을 참조하여 해당 Agent를 찾거나 동적으로 생성하여 카드에 바인딩합니다. 생성된 Agent에는 Permission-aware Action Group이 자동으로 첨부됩니다.

### 워크플로우 UI

AgentModeSidebar에 프리셋 워크플로우가 배치됩니다:
- 📊 재무 보고서 분석
- 📝 프로젝트 진행 확인
- 🔍 크로스 문서 검색
- 📋 HR 정책 검토

### 구현 파일

| 파일 | 역할 |
|------|------|
| `lib/stacks/demo/demo-ai-stack.ts` | Agent + Action Group CDK 리소스 |
| `lambda/bedrock-agent-actions/permission-aware-search.ts` | Action Group Lambda (TypeScript 버전) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | InvokeAgent API Route |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Agent UI (모드 전환, 워크플로우) |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agent 사이드바 |

---

## 9. 이미지 분석 RAG — Bedrock Vision API 통합

### 구현 상세

채팅 입력에 이미지 업로드 기능이 추가되어, Bedrock Converse API의 멀티모달 기능(Vision API)을 사용하여 이미지를 분석하고 그 결과를 KB 검색 컨텍스트에 통합합니다.

### 처리 흐름

```
사용자 → 이미지 드래그 앤 드롭 또는 파일 선택
  → 유효성 검사 (형식: JPEG/PNG/GIF/WebP, 크기: ≤3MB)
  → Base64 인코딩 → API 제출
  → Vision API (Claude 3 Haiku) 이미지 분석
  → 분석 결과 + 사용자 쿼리 → KB Retrieve API
  → SID 필터링 → 답변 생성
```

### 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/hooks/useImageUpload.ts` | 이미지 유효성 검사 및 Base64 변환 훅 |
| `docker/nextjs/src/components/chat/ImageUploadZone.tsx` | 드래그 앤 드롭 영역 + 파일 선택 |
| `docker/nextjs/src/components/chat/ImagePreview.tsx` | 첨부 이미지 미리보기 + 삭제 버튼 |
| `docker/nextjs/src/components/chat/ImageThumbnail.tsx` | 메시지 내 썸네일 (최대 200×200px) |
| `docker/nextjs/src/components/chat/ImageModal.tsx` | 전체 크기 이미지 모달 |
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | Vision API 호출 (30초 타임아웃, 텍스트 전용 폴백) |

### 오류 처리

- 미지원 형식 → 오류 메시지 표시 (i18n 지원)
- 5MB 초과 → 오류 메시지 표시
- Vision API 실패 → 텍스트 전용 쿼리로 폴백 (사용자 경험 중단 없음)
- Vision API 15초 타임아웃 → AbortController로 중단, 폴백

### 현재 이미지 데이터 라이프사이클

현재 구현에서 이미지 데이터는 아무것도 영구 저장되지 않는 완전한 스테이트리스 흐름을 따릅니다.

```
Browser (FileReader → Base64 → useState)
  → POST를 통해 API 요청 JSON 본문에 포함
  → Lambda (Buffer.from → Bedrock Converse API에 전송 → 텍스트 결과 수신)
  → 응답 반환 후 이미지 데이터는 GC에 의해 폐기
```

- S3, DynamoDB 또는 기타 서비스에 이미지 저장 없음
- 이미지 데이터는 요청 처리 중 Lambda 메모리에만 존재
- Bedrock도 학습에 사용하지 않음
- 이미지 데이터는 채팅 기록에 저장되지 않음 (텍스트 메시지만)
- 페이지 새로고침 후 "어떤 이미지에 대해 질문했는지" 복원 불가

### 향후 고려사항 — 이미지 데이터 영속화 및 AgentCore Memory 통합

#### 배경

현재의 스테이트리스 설계는 프라이버시 및 비용 관점에서 적절하지만, 이미지가 채팅 기록에 보존되지 않으므로 "지난번에 업로드한 이미지에 대해"와 같은 컨텍스트 연속이 불가능합니다. 향후 이미지 영속화 및 대화 컨텍스트 통합을 검토할 예정입니다.

#### 접근 방식 비교

| 접근 방식 | 비용 | 구현 난이도 | 적합성 | 비고 |
|----------|------|-----------|--------|------|
| S3 + DynamoDB | 수 센트/월 | 낮음 | 최적 | S3에 이미지 저장, DynamoDB에 메시지 ID-S3 키 매핑. 기존 인프라로 완결 |
| AgentCore Memory (blob) | 미정 (높을 가능성) | 중간 | 과도 | `create_blob_event`로 Base64 이미지 저장 가능하지만, 주로 대화 컨텍스트 관리용으로 이미지 저장에 부적합 |
| AgentCore Memory (텍스트만) | 낮음 | 중간 | 적절 | Vision 분석 결과 텍스트만 Semantic Strategy로 장기 기억으로 보존 |
| 하이브리드 (권장) | 낮음~중간 | 중간 | 최적 | S3에 이미지 저장 + AgentCore Memory에 Vision 분석 결과 텍스트 보존 |

#### AgentCore Memory 고려사항

- AgentCore Memory 이벤트 페이로드는 `conversational`(텍스트)과 `blob`(바이너리) 두 가지 유형
- Semantic Memory Strategy / Summary Strategy는 대화 텍스트에서 사실과 요약을 추출하는 메커니즘으로, 이미지 바이너리에 대해서는 의미 있는 추출 불가
- 이벤트 보존 기간(기본 90일)과 저장 볼륨에 따른 과금이 예상되며, 매번 5MB 이미지를 저장하면 비용 증가 위험
- AgentCore Memory SDK는 주로 Python(`bedrock-agentcore` 패키지)이며, TypeScript/Node.js에서는 AWS SDK for JavaScript v3의 저수준 API를 직접 사용해야 함
- AgentCore Memory는 2025년 7월 GA 도달; ap-northeast-1 리전에서의 가용성 확인 필요

#### 권장 아키텍처 (향후 구현용)

```
이미지 업로드 시:
  Browser → S3 presigned URL → S3 버킷 (이미지 저장, TTL 포함)
  → DynamoDB (messageId → s3Key 매핑)

Vision 분석 후:
  분석 결과 텍스트 → AgentCore Memory create_event (conversational 페이로드)
  → Semantic Strategy → 장기 기억으로 자동 추출

채팅 기록 표시:
  DynamoDB → s3Key 조회 → S3 presigned URL 생성 → ImageThumbnail 표시

컨텍스트 연속:
  AgentCore Memory retrieve_memories → 과거 Vision 분석 결과 텍스트 조회
  → LLM 컨텍스트에 포함하여 답변 생성
```

이 접근 방식을 통해 이미지를 S3에 저비용으로 저장하면서, Vision 분석 결과 텍스트를 AgentCore Memory의 시맨틱 검색을 통해 컨텍스트 복원에 활용할 수 있습니다.

---

## 10. Knowledge Base 연결 UI — Agent × KB 관리

### 구현 상세

Agent Directory(`/genai/agents`)에서 Agent를 생성하거나 편집할 때, Bedrock Knowledge Base를 선택, 연결, 해제하기 위한 UI가 제공됩니다.

### 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/components/agents/KBSelector.tsx` | KB 목록 표시 및 다중 선택 (ACTIVE KB만 선택 가능) |
| `docker/nextjs/src/components/agents/ConnectedKBList.tsx` | Agent 상세 패널에 연결된 KB 표시 |
| `docker/nextjs/src/hooks/useKnowledgeBases.ts` | KB 목록 조회 및 연결된 KB 조회 훅 |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | 3개 액션 추가 (associate/disassociate/listAgentKBs) |

### API 확장

기존 `/api/bedrock/agent`에 3개 액션 추가 (기존 액션 변경 없음):

| 액션 | 설명 |
|------|------|
| `associateKnowledgeBase` | KB를 Agent에 연결 → PrepareAgent |
| `disassociateKnowledgeBase` | KB를 Agent에서 해제 → PrepareAgent |
| `listAgentKnowledgeBases` | Agent에 연결된 KB 목록 조회 |

---

## 11. Smart Routing — 비용 최적화 모델 선택

### 구현 상세

쿼리 복잡도에 따라 자동으로 라우팅합니다. 짧은 사실 확인 쿼리는 경량 모델(Haiku)로, 긴 분석 쿼리는 고성능 모델(Sonnet)로 라우팅합니다.

### 분류 알고리즘 (ComplexityClassifier)

| 특성 | 단순 쪽 | 복잡 쪽 |
|------|---------|---------|
| 문자 수 | ≤100자 (+0.3) | >100자 (+0.3) |
| 문장 수 | 1문장 (+0.2) | 여러 문장 (+0.2) |
| 분석 키워드 | 없음 | 있음 (+0.3) (比較/分析/要約/explain/compare/analyze/summarize) |
| 복수 질문 | 없음 | 물음표 2개 이상 (+0.2) |

점수 < 0.5 → 단순, ≥ 0.5 → 복잡. 신뢰도 = |점수 - 0.5| × 2.

### 주요 컴포넌트

| 파일 | 역할 |
|------|------|
| `docker/nextjs/src/lib/complexity-classifier.ts` | 쿼리 복잡도 분류 (순수 함수) |
| `docker/nextjs/src/lib/smart-router.ts` | 모델 라우팅 결정 |
| `docker/nextjs/src/store/useSmartRoutingStore.ts` | Zustand 스토어 (localStorage 영속화) |
| `docker/nextjs/src/components/sidebar/RoutingToggle.tsx` | ON/OFF 토글 + 모델 쌍 표시 |
| `docker/nextjs/src/components/chat/ResponseMetadata.tsx` | 사용된 모델 이름 + Auto/Manual 배지 |

### 기본 설정

- Smart Routing: 기본 OFF (기존 동작에 영향 없음)
- 경량 모델: `anthropic.claude-haiku-4-5-20251001-v1:0`
- 고성능 모델: `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 12. 모니터링 및 알림 — CloudWatch Dashboard + SNS Alerts + EventBridge

### 구현 상세

`enableMonitoring=true`로 활성화되는 선택적 기능으로, CloudWatch 대시보드, SNS 알림, EventBridge 통합을 제공합니다. 단일 대시보드에서 전체 시스템 상태를 확인할 수 있으며, 이상 발생 시 이메일 알림이 전송됩니다.

### 아키텍처

```
MonitoringConstruct (WebAppStack 내)
├── CloudWatch Dashboard (통합 대시보드)
│   ├── Lambda 개요 (WebApp / PermFilter / AgentScheduler / AD Sync)
│   ├── CloudFront (요청 수, 오류율, 캐시 적중률)
│   ├── DynamoDB (용량, 스로틀링)
│   ├── Bedrock (API 호출, 지연 시간)
│   ├── WAF (차단된 요청 수)
│   ├── 고급 RAG (Vision API, Smart Routing, KB 연결 관리)
│   ├── AgentCore (조건부: enableAgentCoreObservability=true)
│   └── KB Ingestion Jobs (실행 이력)
├── CloudWatch Alarms → SNS Topic → Email
│   ├── WebApp Lambda 오류율 > 5%
│   ├── WebApp Lambda P99 Duration > 25초
│   ├── CloudFront 5xx 오류율 > 1%
│   ├── DynamoDB 스로틀링 ≥ 1
│   ├── Permission Filter Lambda 오류율 > 10% (조건부)
│   ├── Vision API 타임아웃율 > 20%
│   └── Agent 실행 오류율 > 10% (조건부)
└── EventBridge Rule → SNS Topic
    └── Bedrock KB Ingestion Job FAILED
```

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| 대시보드 | CloudWatch Dashboard (자동 새로고침 5분) |
| 알람 | CloudWatch Alarms (OK↔ALARM 양방향 알림) |
| 알림 | SNS Topic + Email Subscription |
| 이벤트 모니터링 | EventBridge Rule (KB Ingestion Job 실패 감지) |
| 커스텀 메트릭 | CloudWatch Embedded Metric Format (EMF) |
| CDK Construct | `lib/constructs/monitoring-construct.ts` |

### 커스텀 메트릭 (EMF)

Lambda 함수 내에서 `PermissionAwareRAG/AdvancedFeatures` 네임스페이스로 커스텀 메트릭이 발행됩니다. `enableMonitoring=false`인 경우 no-op 구현이 사용되어 성능 영향이 없습니다.

| 메트릭 | 차원 | 소스 |
|--------|------|------|
| VisionApiInvocations / Timeouts / Fallbacks / Latency | Operation=vision | Vision API 호출 시 |
| SmartRoutingSimple / Complex / AutoSelect / ManualOverride | Operation=routing | Smart Router 선택 시 |
| KbAssociateInvocations / KbDisassociateInvocations / KbMgmtErrors | Operation=kb-mgmt | KB 연결 관리 API 호출 시 |

### 비용

| 리소스 | 월간 비용 |
|--------|----------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms (7개) | $0.70 |
| SNS Email 알림 | 무료 티어 내 |
| EventBridge Rule | 무료 티어 내 |
| **합계** | **약 $4/월** |

### CDK 스택

`DemoWebAppStack` 내에 `MonitoringConstruct`로 구현됩니다. `enableMonitoring=true` 시에만 리소스가 생성됩니다.

```bash
# 모니터링 활성화하여 배포
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com

# AgentCore Observability도 활성화
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  -c enableAgentCoreObservability=true
```
---

## 13. AgentCore Memory — 대화 컨텍스트 유지

### 구현 상세

`enableAgentCoreMemory=true`로 활성화되는 선택적 기능으로, Bedrock AgentCore Memory를 통해 단기 기억(세션 내 대화 기록)과 장기 기억(세션 간 사용자 선호도, 요약, 시맨틱 지식)을 제공합니다.

### 아키텍처

```
AIStack (CfnMemory)
├── Event Store (단기 기억: 세션 내 대화 기록, TTL 3일)
├── Semantic Strategy (장기 기억: 대화에서 사실/지식 자동 추출)
└── Summary Strategy (장기 기억: 세션 대화 요약 자동 생성)

Next.js API Routes
├── POST/GET/DELETE /api/agentcore/memory/session — 세션 관리
├── POST/GET /api/agentcore/memory/event — 이벤트 기록/조회
└── POST /api/agentcore/memory/search — 시맨틱 검색

인증 흐름
├── lib/agentcore/auth.ts — Cookie JWT 검증 (DynamoDB 접근 없음)
└── actorId = userId (@ → _at_, . → _dot_ 치환)
```

### CDK 리소스

| 리소스 | 설명 |
|--------|------|
| `CfnMemory` | AgentCore Memory 리소스 (`enableAgent=true` AND `enableAgentCoreMemory=true` 시에만 생성) |
| Memory IAM Role | `bedrock-agentcore.amazonaws.com` 서비스 프린시펄 |
| Lambda IAM Policy | `bedrock-agentcore:CreateEvent/ListEvents/DeleteEvent/ListSessions/RetrieveMemoryRecords` (memoryId 설정 시에만 추가) |

### 주요 기능

- 세션 내 대화 기록 자동 보존 (단기 기억, TTL 3일, 최소값)
- 세션 간 사용자 선호도 및 지식 자동 추출 (semantic strategy)
- 세션 대화 요약 자동 생성 (summary strategy)
- 사이드바에 세션 목록 및 메모리 섹션 표시
- KB 모드와 Agent 모드 모두에서 대화 컨텍스트 유지
- 8개 언어 i18n 지원 (`agentcore.memory.*`, `agentcore.session.*`)

### 배포 참고사항

| 항목 | 제약 | 해결 방법 |
|------|------|----------|
| Memory Name | `^[a-zA-Z][a-zA-Z0-9_]{0,47}` (하이픈 불가) | `prefix.replace(/-/g, '_')`로 변환 |
| EventExpiryDuration | 일 단위 (최소: 3, 최대: 365) | 3일 (최소값) |
| Service Principal | `bedrock-agentcore.amazonaws.com` | `bedrock.amazonaws.com`이 아님 |
| Tags Format | Map `{ key: value }` | CDK 기본 배열 형식을 `addPropertyOverride`로 오버라이드 |
| actorId | `[a-zA-Z0-9][a-zA-Z0-9-_/]*` | 이메일 주소의 `@`와 `.`를 치환 |

### CDK 컨텍스트 파라미터

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `enableAgentCoreMemory` | `false` | AgentCore Memory 활성화 (`enableAgent=true` 전제 조건) |

### 환경 변수

| 변수 | 설명 |
|------|------|
| `AGENTCORE_MEMORY_ID` | AgentCore Memory ID (CDK 출력) |
| `ENABLE_AGENTCORE_MEMORY` | Memory 기능 활성화 플래그 |

---

## 전체 시스템 아키텍처

```
+----------+     +----------+     +------------+     +---------------------+
| Browser  |---->| AWS WAF  |---->| CloudFront |---->| Lambda Web Adapter  |
+----------+     +----------+     | (OAC+Geo)  |     | (Next.js, IAM Auth) |
                                  +------------+     +------+--------------+
                                                            |
                      +---------------------+---------------+--------------------+
                      v                     v               v                    v
             +-------------+    +------------------+ +--------------+   +--------------+
             | Cognito     |    | Bedrock KB       | | DynamoDB     |   | DynamoDB     |
             | User Pool   |    | + S3 Vectors /   | | user-access  |   | perm-cache   |
             +-------------+    |   OpenSearch SL  | | (SID Data)   |   | (Perm Cache) |
                                +--------+---------+ +--------------+   +--------------+
                                         |
                             +-----------+-----------+
                             v                       v
                    +----------------+     +------------------+
                    | S3 Bucket      |     | FSx for ONTAP    |
                    | (Metadata Sync)|     | (SVM + Volume)   |
                    +----------------+     +--------+---------+
                                                    | CIFS/SMB
                                                    v
                                           +------------------+
                                           | Embedding EC2    |
                                           | (Titan Embed v2) |
                                           +------------------+
```

### CDK 스택 구성 (7개 스택)

| # | 스택 | 리전 | 주요 리소스 |
|---|------|------|-----------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (선택 사항) |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + Cognito Domain (AD Federation 활성화 시), AD Sync Lambda (선택 사항) |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD, KMS 암호화 (선택 사항), CloudTrail (선택 사항) |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (`vectorStoreType`으로 선택), Bedrock Guardrails (선택 사항) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker), CloudFront, Permission Filter Lambda (선택 사항), MonitoringConstruct (선택 사항) |
| 7 | EmbeddingStack (선택 사항) | ap-northeast-1 | EC2, ECR, ONTAP ACL 자동 취득 (선택 사항) |

### CDK 컨텍스트 파라미터 목록

| 파라미터 | 단계 | 기본값 | 설명 |
|---------|------|--------|------|
| `enableEmbeddingServer` | - | `false` | Embedding 서버 활성화 |
| `ontapMgmtIp` | 2 | (없음) | ONTAP 관리 IP (ACL 자동 취득) |
| `ontapSvmUuid` | 2 | (없음) | SVM UUID (ACL 자동 취득) |
| `useS3AccessPoint` | 2 | `false` | S3 AP를 KB 데이터 소스로 사용 |
| `usePermissionFilterLambda` | 3 | `false` | Permission Filter Lambda 활성화 |
| `enableGuardrails` | 4 | `false` | Bedrock Guardrails 활성화 |
| `enableKmsEncryption` | 4 | `false` | KMS 암호화 (S3, DynamoDB) |
| `enableCloudTrail` | 4 | `false` | CloudTrail 감사 로그 |
| `enableVpcEndpoints` | 4 | `false` | VPC Endpoints (Bedrock, SSM 등) |
| `enableMonitoring` | - | `false` | CloudWatch Dashboard + SNS Alerts + EventBridge 모니터링 |
| `monitoringEmail` | - | (없음) | 알림 통지 이메일 주소 |
| `enableAgentCoreMemory` | - | `false` | AgentCore Memory 활성화 (단기/장기 기억) (`enableAgent=true` 전제 조건) |
| `enableAgentCoreObservability` | - | `false` | AgentCore Runtime 메트릭을 대시보드에 통합 |
| `enableAdvancedPermissions` | - | `false` | 시간 기반 접근 제어 + 권한 판정 감사 로그 |

---
