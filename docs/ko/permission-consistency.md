# 권한 변경 일관성 모델

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | **한국어** | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 운영 설계자, 보안 엔지니어

---

## 개요

이 문서는 FSx for ONTAP의 파일 ACL 변경이 벡터 스토어와 권한 캐시에 언제, 어떻게 반영되는지를 명확히 하고, 권한 변경 시 일관성 보장 수준을 정의합니다.

---

## 전체 권한 데이터 흐름

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     권한 변경 전파 흐름                                         │
│                                                                              │
│  ① ACL 변경        ② 메타데이터 재생성   ③ KB 재동기화       ④ 캐시          │
│                                                                    무효화     │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json 업데이트│─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ 변경     │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │만료    │  │
│  관리자가            서비스 역할          KB Auto-Sync          └────────┘  │
│  파일 권한 변경      Lambda가 ACL        (EventBridge           5분 TTL     │
│                     재검색              Scheduler)             자동         │
│                                         또는 수동 트리거       무효화       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 단계별 상세

### 단계 ①: ACL 변경 (FSx for ONTAP)

| 작업 | 반영 시점 | 비고 |
|------|-----------|------|
| 파일 ACL 변경 | 즉시 (FSx 상) | NTFS ACL은 FSx 볼륨에 즉시 반영 |
| 그룹 멤버십 변경 | AD 전파 후 (일반적으로 15분 이내) | AD 복제 지연에 의존 |
| 파일 이동 (rename/move) | 즉시 (FSx 상) | 상속된 권한이 재계산됨 |
| 상속 권한 변경 | 즉시 (FSx 상) | 상위 폴더 ACL 변경이 하위에 전파 |

### 단계 ②: 메타데이터 재생성

`.metadata.json`의 `allowed_group_sids`를 업데이트하는 방법:

| 방법 | 트리거 | 지연 | 비고 |
|------|--------|------|------|
| Transfer Family를 통한 업로드 | 파일 업로드 시 | 즉시 | `enableTransferFamily=true` 시. 업로드된 파일에 대해 메타데이터 자동 생성 |
| AD Sync Lambda | 수동 / 스케줄 | 구성에 따라 다름 | `lambda/agent-core-ad-sync/`가 NTFS ACL 재검색 |
| 수동 업데이트 | 관리자 작업 | 즉시 | S3 버킷 폴백 경로의 경우, `.metadata.json`을 직접 업데이트 |

### 단계 ③: 벡터 스토어 업데이트 (KB 재동기화)

| 방법 | 트리거 | 지연 | 비고 |
|------|--------|------|------|
| KB Auto-Sync | EventBridge Scheduler (폴링) | 구성된 간격 (기본값: 15분) | `enableKbAutoSync=true` 시. 파일 변경 감지 시에만 StartIngestionJob 실행 |
| 수동 KB 동기화 | AWS 콘솔 / CLI | 즉시 시작, 수 분 내 완료 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 이벤트 | S3 PutObject | 수 분 | Transfer Family 경로에서 `enableCloudTrailIngestion=true` 시 |

**예상 KB 동기화 소요 시간:**

| 문서 수 | 동기화 시간 (예상) |
|---------|-------------------|
| ~100 | 1~3분 |
| ~1,000 | 5~15분 |
| ~10,000 | 30~60분 |
| ~100,000 | 수 시간 (증분 동기화 권장) |

### 단계 ④: 권한 캐시 무효화

| 캐시 | TTL | 무효화 방법 | 비고 |
|------|-----|-------------|------|
| DynamoDB `perm-cache` | 5분 | 자동 TTL 만료 | 필터링 결과 캐시 |
| DynamoDB `user-access` | 없음 (영구) | 명시적 업데이트 필요 | 사용자 SID / 그룹 SID |
| 브라우저 세션 | 세션 중 | 로그아웃 / 세션 만료 | 프론트엔드 메모리 캐시 |

---

## 최대 권한 전파 지연

### 정상 운영

```
ACL 변경 → 메타데이터 재생성 → KB 재동기화 → 캐시 만료
  0분        0~15분              1~15분        0~5분
                                              
최대 지연: ~35분 (15분 폴링 + 15분 KB 동기화 + 5분 캐시)
```

### RPO 스타일 표현

| 시나리오 | 최대 지연 | 설명 |
|----------|-----------|------|
| 정상 운영 (KB Auto-Sync 15분 간격) | 최대 35분 | 폴링 간격 + KB 동기화 + 캐시 TTL |
| 고빈도 동기화 (KB Auto-Sync 5분 간격) | 최대 15분 | 폴링 간격 단축 |
| 수동 즉시 동기화 | 최대 10분 | 수동 KB 동기화 + 캐시 TTL |
| 긴급 권한 취소 | 최대 5분 | 강제 캐시 삭제 + Fail-Closed |

