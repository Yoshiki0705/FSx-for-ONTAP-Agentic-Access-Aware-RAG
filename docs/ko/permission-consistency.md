# 권한 메타데이터 변경 일관성 모델

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | **한국어** | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**작성일**: 2026-05-21
**갱신일**: 2026-09-07 (구현 확인에 따라 ACL 기점의 자동 반영 흐름 기술을 철회)
**상태**: 초안
**대상**: 운영 설계자, 보안 엔지니어

---

## 개요

이 문서는 검색 시점의 권한 판정에 사용되는 데이터가 변경되었을 때 검색 결과에 언제 반영되는지를 정의합니다. 판정에 사용되는 것은 두 가지로, 문서 측의 `.metadata.json`과 사용자 측의 DynamoDB `user-access`입니다.

**FSx for ONTAP상 파일의 NTFS ACL 변경을 자동으로 추종하는 메커니즘은 없습니다.** 권한 인덱스는 ACL의 투영이 아니라 별도로 구축·유지되는 인덱스입니다. 이유와 운영상의 함의는 「ACL 변경이 도달하지 않는 이유」에 기술합니다.

---

## 권한 판정에 사용되는 데이터

| 데이터 | 보관 위치 | 생성·갱신 주체 | 검색 시점의 역할 |
|-------|---------|-------------|--------------|
| `.metadata.json`(`allowed_group_sids` / `allowed_uids` / `allowed_gids`) | S3 AP상의 인접 오브젝트 → Bedrock KB의 메타데이터 속성 | 경로마다 다름(아래 표) | 취득 청크의 허용 SID / UID / GID 집합 |
| `user-access`(`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`) | DynamoDB | AD / LDAP 동기화 Lambda(`lambda/agent-core-ad-sync/`) | 호출자의 SID / UID / GID 집합 |
| `perm-cache` | DynamoDB(TTL 5분) | 권한 필터 | 판정 결과의 캐시 |

`.metadata.json`의 생성원:

| 경로 | 생성원 | 계기 |
|------|-------|------|
| Transfer Family SFTP(`enableTransferFamily=true`) | 관리자가 유지하는 DynamoDB 매핑(업로드 사용자명이 키) | 파일 업로드 시 |
| 자체 임베딩 서버(`ENV_AUTO_METADATA=true`, 선택·기본 비활성) | ONTAP REST API로 실제 NTFS ACL을 취득 | 미처리 파일 검출 시(mtime 판정) |
| 데모 환경 | 리포지토리에 포함된 샘플을 수동 배치 | 수동 |

SFTP 사용자에게는 `*.metadata.json`에 대한 IAM Deny가 부여되어 있어, 업로드한 사람이 자신의 권한을 작성할 수 없는 구조입니다.

---

## 반영 경로

자동으로 반영되는 경로는 2개 계통입니다.

### 경로 A: 문서 측 권한 변경

| 단계 | 담당 | 지연 |
|------|-----|------|
| ① `.metadata.json` 갱신 | 위 표의 생성원, 또는 관리자의 직접 갱신 | 계기 의존 |
| ② 차분 검출 | KB Auto-Sync(EventBridge Scheduler, `size` / `lastModified` / `ETag` 비교) | 폴링 간격(기본 15분) |
| ③ 벡터 스토어 갱신 | `StartIngestionJob` | 1~15분(건수 의존) |
| ④ 판정 결과 캐시 만료 | `perm-cache`의 TTL | 최대 5분 |

### 경로 B: 사용자 측 권한 변경

| 단계 | 담당 | 지연 |
|------|-----|------|
| ① AD 그룹 멤버십 변경 | AD 복제 | 통상 15분 이내 |
| ② `user-access` 갱신 | AD / LDAP 동기화 Lambda. **Cognito의 PostAuthentication / PostConfirmation 트리거 계기이며, 스케줄 실행은 없습니다** | 대상 사용자의 다음 사인인까지(부정) |
| ③ 판정 결과 캐시 만료 | `perm-cache`의 TTL, 또는 `user-access`의 DynamoDB Streams에 의한 명시적 무효화 | 최대 5분 |

경로 B의 ②는 세션이 계속되고 있는 사용자에게는 도달하지 않습니다. 확실하게 박탈하려면 「긴급 권한 박탈 절차」를 사용합니다.

---

## ACL 변경이 도달하지 않는 이유

파일의 NTFS ACL을 변경해도 어떤 배포 구성에서도 `.metadata.json`은 재생성되지 않습니다. 구현 확인 결과는 다음과 같습니다.

