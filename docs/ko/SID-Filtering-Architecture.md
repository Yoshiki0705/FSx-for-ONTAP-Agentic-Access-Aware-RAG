# SID 기반 권한 필터링 아키텍처

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | **한국어** | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | [Français](../fr/SID-Filtering-Architecture.md) | [Deutsch](../de/SID-Filtering-Architecture.md) | [Español](../es/SID-Filtering-Architecture.md)

## 개요

이 시스템은 NTFS ACL SID(Security Identifier)를 활용하여 RAG 검색 결과를 사용자별로 필터링합니다. FSx for NetApp ONTAP 파일 시스템의 접근 권한 정보를 벡터 데이터베이스에 메타데이터로 저장하고, 검색 시 실시간으로 권한 확인을 수행합니다.

---

## 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        데이터 수집 흐름                                   │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ FSx 볼륨을      │    │ ・Titan Embed v2로    │  │
│  │ 파일         │    │ S3 호환         │    │   벡터화              │  │
│  │ 권한         │    │ 인터페이스로    │    │ ・메타데이터(SID)도   │  │
│  │ + .metadata  │    │ 노출            │    │   저장                │  │
│  │   .json      │    └─────────────────┘    └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ 벡터 스토어              │  │
│                                          │ (vectorStoreType으로     │  │
│                                          │  선택)                   │  │
│                                          │ ・S3 Vectors (기본값)    │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ 벡터 데이터 +            │  │
│                                          │ 메타데이터(SID 등)       │  │
│                                          │ 저장                     │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        검색 및 필터링 흐름                               │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ 사용자    │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │ (브라우저)│    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ 검색 결과                 │  │
│                           │              │ ・Citation (소스 문서)    │  │
│                           │              │   └─ 메타데이터           │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID 필터링 프로세스           │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ 사용자 SID ∩ 문서 SID       │  │
│              │ ・userSID         │    │ = 매칭 → 접근 허용          │  │
│              │ ・groupSIDs       │    │ ≠ 미매칭 → 접근 거부        │  │
│              └──────────────────┘    └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・허용된 문서만으로          │  │
│                                      │   응답 생성                  │  │
│                                      │ ・필터링된 Citation 반환     │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **S3 Access Point에 대해**: FSx for ONTAP의 S3 Access Point는 FSx 볼륨의 파일을 S3 호환 인터페이스를 통해 직접 노출합니다. 별도의 S3 버킷에 파일을 복사할 필요가 없습니다. Bedrock KB는 S3 AP 별칭을 데이터 소스로 참조하여 FSx 볼륨에서 직접 문서(`.metadata.json` 포함)를 수집합니다.

---

## 상세 SID 필터링 로직

### 단계 1: 사용자 SID 조회

사용자가 채팅에서 질문을 제출하면, KB Retrieve API가 DynamoDB `user-access` 테이블에서 사용자의 SID 정보를 조회합니다.

```
DynamoDB user-access 테이블
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrator)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (일반 사용자)        │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ 사용자의 전체 SID 목록 = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### 단계 2: 문서 메타데이터 조회

Bedrock KB 검색 결과의 각 Citation에는 S3의 `.metadata.json` 파일에서 수집된 메타데이터가 포함됩니다.

> **`.metadata.json` 생성 방법**: 이 시스템에는 AD Sync Lambda(`lambda/agent-core-ad-sync/`)와 FSx permission service(`lambda/permissions/fsx-permission-service.ts`)에 의해 구현된 자동 NTFS ACL 취득 기능이 포함되어 있습니다. 데모 환경에서는 검증 목적으로 샘플 데이터를 수동으로 배치합니다. 자세한 내용은 [docs/embedding-server-design.md](embedding-server-design.md)의 "메타데이터 구조" 섹션을 참조하세요.

```
문서 메타데이터 (.metadata.json)
┌──────────────────────────┬──────────────────────────────────────┐
│ 문서                     │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (모든 사용자)           │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (모든 사용자)           │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins 전용               │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins 전용               │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### 단계 3: SID 매칭

