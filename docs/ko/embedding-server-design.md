# Embedding 서버 설계 및 구현 문서

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | **한국어** | [简体中文](../zh-CN/embedding-server-design.md) | [繁體中文](../zh-TW/embedding-server-design.md) | [Français](../fr/embedding-server-design.md) | [Deutsch](../de/embedding-server-design.md) | [Español](../es/embedding-server-design.md)

**작성일**: 2026-03-26  
**대상 독자**: 개발자 및 운영자  
**소스 코드**: `docker/embed/`

---

## 개요

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

이 서버는 CIFS/SMB 마운트를 통해 FSx ONTAP의 문서를 읽고, Amazon Bedrock Titan Embed Text v2로 벡터화한 후, OpenSearch Serverless (AOSS)에 인덱싱합니다.

> **참고**: Embedding 서버는 AOSS 구성(`vectorStoreType=opensearch-serverless`)에서만 사용 가능합니다. S3 Vectors 구성(기본값)에서는 Bedrock KB가 자동으로 Embedding을 관리하므로 Embedding 서버가 필요하지 않습니다.

Bedrock KB S3 데이터 소스(옵션 A) 또는 S3 Access Point(옵션 C)를 사용할 수 없는 경우의 대체 경로(옵션 B)로 사용됩니다.

---

## 아키텍처

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. 파일 스캔 (재귀적, .md/.txt/.html 등)
  ├── 2. .metadata.json에서 SID 정보 읽기
  ├── 3. 텍스트 청크 분할 (1000자, 200자 오버랩)
  ├── 4. Bedrock Titan Embed v2로 벡터화 (1024차원)
  └── 5. AOSS에 인덱싱 (Bedrock KB 호환 형식)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## 소스 코드 구조

```
docker/embed/
├── src/
│   ├── index.ts       # 메인 처리 (스캔 → 청크 → Embedding → 인덱싱)
│   └── oss-client.ts  # AOSS SigV4 서명 클라이언트 (IMDS 인증 지원)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild 빌드 정의
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## 실행 모드

| 모드 | 환경 변수 | 동작 |
|------|----------|------|
| 배치 모드 | `ENV_WATCH_MODE=false` (기본값) | 모든 파일을 한 번 처리하고 종료 |
| 감시 모드 | `ENV_WATCH_MODE=true` | chokidar로 파일 변경을 감지하여 자동 처리 |

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ENV_REGION` | `ap-northeast-1` | AWS 리전 |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFS 마운트된 데이터 디렉토리 |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | 처리된 파일 기록 저장 위치 |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embedding 모델 |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSS 인덱스 이름 |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (필수) | AOSS 컬렉션 이름 |
| `ENV_WATCH_MODE` | `false` | 감시 모드 활성화 |
| `ENV_AUTO_METADATA` | `false` | ONTAP REST API를 통한 .metadata.json 자동 생성 |
| `ENV_ONTAP_MGMT_IP` | (비어 있음) | ONTAP 관리 엔드포인트 IP |
| `ENV_ONTAP_SVM_UUID` | (비어 있음) | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP 관리자 사용자 이름 |
| `ENV_ONTAP_PASSWORD` | (비어 있음) | ONTAP 관리자 비밀번호 |

---

## 처리 흐름

### 배치 모드

```
1. AOSS 클라이언트 초기화 (컬렉션 엔드포인트 조회)
2. processed.json 로드 (차분 처리용)
3. DATA_DIR 재귀 스캔 (.md, .txt, .html, .csv, .json, .xml)
4. 각 파일에 대해:
   a. mtime이 processed.json과 일치하면 건너뛰기
   b. .metadata.json이 있으면 사용
   c. .metadata.json이 없고 ENV_AUTO_METADATA=true인 경우:
      - ONTAP REST API를 통해 ACL 조회 (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)
      - ACL에서 SID를 추출하여 .metadata.json 자동 생성/기록
   d. 텍스트 읽기 → 청크 분할 (1000자, 200자 오버랩)
   e. 각 청크를 Bedrock Titan Embed v2로 벡터화
   f. AOSS에 인덱싱 (Bedrock KB 호환 형식)
   g. processed.json 업데이트
5. 처리 요약 출력 후 종료
```

### 감시 모드