| 메커니즘 | ACL 변경으로 동작하는가 | 근거 |
|---------|-------------------|------|
| AD / LDAP 동기화 Lambda | 동작하지 않음 | ACL 취득도 `.metadata.json` 기록도 구현되어 있지 않음. 취득하는 것은 AD상의 사용자 SID뿐 |
| Transfer Family의 메타데이터 생성 | 동작하지 않음 | 계기는 파일 업로드. 생성원은 관리자가 유지하는 DynamoDB 매핑이며 ACL을 참조하지 않음 |
| 자체 임베딩 서버(`ENV_AUTO_METADATA=true`) | 동작하지 않음 | 재처리 판정이 `mtime`. ACL만의 변경은 `mtime`을 움직이지 않음 |
| KB Auto-Sync | 동작하지 않음 | 차분 판정이 `size` / `lastModified` / `ETag`. ACL 변경은 어느 것도 움직이지 않음 |
| FSx 권한 서비스(`lambda/permissions/fsx-permission-service.ts`) | 대상 외 | ACL을 읽는 코드는 존재하지만 어떤 CDK 스택에서도 배포되지 않음 |

**함의**: ACL 변경을 검색 결과에 반영하려면 운영자가 `.metadata.json`을 재생성해 S3 AP에 배치해야 합니다. 이 인덱스의 정확성은 운영에 의존하며, ACL과의 일치는 자동으로 보장되지 않습니다. 긴급한 접근 차단은 ACL 변경이 아니라 사용자 측(`user-access` 삭제 + 캐시 클리어 + 세션 무효화)에서 수행하세요.

---

## 각 단계의 상세

### 벡터 스토어 갱신(KB 재동기화)

| 방식 | 트리거 | 지연 | 비고 |
|------|-------|------|------|
| KB Auto-Sync | EventBridge Scheduler(폴링) | 설정 간격(기본: 15분) | `enableKbAutoSync=true` 시. 파일 변경 검출 시에만 StartIngestionJob 실행 |
| 수동 KB 동기화 | AWS 콘솔 / CLI | 즉시 시작, 완료까지 수 분 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 이벤트 | S3 PutObject | 수 분 | Transfer Family 경로에서 `enableCloudTrailIngestion=true` 시 |

**KB 동기화 소요 시간 기준:**

| 문서 수 | 동기화 시간(기준) |
|--------|---------------|
| ~100건 | 1~3분 |
| ~1,000건 | 5~15분 |
| ~10,000건 | 30~60분 |
| ~100,000건 | 수 시간(차분 동기화 권장) |

### 권한 캐시 무효화

| 캐시 | TTL | 무효화 방식 | 비고 |
|------|-----|-----------|------|
| DynamoDB `perm-cache` | 5분 | TTL 자동 만료 / `user-access`의 Streams에 의한 명시적 삭제 | 필터링 결과의 캐시 |
| DynamoDB `user-access` | 없음(영속) | 명시적 갱신 필요 | 사용자 SID / 그룹 SID |
| 브라우저 세션 | 세션 중 | 로그아웃 / 세션 만료 | 프런트엔드의 메모리 캐시 |

---

## 최대 지연(Permission Propagation Delay)

| 기점 | 최대 지연 | 내역 |
|------|---------|------|
| 문서 측 권한 변경(경로 A, Auto-Sync 15분 간격) | 약 35분 | 폴링 15분 + KB 동기화 15분 + 캐시 5분 |
| 문서 측 권한 변경(Auto-Sync 5분 간격) | 약 25분 | 폴링 5분 + KB 동기화 15분 + 캐시 5분 |
| 문서 측 권한 변경(수동 KB 동기화) | 약 20분 | KB 동기화 15분 + 캐시 5분 |
| 사용자 측 권한 변경(경로 B) | 정의 불가 | AD 복제 15분 + 다음 사인인까지(부정) + 캐시 5분 |
| 긴급 권한 박탈(아래 절차) | 최대 5분 | 캐시 강제 클리어 + Fail-Closed |
| 파일의 ACL 변경 | **정의 불가** | 자동으로 추종하는 메커니즘이 없음. 운영자에 의한 `.metadata.json` 재생성이 전제 |

KB 동기화의 15분은 문서 수에 의존합니다(위 소요 시간 기준 참조). 1만 건 규모에서는 30~60분이 되며 합계 지연도 그만큼 늘어납니다.

---

## 긴급 권한 박탈 절차

사용자의 접근 권한을 즉시 박탈해야 하는 경우:

### 절차 1: DynamoDB에서 사용자 SID 삭제(즉시 효과)

```bash
# 사용자의 SID 데이터를 삭제 → Fail-Closed에 의해 전체 문서 거부
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 절차 2: 권한 캐시 강제 클리어

```bash
# 해당 사용자의 캐시 엔트리를 삭제
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### 절차 3: Cognito 사용자 비활성화(세션 무효화)