---

## 긴급 권한 취소 절차

사용자의 접근 권한을 즉시 취소해야 하는 경우:

### 단계 1: DynamoDB에서 사용자 SID 삭제 (즉시 효과)

```bash
# 사용자의 SID 데이터 삭제 → Fail-Closed가 모든 문서 거부
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 단계 2: 권한 캐시 강제 삭제

```bash
# 대상 사용자의 캐시 항목 삭제
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

### 단계 3: Cognito 사용자 비활성화 (세션 무효화)

```bash
# Cognito 사용자 비활성화
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 효과

- 단계 1 이후: 새로운 검색 요청은 즉시 모든 문서를 거부 (Fail-Closed)
- 단계 2 이후: 캐시된 이전 권한 정보 사용 방지
- 단계 3 이후: 사용자의 세션 자체를 무효화

---

## 권한 변경 시나리오별 동작

### 시나리오 1: 파일 ACL 변경

```
관리자가 파일 A의 ACL에서 사용자 X를 제거
  → .metadata.json의 allowed_group_sids에서 사용자 X의 SID 제거
  → KB 재동기화로 벡터 스토어 메타데이터 업데이트
  → 사용자 X의 다음 검색 결과에서 파일 A 제외
```

**지연**: 최대 35분 (정상 운영)

### 시나리오 2: AD 그룹 멤버십 변경

```
관리자가 Engineering 그룹에서 사용자 X를 제거
  → AD 복제 (~15분)
  → DynamoDB user-access의 groupSIDs 업데이트 (AD Sync Lambda 실행 시)
  → Engineering 그룹 제한 문서가 사용자 X의 다음 검색에서 제외
```

**지연**: AD 복제 + AD Sync Lambda 실행 간격 + 캐시 TTL

### 시나리오 3: 파일 이동 (rename / move)

```
관리자가 파일 A를 /public/에서 /confidential/로 이동
  → FSx에서 상속 권한 재계산
  → .metadata.json 재생성 필요
  → KB 재동기화로 벡터 스토어 메타데이터 업데이트
```

**참고**: 파일 이동 시 자동 `.metadata.json` 재생성이 발생하지 않을 수 있습니다. KB Auto-Sync 폴링이 파일 경로 변경을 감지하여 메타데이터 재생성을 트리거하는 설계를 권장합니다.

### 시나리오 4: 상속 권한 변경

```
관리자가 /confidential/ 폴더의 ACL을 변경 (상속 활성화)
  → 하위 모든 파일의 유효 권한 변경
  → 각 파일에 대해 .metadata.json 재생성 필요
  → KB 재동기화
```

**참고**: 대량 파일의 일괄 권한 변경은 KB 동기화에 시간이 소요됩니다. 점진적 변경을 권장합니다.

---

## 일관성 보장 수준

| 수준 | 보장 | 구현 |
|------|------|------|
| **Fail-Closed** | SID 정보를 검색할 수 없는 경우 모두 거부 | DynamoDB 오류 / 레코드 없음 시 |
| **Eventually Consistent** | ACL 변경이 최종적으로 검색 결과에 반영 | KB Auto-Sync + 캐시 TTL |
| **No False Positive** | 권한이 없는 문서는 절대 표시되지 않음 | SID 매칭 (집합 교집합) |
| **Metadata Required** | 메타데이터가 없는 문서는 제외 | `.metadata.json` 필수 |

### 참고: False Negative 가능성

다음의 경우 접근 가능한 문서가 일시적으로 표시되지 않을 수 있습니다 (False Negative):

- 권한 부여 직후 (메타데이터 미업데이트)
- KB 동기화 중 (이전 메타데이터 유지)
- AD 복제 지연 중

**설계 원칙**: 보안을 위해 False Negative(접근 가능한 항목이 보이지 않음)는 허용하되, False Positive(제한된 항목이 보임)는 제로를 목표로 합니다.

---

## 권장 모니터링 & 알림 구성

```yaml
# 권장 CloudWatch Alarm 설정
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 높은 캐시 미스율 = 높은 권한 데이터 업데이트 빈도
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 3회 연속 실패 시 알림
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 해석 실패 시 즉시 알림
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed가 빈번하게 트리거되면 조사
```

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 아키텍처 상세 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 프로덕션 준비 체크리스트 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 사이징 및 성능 |