사용자의 SID 목록을 문서의 `allowed_group_sids`와 비교합니다.

```
매칭 규칙: 사용자 SID ∩ 문서 SID ≠ ∅ → 허용

■ 관리자 사용자 (admin@example.com)
  사용자 SID: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 사용자 SID → ✅ 허용
  public/company-overview   → S-1-1-0 ∈ 사용자 SID → ✅ 허용
  confidential/financial    → S-1-5-21-...-512 ∈ 사용자 SID → ✅ 허용
  confidential/hr-policy    → S-1-5-21-...-512 ∈ 사용자 SID → ✅ 허용
  restricted/project-plan   → S-1-5-21-...-512 ∈ 사용자 SID → ✅ 허용

■ 일반 사용자 (user@example.com)
  사용자 SID: [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ 사용자 SID → ✅ 허용
  public/company-overview   → S-1-1-0 ∈ 사용자 SID → ✅ 허용
  confidential/financial    → S-1-5-21-...-512 ∉ 사용자 SID → ❌ 거부
  confidential/hr-policy    → S-1-5-21-...-512 ∉ 사용자 SID → ❌ 거부
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ 거부
```

### 단계 4: Fail-Safe 폴백

SID 정보를 조회할 수 없는 경우(DynamoDB에 레코드 없음, 연결 오류 등), 시스템은 안전한 쪽으로 폴백하여 모든 문서에 대한 접근을 거부합니다.

```
SID 조회 실패 시 흐름:
  DynamoDB → 오류 또는 레코드 없음
    → allUserSIDs = [] (비어 있음)
    → 모든 문서 거부
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## SID (Security Identifier)에 대해

### SID 구조

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              도메인 식별자                     상대 ID
│ │ │  └─ 하위 권한 수
│ │ └─ 식별자 권한 (5 = NT Authority)
│ └─ 리비전
└─ SID 프레픽스
```

### 주요 SID

| SID | 이름 | 설명 |
|-----|------|------|
| `S-1-1-0` | Everyone | 모든 사용자 |
| `S-1-5-21-...-500` | Administrator | 도메인 관리자 |
| `S-1-5-21-...-512` | Domain Admins | 도메인 관리자 그룹 |
| `S-1-5-21-...-1001` | User | 일반 사용자 |
| `S-1-5-21-...-1100` | Engineering | 엔지니어링 그룹 |

### FSx for ONTAP에서의 SID

FSx for ONTAP은 NTFS 보안 스타일 볼륨에서 Windows ACL을 지원합니다. 각 파일/디렉토리에는 ACL(Access Control List)이 구성되어 있으며, SID 기반으로 접근 권한이 관리됩니다.

S3 Access Point를 통해 FSx의 파일에 접근할 때, NTFS ACL 정보가 메타데이터로 노출됩니다. 이 시스템은 이 ACL 정보(SID)를 Bedrock KB 메타데이터로 수집하여 검색 시 필터링에 사용합니다.

---

## 상세 데이터 흐름