```bash
# Cognito 사용자를 비활성화
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 효과

- 절차 1 실행 후: 신규 검색 요청은 즉시 전체 문서 거부(Fail-Closed)
- 절차 2 실행 후: 캐시된 오래된 권한 정보가 사용되는 것을 방지
- 절차 3 실행 후: 사용자의 세션 자체를 무효화

**이 절차가 문서 측이 아니라 사용자 측을 차단하고 있음에 유의하세요.** 특정 문서만을 한 사람에게서 숨기는 조작은 `.metadata.json` 갱신과 KB 재동기화를 기다리므로 경로 A의 지연을 받습니다.

---

## 권한 변경 시나리오별 동작

### 시나리오 1: 문서의 권한 메타데이터 변경

```
관리자가 파일 A의 .metadata.json에서 User X의 SID를 삭제
  → KB Auto-Sync가 차분을 검출(ETag 변화)
  → StartIngestionJob으로 벡터 스토어의 메타데이터 갱신
  → perm-cache의 TTL 만료 후, User X의 검색에서 파일 A가 제외
```

**지연**: 최대 약 35분(Auto-Sync 15분 간격 시)

### 시나리오 2: AD 그룹 멤버십 변경

```
관리자가 User X를 Engineering 그룹에서 삭제
  → AD 복제(~15분)
  → User X의 다음 사인인에서 AD 동기화 Lambda가 user-access의 groupSIDs를 갱신
  → perm-cache 만료 후, Engineering 한정 문서가 제외
```

**지연**: AD 복제 + 다음 사인인까지(부정) + 캐시 TTL. **세션이 계속되는 동안은 반영되지 않습니다.** 즉시성이 필요한 경우에는 긴급 권한 박탈 절차를 사용합니다.

### 시나리오 3: 파일 이동(rename / move)

```
관리자가 파일 A를 /public/에서 /confidential/로 이동
  → FSx상에서 상속 권한이 재계산됨(ONTAP 측의 실효 권한만)
  → .metadata.json은 이동 대상의 권한에 자동으로 추종하지 않음
  → 운영자가 .metadata.json을 재생성해 배치해야 함
```

**주의**: 이동 원본의 허용 SID가 남기 때문에 이동만으로는 검색상의 가시성이 바뀌지 않습니다. 디렉터리 구성을 권한 경계로 사용하는 운영에서는 이동과 `.metadata.json` 갱신을 하나의 절차로 묶으세요.

### 시나리오 4: 상위 폴더의 ACL 일괄 변경

```
관리자가 /confidential/ 폴더의 ACL을 변경(상속 유효)
  → 하위 전체 파일의 ONTAP상 실효 권한이 변경
  → .metadata.json은 추종하지 않음(「ACL 변경이 도달하지 않는 이유」 참조)
  → 하위 파일분의 .metadata.json 재생성 + KB 재동기화가 필요
```

**주의**: 대량 파일의 일괄 변경은 KB 동기화에 시간이 걸립니다. 단계적인 변경을 권장합니다.

---

## 일관성 보증 레벨

| 레벨 | 보증 내용 | 구현 방식 |
|------|---------|---------|
| **Fail-Closed** | SID 정보를 취득할 수 없는 경우 전체 거부 | DynamoDB 오류 시 / 레코드 없음 시 |
| **Eventually Consistent** | 권한 메타데이터(`.metadata.json` / `user-access`)의 변경은 최종적으로 검색 결과에 반영 | KB Auto-Sync + 캐시 TTL + Streams 무효화 |
| **No False Positive** | 권한이 없는 문서는 표시되지 않음 | SID 매칭(집합의 교집합) |
| **Metadata Required** | 메타데이터 없는 문서는 제외 | `.metadata.json` 필수 |
| **ACL 추종의 불성립** | 파일의 ACL 변경은 자동 반영되지 않음 | 운영자에 의한 `.metadata.json` 재생성이 전제 |

### 주의: False Negative의 가능성

다음 케이스에서는 본래 접근 가능한 문서가 일시적으로 표시되지 않을(False Negative) 가능성이 있습니다:

- 권한 부여 직후(`.metadata.json` 미갱신, 또는 KB 재동기화 전)
- KB 동기화 중(오래된 메타데이터가 잔존)
- AD 복제 지연 중, 또는 대상 사용자가 다시 사인인하기 전

**설계 방침**: 보안상 False Negative(보여야 할 것이 보이지 않음)는 허용하고, False Positive(보이면 안 되는 것이 보임)는 제로를 목표로 합니다.

단, **이 방침은 권한 인덱스가 정확하다는 것을 전제로 합니다.** ACL을 좁혔는데 `.metadata.json`을 갱신하지 않은 경우, 인덱스 측은 여전히 허용을 반환하므로 False Positive가 발생합니다. 인덱스의 유지가 경계 그 자체입니다.

---

## 모니터링·알림 권장 설정

```yaml
# CloudWatch Alarm 권장 설정
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 캐시 미스율이 높음 = 권한 데이터 갱신 빈도가 높음

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 3회 연속 실패로 알림

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 해결 실패는 즉시 알림

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed 발동이 많은 경우 조사 필요
```

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 설계 상세 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 프로덕션 준비 체크리스트 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 성능·용량 설계 |
