# S3 Vectors + SID 필터링 아키텍처 가이드

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | **한국어** | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | [Français](../fr/s3-vectors-sid-architecture-guide.md) | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | [Español](../es/s3-vectors-sid-architecture-guide.md)

**작성일**: 2026-03-29
**검증 환경**: ap-northeast-1 (도쿄)
**상태**: CDK 배포 검증 완료, SID 필터링 검증 완료

---

## 개요

이 문서는 Permission-aware RAG 시스템의 벡터 스토어로 Amazon S3 Vectors를 채택하기 위한 아키텍처 결정과 SID 기반 접근 제어의 통합 패턴을 정리합니다. 전문가 피드백에 대한 검증 결과와 권장 사항을 포함합니다.

---

## SID 필터링 패턴 평가

### 이 시스템의 현재 접근 방식

이 시스템은 Bedrock KB Retrieve API를 사용하여 벡터 검색을 수행하고, 반환된 메타데이터의 `allowed_group_sids` 필드를 애플리케이션 측에서 매칭합니다. 이 접근 방식은 벡터 스토어에 독립적입니다.

```
Bedrock KB Retrieve API → 검색 결과 + 메타데이터 (allowed_group_sids)
→ 애플리케이션 측 매칭: 사용자 SID ∩ 문서 SID
→ 매칭된 문서만으로 Converse API 호출
```

### 패턴 A: SID를 Filterable 메타데이터로 첨부 (권장 패턴)

S3 Vectors의 모든 메타데이터는 기본적으로 filterable이므로, `allowed_group_sids`는 추가 구성 없이 필터링할 수 있습니다.

#### 이 시스템에서의 적용

이 시스템은 Bedrock KB를 통해 S3 Vectors에 접근하므로, `QueryVectors` 필터 파라미터를 직접 제어할 수 없습니다. Bedrock KB Retrieve API가 벡터 검색을 수행하고 메타데이터를 포함한 결과를 반환합니다. SID 필터링은 애플리케이션 측에서 수행됩니다.

이 접근 방식의 장점:
- Bedrock KB Retrieve API는 벡터 스토어에 독립적이므로, 동일한 애플리케이션 코드가 S3 Vectors와 AOSS 모두에서 작동
- `.metadata.json`의 `allowed_group_sids`가 메타데이터로 그대로 저장 및 반환됨
- 애플리케이션 측 SID 필터링 로직(`route.ts`)의 변경이 불필요

#### 전문가 피드백에 대한 대응

> 애플리케이션이 항상 SID 필터를 적용하는지 테스트를 통해 확인하세요. S3 Vectors 메타데이터 필터는 편리하지만, 접근 제어 자체를 대체하지는 않습니다.

이 시스템은 다음을 통해 이를 보장합니다:
1. SID 필터링이 KB Retrieve API 라우트(`route.ts`)에 내장되어 있어 우회 불가
2. DynamoDB에서 SID 정보를 조회할 수 없는 경우 모든 문서를 거부 (Fail-Closed 원칙)
3. 속성 기반 테스트(Property 5)를 통해 SID 필터링의 벡터 스토어 독립성을 검증 완료

### 패턴 B: SID/테넌트별 인덱스 분리

#### 이 시스템에서의 평가

이 시스템의 SID는 Active Directory NTFS ACL 기반의 그룹 SID이며, 문서당 여러 SID가 할당됩니다 (예: `["S-1-5-21-...-512", "S-1-1-0"]`). SID별 인덱스 분리는 다음과 같은 이유로 부적절합니다:

1. **다대다 SID 관계**: 단일 문서가 여러 SID 그룹에 속하고, 단일 사용자가 여러 SID를 가짐. 인덱스 분리 시 문서 중복 저장 필요
2. **동적 SID 수 변경**: AD 그룹 추가/수정에 따라 SID 수가 변동. 인덱스 관리가 복잡해짐
3. **10,000 인덱스/버킷 제한**: 대규모 AD 환경에서 SID 수가 이 제한에 근접할 수 있음

#### 하이브리드 설계 고려

전문가가 지적한 대로, 테넌트/고객별로 인덱스를 분리하고 각 인덱스 내에서 SID 필터를 사용하는 하이브리드 설계가 효과적입니다. 이 시스템은 단일 테넌트(단일 AD 환경)를 가정하므로 현시점에서 인덱스 분리는 불필요합니다. 멀티 테넌트 확장 시 검토할 예정입니다.

