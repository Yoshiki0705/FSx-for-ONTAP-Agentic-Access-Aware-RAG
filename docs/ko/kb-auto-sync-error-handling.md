# KB Auto-Sync 오류 처리 설계

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | **한국어** | [简体中文](../zh-CN/kb-auto-sync-error-handling.md) | [繁體中文](../zh-TW/kb-auto-sync-error-handling.md) | [Français](../fr/kb-auto-sync-error-handling.md) | [Deutsch](../de/kb-auto-sync-error-handling.md) | [Español](../es/kb-auto-sync-error-handling.md)

## 개요

이 문서는 KB Auto-Sync(`enableKbAutoSync=true`)의 오류 발생 시 흐름, 재시도 전략, 알림, 수동 복구 절차를 정의합니다.

## 오류 감지 메커니즘

### CloudWatch Alarm(자동 감지)

```
EventBridge Scheduler(5분 간격)
  → Lambda 실행
    → 성공: 메트릭 정상
    → 실패: Lambda Errors 메트릭 +1
      → 3회 연속 오류: CloudWatch Alarm 발생
        → SNS 알림(enableMonitoring=true인 경우)
```

**알람 설정:**
- 이름: `${prefix}-kb-auto-sync-errors`
- 임계값: 오류 1건 × 연속 3주기
- 주기: 폴링 간격과 동일(기본 5분)
- 누락 데이터: NOT_BREACHING(Lambda가 실행되지 않는 동안에는 알람 없음)

### EMF 메트릭(상세 모니터링)

KB Auto-Sync Lambda는 다음 사용자 지정 메트릭을 내보냅니다:

| 메트릭 | Namespace | 의미 |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | 스캔한 파일 수 |
| `FilesChanged` | `KbAutoSync` | 변경으로 감지된 파일 수 |
| `IngestionJobTriggered` | `KbAutoSync` | 시작된 인제스션 작업 수 |
| `IngestionJobFailed` | `KbAutoSync` | 실패한 인제스션 작업 수 |
| `InventoryDiffErrors` | `KbAutoSync` | 인벤토리 차분 계산 오류 수 |

## 오류 패턴과 대응

### 패턴 1: S3 Access Point ListObjectsV2 오류

**원인**: FSx for ONTAP S3 AP 연결 실패, IAM 권한 부족, 또는 삭제된 Access Point

**동작**:
- Lambda가 오류를 로그에 남기고 예외를 발생시킵니다
- 3회 연속 실패 후 CloudWatch Alarm이 발생합니다
- DynamoDB 인벤토리는 변경되지 않아 원자성이 유지됩니다

**수동 복구**:
```bash
# 1. S3 Access Point 존재 확인
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Lambda 환경 변수의 Access Point ARN 확인
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. 수동 호출로 테스트
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### 패턴 2: Bedrock KB 인제스션 작업 실패

**원인**: KB 데이터 소스 설정 오류, S3 Access Point 권한 오류, 또는 청킹/파싱 오류

**동작**:
- Lambda가 `StartIngestionJob` 후 `GetIngestionJob`으로 상태를 추적합니다
- 상태가 `FAILED`인 경우:
  - DynamoDB 인벤토리에서 해당 파일을 `status: "failed"`로 변경합니다
  - 다음 폴링에서 재인제스션하지 않아 무한 재시도를 방지합니다
  - `IngestionJobFailed` 메트릭을 내보냅니다
- 상태가 `IN_PROGRESS`인 경우:
  - 중복 작업을 시작하지 않습니다(IN_PROGRESS가 상호 배제 역할)

**수동 복구**:
```bash
# 1. 실패한 작업 확인
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. 인벤토리에서 실패한 파일 찾기
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. 다시 인제스션할 수 있도록 인벤토리 항목 초기화
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. 인제스션 수동 실행
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### 패턴 3: DynamoDB 인벤토리 테이블 오류

**원인**: DynamoDB 용량 초과, 권한 오류, 또는 테이블 삭제