### 1. 데이터 수집 시 (Embedding)

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3 호환      │  KB 동기화  │ 벡터화       │
│ NTFS ACL:   │──Point──▶     │ 인터페이스   │────────▶   │ + 메타데이터 │
│  Admin:Full │                │              │             │ 저장         │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │ (FSx에서     │             ┌──────────────┐
│ {           │                │  직접 노출)  │             │ OpenSearch   │
│  "allowed_  │                └──────────────┘             │ Serverless   │
│   group_sids│                                             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │   (SID 정보) │
                                                            └──────────────┘
```

> S3 Access Point는 FSx 볼륨 파일을 S3 호환 인터페이스를 통해 직접 노출하므로, S3 버킷에 복사할 필요가 없습니다.

### 데이터 수집 경로 옵션

이 시스템은 세 가지 데이터 수집 경로를 제공합니다. 2026년 3월 기준 FlexCache Cache 볼륨에서는 S3 Access Point를 사용할 수 없으므로, 대체 구성이 필요합니다.

| # | 경로 | 방법 | CDK 활성화 | 사용 사례 |
|---|------|------|-----------|----------|
| 1 | 메인 | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 표준 볼륨 (S3 AP 지원) |
| 2 | 대체 | S3 버킷에 수동 업로드 → Bedrock KB | `upload-demo-data.sh` | FlexCache 볼륨 및 기타 S3 AP 미지원 사례 |
| 3 | 대안 | CIFS 마운트 → Embedding 서버 → AOSS에 직접 쓰기 | `-c enableEmbeddingServer=true` | FlexCache 볼륨 + AOSS 직접 제어가 필요한 경우 |

경로 2의 S3 버킷(`${prefix}-kb-data-${ACCOUNT_ID}`)은 StorageStack에 의해 항상 생성됩니다. S3 AP를 사용할 수 없는 경우, 이 버킷에 문서 + `.metadata.json`을 업로드하고 KB 데이터 소스로 구성하면 SID 필터링을 활성화할 수 있습니다.

### 2. 검색 시 (2단계 방식: Retrieve + Converse)

```
사용자           Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 질문 제출        │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ SID 조회           │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API (벡터 검색 + 메타데이터) │                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ 검색 결과 + 메타데이터 (SID)         │                │
  │                  │                    │                  │                │
  │                  │ SID 매칭           │                  │                │
  │                  │ (사용자 SID ∩      │                  │                │
  │                  │  문서 SID)         │                  │                │
  │                  │                    │                  │                │
  │                  │ 허용된 문서만으로 응답 생성                            │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 필터링된 결과    │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> Retrieve API를 RetrieveAndGenerate API 대신 사용하는 이유: RetrieveAndGenerate API는 Citation의 `metadata` 필드에 `.metadata.json`의 `allowed_group_sids`를 포함하지 않아 SID 필터링이 불가능합니다. Retrieve API는 메타데이터를 올바르게 반환하므로, 2단계 방식(Retrieve → SID 필터 → Converse)을 채택합니다.

### 3. Agent 모드 검색 시 (하이브리드 방식)

Agent 모드에서는 권한 인식 RAG를 실현하기 위해 하이브리드 방식을 채택합니다. InvokeAgent API는 애플리케이션 측에서 SID 필터링을 허용하지 않으므로, KB Retrieve API + SID 필터링 + Converse API(Agent 시스템 프롬프트 포함)의 조합으로 실현합니다.

```
사용자           Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ 질문 제출        │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ 결과 + 메타데이터  │                    │                │
  │                  │                    │                    │                │
  │                  │ SID 조회                                │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID 필터링         │                    │                │
  │                  │ (KB 모드와 동일)   │                    │                │
  │                  │                    │                    │                │
  │                  │ 허용된 문서 + Agent 시스템 프롬프트로 응답 생성          │
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent 응답       │                    │                    │                │
  │ + Citation       │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> Bedrock Agent InvokeAgent API도 사용 가능하지만, InvokeAgent API는 애플리케이션 측에서 SID 필터링을 허용하지 않으므로 폴백으로만 사용됩니다. 권한 인식 동작을 보장하기 위해 하이브리드 방식이 기본값입니다.

---

## API 응답 예시

### 필터링 로그 (filterLog)

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## 보안 설계

### Fail-Safe 폴백 원칙

이 시스템은 "Fail-Closed" 원칙을 따르며, 권한 확인이 실패하면 모든 문서에 대한 접근을 거부합니다.

| 상황 | 동작 |
|------|------|
| DynamoDB 연결 오류 | 모든 문서 거부 |
| 사용자 SID 레코드 없음 | 모든 문서 거부 |
| 메타데이터에 SID 정보 없음 | 해당 문서 거부 |
| SID 매칭 없음 | 해당 문서 거부 |
| SID 매칭 발견 | 해당 문서 허용 |

### 권한 캐시

필터링 결과는 DynamoDB `permission-cache` 테이블에 캐시되어 동일한 사용자와 문서 조합에 대한 반복 확인을 가속화합니다 (TTL: 5분).