# CloudWatch 대시보드 운영 가이드

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | **한국어** | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | [Français](../fr/cloudwatch-dashboard-guide.md) | [Deutsch](../de/cloudwatch-dashboard-guide.md) | [Español](../es/cloudwatch-dashboard-guide.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 운영 팀, SRE, 플랫폼 엔지니어

---

## 개요

본 문서는 Permission-aware RAG 시스템의 운영 모니터링에 필요한 CloudWatch 대시보드와 알람의 설계·도입 가이드입니다. `enableMonitoring=true`로 CDK가 자동 생성하는 대시보드에 더해, 추가로 설정해야 할 메트릭과 알람을 정리합니다.

---

## 모니터링 메트릭 목록

### RAG 검색 성능

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | 검색~응답 생성의 전체 레이턴시 | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Bedrock API 호출 횟수 | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Bedrock API 오류 횟수 | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | KB에서 가져온 청크 수 | — |

### 권한 제어

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | SID 필터링으로 거부된 문서 수 | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | 캐시 히트율 | < 20%(이상) |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | 캐시 미스율 | > 80%(이상) |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Fail-Closed 발동 횟수 | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | SID 해결 실패 횟수 | > 0 |

### 데이터 동기화

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | KB 동기화 소요 시간 | > 30min |
| KB Sync Success | `KbAutoSync` | — | 동기화 성공 횟수 | — |
| KB Sync Failure | `KbAutoSync` | — | 동기화 실패 횟수 | 3회 연속 |
| ACL Sync Success | `PermissionAwareRAG` | — | ACL 동기화 성공 횟수 | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | ACL 동기화 실패 횟수 | > 0 |

### Guardrails

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Guardrails에 의한 차단 횟수 | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | 전체 요청 중 개입율 | > 10% |

### Agent

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | 도구 호출 횟수 | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Agent 실행 스텝 수 | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Agent 오류 횟수 | > 3/5min |

### 비용

| 메트릭 | 네임스페이스 | 디멘션 | 설명 | 알림 임계값 |
|--------|------------|--------|------|------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | 추정 토큰 비용(USD) | 일별 > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | 라우팅 대상 분포 | — |

---

## 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission-Aware RAG Operations Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Query Latency       │  │ Bedrock Invocations  │              │
│  │ (P50/P95/P99)       │  │ (by Model)           │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Permission Denied   │  │ Cache Hit/Miss Rate  │              │
│  │ Count               │  │                      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ KB Sync Status      │  │ Guardrails Blocked   │              │
│  │ (Success/Failure)   │  │ Count                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Agent Tool Calls    │  │ Estimated Cost       │              │
│  │ (by Tool)           │  │ Trend                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 알람 정의

### Critical(즉시 대응)

```yaml
- AlarmName: RAG-PermissionDenyAllFallback
  MetricName: DenyAllFallbackCount
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]

- AlarmName: RAG-SIDResolutionFailure
  MetricName: SIDResolutionFailure
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 0
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]
```

### Warning(조사 필요)

```yaml
- AlarmName: RAG-HighLatency
  MetricName: QueryLatency
  Namespace: PermissionAwareRAG
  ExtendedStatistic: p95
  Period: 300
  EvaluationPeriods: 3
  Threshold: 10000  # 10 seconds in ms
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-KBSyncConsecutiveFailure
  MetricName: KBSyncFailure
  Namespace: KbAutoSync
  Statistic: Sum
  Period: 900
  EvaluationPeriods: 3
  Threshold: 1
  ComparisonOperator: GreaterThanOrEqualToThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-HighCacheMissRate
  MetricName: PermissionCacheMissRate
  Namespace: PermissionAwareRAG
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 80
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]
```

---

## 문제 해결 패턴

### 패턴 1: Deny All Fallback 빈발

```
증상: DenyAllFallbackCount 급증
원인 후보:
  1. DynamoDB user-access 테이블 연결 장애
  2. 신규 사용자의 SID 데이터 미등록
  3. AD Sync Lambda 실패

조사 절차:
  1. CloudWatch Logs에서 Lambda 오류 확인
  2. DynamoDB 테이블의 스로틀링 확인
  3. AD Sync Lambda의 최종 실행 결과 확인
```

### 패턴 2: 레이턴시 급증

```
증상: QueryLatency P95가 10초 초과
원인 후보:
  1. Bedrock API 스로틀링
  2. S3 Vectors 콜드 스타트
  3. KB 동기화 중 부하

조사 절차:
  1. Bedrock InvocationLatency 확인
  2. S3 Vectors 쿼리 레이턴시 확인
  3. KB 동기화 작업 실행 상태 확인
```

### 패턴 3: 비용 급증

```
증상: EstimatedTokenCost가 평소의 3배 이상
원인 후보:
  1. Smart Routing이 고비용 모델에 편중
  2. Agent 모드의 과도한 이용
  3. 부정한 대량 요청

조사 절차:
  1. SmartRouting RoutingTier 분포 확인
  2. Agent StepCount 이상값 확인
  3. WAF 레이트 리밋 차단 수 확인
```

---

## 대시보드 임포트 절차

### CDK 자동 생성(권장)

```bash
# enableMonitoring=true로 자동 생성
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### 수동 임포트

```bash
# monitoring/cloudwatch-dashboard.json 사용
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [production-readiness-checklist.md](../production-readiness-checklist.md) | 프로덕션 준비 체크리스트(모니터링 설정 항목) |
| [permission-consistency.md](../permission-consistency.md) | 권한 변경 시 모니터링 권장 설정 |
| [governance-and-audit.md](../governance-and-audit.md) | 감사 로그와 보고서 생성 |
| [threat-model.md](../threat-model.md) | 위협 모델(모니터링으로 감지해야 할 위협) |