**동작**:
- Lambda가 예외를 발생시키고 즉시 종료합니다
- 페일세이프: 인벤토리를 갱신하지 않으므로 다음 폴링에서 전체를 다시 스캔합니다
- 3회 연속 실패 후 CloudWatch Alarm이 발생합니다

**수동 복구**:
```bash
# 인벤토리 테이블 존재 확인
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# 테이블이 없으면 CDK로 재배포
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### 패턴 4: Lambda 타임아웃(5분 초과)

**원인**: 대량 파일 스캔(>10,000개) 또는 ListObjectsV2의 높은 지연

**동작**:
- Lambda가 5분에 타임아웃되고 Errors 메트릭이 증가합니다
- 부분적으로 스캔된 파일은 인벤토리에 기록되지 않아 원자성이 유지됩니다

**대책**:
- `kbAutoSyncIntervalMinutes`를 더 길게 설정합니다(예: 15분)
- 파일 수가 매우 많으면 S3 Access Point를 프리픽스로 분할하는 방안을 검토합니다

## 재시도 전략

| 오류 패턴 | 자동 재시도 | 재시도 간격 | 최대 횟수 |
|---|---|---|---|
| S3 Access Point 연결 오류 | ✅ (다음 폴링) | 폴링 간격(5분) | 무제한(알람으로 감지) |
| KB 인제스션 실패 | ❌ (수동 초기화 필요) | — | — |
| DynamoDB 오류 | ✅ (다음 폴링) | 폴링 간격(5분) | 무제한(알람으로 감지) |
| Lambda 타임아웃 | ✅ (다음 폴링) | 폴링 간격(5분) | 무제한(알람으로 감지) |

**설계 판단**: Dead Letter Queue는 사용하지 않습니다. EventBridge Scheduler 기반의 주기적 폴링에서는 실패한 실행이 다음 폴링에서 자동으로 재시도되므로 DLQ가 필요하지 않습니다. 예외는 KB 인제스션 작업 실패로, 데이터 품질 문제일 가능성이 있어 사람이 확인해야 하므로 자동 재시도하지 **않습니다**.

## 인제스션 실패 시의 Fail-Closed 동작

KB Auto-Sync의 오류는 RAG 파이프라인의 권한 경계를 약화시키지 않습니다:

1. **인벤토리가 갱신되지 않으면 기존 인덱스가 그대로 유지됩니다.** 새 파일이 검색 대상이 되지 않을 뿐이며, 기존 파일의 권한 제어는 영향을 받지 않습니다.
2. **실패한 파일은 `status: "failed"`로 표시됩니다.** 자동으로 재인제스션하지 않으며, 사람이 확인한 뒤 항목을 초기화합니다.
3. **IN_PROGRESS 작업은 상호 배제됩니다.** 이중 인제스션으로 인한 데이터 불일치를 방지합니다.
4. **권한 메타데이터(`.metadata.json`)가 없는 파일**은 KB에 들어가더라도 검색 시 Fail-closed 필터에서 제외됩니다. Fail-closed 원칙은 항상 적용됩니다.

## 모니터링 대시보드

`enableMonitoring=true`인 경우 CloudWatch 대시보드에 다음 위젯이 추가됩니다:

- **KB Auto-Sync Errors**: Lambda Errors 메트릭(5분 주기)
- **Ingestion Job Status**: 성공/실패/진행 중 작업 수
- **Files Changed**: 폴링당 변경 감지된 파일 수
- **Scan Duration**: Lambda 실행 시간(P50/P90/P99)

## 관련 문서

- [권한 메타데이터 정합성 모델](permission-consistency.md) — 권한 갱신과 KB 인덱스 갱신의 관계, 그리고 ACL 변경이 자동으로 반영되지 않는 이유
- [CloudWatch 대시보드 가이드](cloudwatch-dashboard-guide.md) — 모니터링 메트릭 읽는 방법
- [프로덕션 준비 체크리스트](production-readiness-checklist.md) — KB Auto-Sync를 프로덕션에서 운영하기 위한 요건