```
1-5. 배치 모드와 동일 (초기 스캔)
6. chokidar로 파일 감시 시작
   - awaitWriteFinish: 2초 (쓰기 완료 대기)
7. 파일 추가/변경 이벤트 → 큐에 추가
8. 큐에서 순차적으로 처리 (`processing` 플래그로 배타 제어)
   - processFile() → processed.json 업데이트
9. 무한 루프로 대기
```

---

## 차분 처리 메커니즘

파일 경로와 수정 시간(mtime)을 `processed.json`에 기록합니다.

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- 파일의 mtime이 변경되지 않은 경우 건너뛰기
- 파일이 업데이트된 경우 재처리 (인덱스 덮어쓰기)
- `processed.json`을 삭제하면 모든 파일을 재처리

### 이전 버전과의 차이점

| 항목 | 이전 버전 | 현재 버전 |
|------|----------|----------|
| 차분 관리 | SQLite (drizzle-orm + better-sqlite3) | JSON 파일 (processed.json) |
| 파일 식별 | inode 번호 (files.ino) | 파일 경로 + mtime |
| 대량 파일 동시 업로드 | UNIQUE constraint failed | ✅ 순차 큐를 통해 안전하게 처리 |
| 의존성 | drizzle-orm, better-sqlite3 | 없음 (표준 fs) |

---

## AOSS 인덱스 형식

Bedrock KB 호환 필드 3개만 기록합니다.

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024차원
  "AMAZON_BEDROCK_TEXT_CHUNK": "문서 텍스트 청크",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### 중요: AOSS 인덱스 스키마 호환성

AOSS 인덱스는 `dynamic: false`로 생성됩니다. 이는 다음을 의미합니다:
- 위 3개 이외의 필드를 기록해도 인덱스 매핑이 변경되지 않음
- Bedrock KB 동기화 시 "storage configuration invalid" 오류가 발생하지 않음
- 메타데이터(SID 정보 등)는 `AMAZON_BEDROCK_METADATA` 필드 내에 JSON 문자열로 저장됨

### 메타데이터 구조

각 문서에는 대응하는 `.metadata.json` 파일이 필요합니다. 이 파일에 NTFS ACL SID 정보를 포함시킴으로써 RAG 검색 시 접근 제어를 실현합니다.

#### `.metadata.json`용 SID 정보 취득 방법

이 시스템에는 NTFS ACL에서 SID를 자동으로 취득하는 메커니즘이 있습니다.

| 컴포넌트 | 구현 파일 | 기능 |
|----------|----------|------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | SSM을 통해 PowerShell을 실행하여 AD 사용자 SID 정보를 취득하고 DynamoDB에 저장 |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | SSM을 통해 Get-Acl을 실행하여 파일/디렉토리의 NTFS ACL(SID)을 취득 |
| AD Sync 설정 | `types/agentcore-config.ts` (`AdSyncConfig`) | AD 동기화 활성화, 캐시 TTL, SSM 타임아웃 등의 설정 |

이들은 향후 확장 옵션입니다. 현재 데모 스택 구성(`lib/stacks/demo/`)에서는 검증 목적으로 샘플 `.metadata.json` 파일을 수동으로 배치합니다.

#### SID 자동 취득 처리 흐름

```
1. AD Sync Lambda (사용자 SID 취득)
   SSM → Windows EC2 → PowerShell (Get-ADUser) → SID 취득 → DynamoDB user-access에 저장

2. FSx Permission Service (파일 ACL 취득)
   SSM → Windows EC2 → PowerShell (Get-Acl) → NTFS ACL 취득 → SID 추출 → .metadata.json 생성 가능
```

#### 데모 환경의 간소화된 설정

데모 스택에서는 위의 자동화를 사용하지 않고 다음과 같은 수동 단계로 SID 데이터를 설정합니다:

- `.metadata.json`: `demo-data/documents/` 아래에 수동으로 배치한 샘플
- DynamoDB user-access: `demo-data/scripts/setup-user-access.sh`를 사용하여 이메일-SID 매핑을 수동 등록

#### 프로덕션 환경의 자동화 옵션