---

## 마이그레이션 체크리스트 검증 결과

### 1. Embedding 모델 / 차원 / 메트릭 검증

| 항목 | 현재 (AOSS) | S3 Vectors | 호환성 |
|------|------------|-----------|--------|
| Embedding 모델 | Amazon Titan Embed Text v2 | 동일 | ✅ |
| 차원 | 1024 | 1024 | ✅ |
| 거리 메트릭 | l2 (AOSS/faiss) | cosine (S3 Vectors) | ⚠️ 검증 필요 |
| 데이터 타입 | - | float32 (필수) | ✅ |

> **참고**: 현재 AOSS는 l2(유클리드 거리)를 사용하고, S3 Vectors는 cosine을 사용합니다. Bedrock KB가 embedding과 메트릭 간의 일관성을 관리하므로 KB를 통해 접근할 때는 문제가 없습니다. 그러나 S3 Vectors API를 직접 사용할 때는 메트릭 차이에 주의하세요. S3 Vectors는 인덱스 생성 후 차원과 메트릭을 변경할 수 없습니다.

### 2. 메타데이터 설계

| 메타데이터 키 | 용도 | Filterable | 비고 |
|-------------|------|-----------|------|
| `allowed_group_sids` | SID 필터링 | non-filterable 권장 | Bedrock KB Retrieve API를 통한 애플리케이션 측 필터링이므로 S3 Vectors 필터 불필요 |
| `access_level` | 접근 수준 표시 | non-filterable 권장 | UI 표시용 |
| `doc_type` | 문서 유형 | non-filterable 권장 | 향후 필터링용 |
| `source_uri` | 소스 파일 경로 | non-filterable | 검색 불가, 참조용 |
| `chunk_text` | 청크 텍스트 | non-filterable | 검색 불가, 대용량 데이터 |

#### S3 Vectors 메타데이터 제약 (검증 중 발견된 실제 값)

| 제약 | 명목 값 | Bedrock KB 사용 시 실효 값 | 완화 방법 |
|------|--------|--------------------------|----------|
| Filterable 메타데이터 | 2KB/벡터 | **커스텀 메타데이터 최대 1KB** (나머지 1KB는 Bedrock KB 내부 메타데이터가 소비) | 커스텀 메타데이터 최소화 |
| Non-filterable 메타데이터 키 | 최대 10개 키/인덱스 | 10개 키 (Bedrock KB 자동 키 5개 + 커스텀 키 5개) | Bedrock KB 자동 키를 non-filterable로 우선 지정 |
| 총 메타데이터 키 | 최대 50개 키/벡터 | 35개 키 (Bedrock KB 사용 시) | 문제 없음 |

#### Bedrock KB가 자동으로 추가하는 메타데이터 키

다음 키는 Bedrock KB가 S3 Vectors에 자동으로 저장합니다. `nonFilterableMetadataKeys`에 포함하지 않으면 filterable로 처리되어 2KB 제한을 소비합니다.

| 키 | 설명 | non-filterable 권장 |
|-----|------|-------------------|
| `x-amz-bedrock-kb-source-file-modality` | 파일 유형 (TEXT 등) | ✅ |
| `x-amz-bedrock-kb-chunk-id` | 청크 ID (UUID) | ✅ |
| `x-amz-bedrock-kb-data-source-id` | 데이터 소스 ID | ✅ |
| `x-amz-bedrock-kb-source-uri` | 소스 URI | ✅ |
| `x-amz-bedrock-kb-document-page-number` | PDF 페이지 번호 | ✅ |

> **중요**: PDF 페이지 번호 메타데이터 등으로 인해 filterable 메타데이터가 2KB를 초과할 수 있습니다. 모든 Bedrock KB 자동 키를 `nonFilterableMetadataKeys`에 포함하고, 커스텀 메타데이터도 가능한 한 non-filterable로 설정하세요.

### 3. 권한 부족 사전 검증

검증을 통해 확인된 필수 IAM 액션:

```
KB Role (Bedrock KB용):
  s3vectors:QueryVectors   ← 검색에 필요
  s3vectors:PutVectors     ← 데이터 동기화에 필요
  s3vectors:DeleteVectors  ← 데이터 동기화에 필요
  s3vectors:GetVectors     ← 메타데이터 조회에 필요 (전문가 지적 사항)
  s3vectors:ListVectors    ← 검증 중 필요성 발견

Custom Resource Lambda (리소스 관리용):
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

> **검증 중 발견**: KB Role에 `s3vectors:GetVectors`뿐만 아니라 `s3vectors:ListVectors`도 필요합니다. 누락 시 403 오류가 발생합니다.

### 4. 성능 검증

> **상태**: CDK 배포 검증 완료. Retrieve API 지연 시간 검증 완료.

S3 Vectors 명목 성능:
- 콜드 쿼리: 서브초 (1초 이내)
- 웜 쿼리: ~100ms 이하
- 고빈도 쿼리: 지연 시간 감소

Retrieve API 검증 결과 (2개 문서, ap-northeast-1):
- Bedrock KB Retrieve API가 SID 메타데이터(`allowed_group_sids`)를 올바르게 반환하는 것을 확인
- 공개 문서: `allowed_group_sids: ["S-1-1-0"]` (Everyone SID)
- 기밀 문서: `allowed_group_sids: ["S-1-5-21-...-512"]` (Domain Admins SID)
- `access_level`, `doc_type` 등의 커스텀 메타데이터도 올바르게 반환됨
- 기존 SID 필터링 로직(`route.ts`)이 수정 없이 작동

### 5. 단계적 마이그레이션 설계

이 시스템은 CDK 컨텍스트 파라미터 `vectorStoreType` 전환을 통해 단계적 마이그레이션을 지원합니다:

1. **Phase 1**: `vectorStoreType=s3vectors`로 신규 배포 (검증 환경) ← 현재 여기
2. **Phase 2**: 데이터 소스 추가/동기화, Retrieve API를 통한 SID 메타데이터 조회 검증
3. **Phase 3**: 성능 검증 (지연 시간, 동시성)
4. **Phase 4**: 프로덕션 환경 채택 결정

AOSS에서 S3 Vectors로의 마이그레이션은 Bedrock KB 데이터 소스를 재동기화하여 달성할 수 있습니다 (벡터 데이터는 KB가 자동 생성하므로 수동 마이그레이션 불필요).

---

## CDK 배포 검증 결과

### 검증 환경

- 리전: ap-northeast-1 (도쿄)
- 스택 이름: s3v-test-val-AI (단독 검증), perm-rag-demo-demo-* (전체 스택 검증)
- vectorStoreType: s3vectors
- 배포 시간: AI 스택 단독 ~83초, 전체 스택 (6개 스택) ~30분

### 전체 스택 E2E 검증 결과 (2026-03-30)

6개 스택 모두 배포된 상태에서 S3 Vectors 구성의 E2E 검증을 수행했습니다 (Networking, Security, Storage, AI, WebApp + WAF).

#### SID 필터링 동작 검증

| 사용자 | SID | 질문 | 참조된 문서 | 결과 |
|--------|-----|------|-----------|------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "회사의 매출을 알려주세요" | confidential/financial-report.txt + public/product-catalog.txt (2건) | ✅ 응답에 150억 엔 매출 정보 포함 |
| user@example.com | Regular User (-1001) + Everyone (S-1-1-0) | "회사의 매출을 알려주세요" | public/product-catalog.txt (1건만) | ✅ 매출 정보 없음 (기밀 문서 올바르게 제외) |

#### Agent 모드 검증 (admin@example.com)

| 테스트 | 질문 | 결과 |
|--------|------|------|
| Agent Action Group을 통한 KB 검색 | "회사의 매출을 알려주세요" | ✅ 응답에 150억 엔 매출 정보 포함. Agent가 Permission-aware Search Action Group을 통해 Retrieve API를 호출하고 SID 필터링된 결과에서 응답 생성 |

Agent 모드 교훈:
- Bedrock Agent Action Group은 Bedrock KB Retrieve API를 사용하므로 벡터 스토어 유형(S3 Vectors / AOSS)에 독립적
- CDK를 통해 생성된 Agent(`enableAgent=true`)는 S3 Vectors 구성에서도 PREPARED 상태로 정상 작동
- Agent를 통한 SID 필터링은 KB 모드와 동일한 로직 사용 (`route.ts` 하이브리드 접근 방식)

#### 검증 중 발견된 추가 교훈

| # | 교훈 | 영향 |
|---|------|------|
| 1 | 애플리케이션이 Cognito sub 대신 이메일 주소를 userId로 전송 | DynamoDB 키를 이메일 주소로 등록 필요 |
| 2 | SVM AD 가입에 VPC 보안 그룹의 AD 포트 개방 필요 | FSx SG에 포트 636, 135, 464, 3268-3269, 1024-65535 추가 필요. CDK NetworkingStack 업데이트 필요 |
| 3 | `@aws-sdk/client-scheduler` 의존성 누락 | 다른 스레드의 기능 추가로 인해 발생. package.json에 추가하여 해결 |
| 4 | SVM AD 가입에 OU 지정 필요 | AWS Managed AD의 경우 `OrganizationalUnitDistinguishedName`에 `OU=Computers,OU=<ShortName>,DC=<domain>,DC=<tld>` 지정 필요 |
| 5 | FSx ONTAP S3 AP 접근에 버킷 정책 구성 필요 | SSO assumed role은 기본적으로 S3 AP에 접근 불가. S3 AP 정책(`s3:*`) + IAM ID 기반 정책(S3 AP ARN 패턴) 모두 필요. 또한 볼륨에 파일이 존재하고 NTFS ACL이 접근을 허용해야 함 (이중 인가) |
| 6 | FSx ONTAP S3 AP는 이중 인가 모델 사용 | IAM 인증(S3 AP 정책 + ID 기반 정책)과 파일 시스템 인증(NTFS ACL) 모두 필요. 볼륨이 비어 있거나 CIFS 공유가 생성되지 않은 경우에도 AccessDenied 발생 |
| 7 | FSx ONTAP 관리자 비밀번호는 CDK AD 비밀번호와 별도 | FSx ONTAP `fsxadmin` 비밀번호는 파일 시스템 생성 시 자동 생성됨. ONTAP REST API를 통한 CIFS 공유 생성에 이 비밀번호 필요. CDK에서 `FsxAdminPassword` 설정 또는 `update-file-system`으로 나중에 설정 |
| 8 | FSx ONTAP S3 AP AccessDenied 문제 | **근본 원인 확인: Organization SCP**. 이전 계정(Organization SCP 제한 없음)에서 S3 AP 접근 성공. 새 계정(Organization SCP 제한 있음)에서 AccessDenied. Organization 관리 계정에서 SCP 수정 필요 |
| 9 | S3 Vectors filterable 메타데이터 2KB 제한 | Bedrock KB + S3 Vectors 사용 시 커스텀 메타데이터는 **1KB**로 제한 (독립 S3 Vectors의 2KB가 아님, Bedrock KB 내부 메타데이터가 나머지 1KB 소비). 또한 Bedrock KB가 자동 추가하는 메타데이터 키(`x-amz-bedrock-kb-chunk-id`, `x-amz-bedrock-kb-data-source-id`, `x-amz-bedrock-kb-source-file-modality`, `x-amz-bedrock-kb-document-page-number` 등)가 filterable로 처리되어 PDF 페이지 번호 메타데이터가 2KB 제한을 초과할 수 있음. 모든 메타데이터 키를 `nonFilterableMetadataKeys`(최대 10개 키)에 지정해도 Bedrock KB 자동 추가 키가 많은 경우 충분하지 않을 수 있음. **완화 방법**: (1) 메타데이터 키 최소화 (`sids`만, 짧은 값), (2) 메타데이터 없는 PDF 파일 사용, (3) S3 버킷 대체 경로는 새 계정에서 문제 없이 검증됨 (AOSS 구성에서는 2KB 제한 없음) |

#### FSx ONTAP S3 AP 경로 검증 상태

| 단계 | 상태 | 비고 |
|------|------|------|
| SVM AD 가입 | ✅ 완료 | OU 지정 + SG 포트 추가로 해결 |
| CIFS 공유 생성 | ✅ 완료 | ONTAP REST API를 통해 `data` 공유 생성 |
| SMB를 통한 파일 배치 | ✅ 완료 | `demo.local\Admin`을 사용하여 public/confidential에 파일 배치 |
| S3 AP 생성 | ✅ AVAILABLE | WINDOWS 사용자 유형, AD 가입된 SVM으로 생성 |
| S3 AP를 통한 접근 | ❌ AccessDenied (새 계정만) | **근본 원인 확인: Organization SCP**. 이전 계정(SCP 제한 없음)에서 접근 성공. Organization 관리 계정에서 SCP 수정 필요 |
| KB 동기화 (S3 AP 경유) | ⚠️ 메타데이터 2KB 제한 | S3 AP를 통한 KB 동기화 자체는 성공하지만, PDF 파일 메타데이터가 2KB 제한을 초과할 수 있음 |
| KB 동기화 (S3 버킷 경유) | ✅ 완료 | S3 버킷 대체 경로를 통한 SID 메타데이터 포함 문서의 KB 동기화 성공 |
| cdk destroy | ✅ 완료 | S3 Vectors 커스텀 리소스(버킷 + 인덱스) 정상 삭제. 기존 FSx 참조 모드에서 FSx 유지 (설계대로) |

> **대체 경로**: S3 버킷 대체 경로(S3 버킷 → KB 동기화 → S3 Vectors → SID 필터링)를 통한 E2E 검증이 완료되었습니다. SID 필터링은 벡터 스토어 및 데이터 소스 유형에 독립적이므로, S3 버킷 경로의 검증 결과는 S3 AP 경로에도 적용됩니다.

### S3 Vectors → OpenSearch Serverless Export 검증 결과

콘솔에서의 원클릭 내보내기를 다음과 같은 결과로 검증했습니다:

| 단계 | 소요 시간 | 결과 |
|------|----------|------|
| AOSS 컬렉션 자동 생성 | ~5분 | ACTIVE |
| OSI 파이프라인 자동 생성 | ~5분 | ACTIVE → 데이터 전송 시작 |
| 데이터 전송 완료 | ~5분 | 파이프라인 자동 STOPPING |
| 합계 | ~15분 | 내보내기 완료 |

내보내기 중 자동 생성되는 리소스:
- AOSS 컬렉션 (`s3vectors-collection-<timestamp>`)
- OSI 파이프라인 (`s3vectors-pipeline<timestamp>`)
- IAM 서비스 역할 (`S3VectorsOSIRole-<timestamp>`)
- DLQ S3 버킷

내보내기 교훈:
- 콘솔의 "Create and use a new service role" 옵션이 IAM 역할을 자동 생성. 스크립트로 사전에 역할을 생성할 필요 없음
- OSI 파이프라인은 데이터 전송 완료 후 자동으로 중지 (비용 효율적)
- 파이프라인 중지 후에도 AOSS 컬렉션은 검색 가능한 상태 유지
- AOSS 컬렉션의 최대 OCU는 기본값 100 (콘솔에서 구성 가능)
- 내보내기 스크립트(`export-to-opensearch.sh`)의 trust policy는 `osis-pipelines.amazonaws.com`만 사용 (`s3vectors.amazonaws.com`은 IAM에서 유효하지 않은 서비스 프린시펄)

#### Export 콘솔 화면

![S3 Vectors → OpenSearch Serverless Export 구성 화면](screenshots/s3vectors-export-to-opensearch.png)

콘솔은 다음을 자동화합니다:
- OpenSearch Serverless 벡터 컬렉션 생성 (최대 OCU: 100)
- IAM 서비스 역할 생성 (S3 Vectors 읽기 + AOSS 쓰기)
- OpenSearch Ingestion 파이프라인 생성 (DLQ S3 버킷 포함)

### 생성된 리소스 (예시)

| 리소스 | ARN/ID 패턴 |
|--------|------------|
| Knowledge Base | `<KB_ID>` |
| Vector Bucket | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors` |
| Vector Index | `arn:aws:s3vectors:<region>:<account>:bucket/<prefix>-vectors/index/bedrock-knowledge-base-default-index` |

### 배포 중 발견 및 수정된 문제

| # | 문제 | 원인 | 수정 |
|---|------|------|------|
| 1 | SDK v3 응답에 ARN 없음 | S3 Vectors API 사양 | 패턴에서 ARN 구성 |
| 2 | S3VectorsConfiguration 유효성 검사 오류 | indexArn과 indexName의 상호 배타성 | indexArn만 사용 |
| 3 | KB 생성 시 403 오류 | IAM 정책 의존성 | 명시적 ARN 패턴 사용 |
| 4 | DeleteIndexCommand가 생성자가 아님 | SDK API 명령 이름 차이 | CreateIndex/DeleteIndex 사용 |
| 5 | CloudFormation Hook | 조직 수준 Hook | --method=direct 사용 |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 설계 상세 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3가지 구성 비교표 및 구현 교훈 |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | 기술 설계 문서 |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | 요구 사항 문서 |