| 방법 | 설명 |
|------|------|
| AD Sync Lambda | SSM을 통해 AD 사용자 SID를 자동 취득하여 DynamoDB에 저장 (구현 완료) |
| FSx Permission Service | SSM을 통해 Get-Acl로 NTFS ACL 취득 (구현 완료) |
| ONTAP REST API | FSx ONTAP 관리 엔드포인트를 통해 직접 ACL 취득 (구현 완료: `ENV_AUTO_METADATA=true`) |
| S3 Access Point | S3 AP를 통한 파일 접근 시 NTFS ACL이 자동 적용 (CDK 지원: `useS3AccessPoint=true`) |

#### S3 Access Point 사용 시 (옵션 C)

Bedrock KB가 S3 Access Point를 통해 문서를 수집할 때, S3 Access Point의 `FileSystemIdentity`(WINDOWS 타입)를 통해 NTFS ACL이 자동으로 적용됩니다. 그러나 Bedrock KB Retrieve API가 반환하는 메타데이터에 ACL 정보가 포함되는지는 S3 Access Point 구현에 따라 다릅니다. 현시점에서는 `.metadata.json`을 통한 SID 관리가 확실한 방법입니다.

#### `.metadata.json` 형식

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → AMAZON_BEDROCK_METADATA에 저장되는 값
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS 인증 (SigV4 서명)

`oss-client.ts`는 AWS SigV4 서명을 사용하여 AOSS에 접근합니다.

- EC2 인스턴스 프로파일(IMDS)에서 자격 증명을 자동 취득
- `@aws-sdk/credential-provider-node`의 defaultProvider 사용
- 자격 증명은 만료 5분 전에 자동 갱신
- AOSS의 서비스 이름은 `aoss`

---

## 대량 파일 동시 업로드 처리

감시 모드에서 20개 이상의 파일이 동시에 업로드되는 경우:

1. chokidar의 `awaitWriteFinish`로 쓰기 완료 대기 (2초)
2. 각 파일 이벤트를 큐에 추가
3. 큐에서 한 번에 하나의 파일을 처리 (`processing` 플래그로 배타 제어)
4. 각 청크 Embedding 후 200ms 대기 (Bedrock API 속도 제한 대응)
5. 처리 완료 후 `processed.json` 업데이트

이를 통해 다음을 보장합니다:
- Bedrock API 속도 제한 위반 없음
- `processed.json`에 대한 동시 쓰기 없음
- 처리 중 프로세스가 중단되어도 `processed.json`에 이미 기록된 파일은 재처리되지 않음

---

## CDK 스택

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`)은 다음을 생성합니다:

| 리소스 | 설명 |
|--------|------|
| EC2 Instance (m5.large) | IMDSv2 강제, SSM 활성화 |
| ECR Repository | Embedding 컨테이너 이미지용 |
| IAM Role | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| Security Group | FSx SG + AD SG와의 통신 허용 |
| UserData | 자동 CIFS 마운트 + Docker 자동 시작 |

### 활성화

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| AOSS 403 Forbidden | EC2 역할이 데이터 접근 정책에 추가되지 않음 | AOSS 정책에 Embedding EC2 역할 추가 |
| Bedrock ThrottlingException | API 속도 제한 초과 | 청크 간 대기 시간 증가 (200ms → 500ms) |
| CIFS 마운트 실패 | SVM이 AD에 가입되지 않았거나 CIFS 공유가 생성되지 않음 | AD 가입 확인 + ONTAP REST API로 CIFS 공유 생성 |
| processed.json 손상 | 프로세스 중단 | `processed.json` 삭제 후 재실행 |
| KB 동기화 오류 (storage config invalid) | AOSS 인덱스에 KB 비호환 필드 존재 | 인덱스 삭제 → 재생성 → 데이터 소스 재생성 → 동기화 |
| SID 필터링에서 모든 문서 DENIED | Embedding 서버를 통한 문서에 메타데이터 없음 | `.metadata.json` 존재 여부 및 `allowed_group_sids` 설정 확인 |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../../README.ko.md) | 배포 단계 (옵션 B) |
| [docs/implementation-overview.md](implementation-overview.md) | 구현 개요 (항목 5: Embedding 서버) |
| [docs/ui-specification.md](ui-specification.md) | UI 사양 (디렉토리 표시) |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | 검증 환경 운영 절차 |
