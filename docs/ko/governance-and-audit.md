# 거버넌스 및 감사 설계

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | **한국어** | [简体中文](../zh-CN/governance-and-audit.md) | [繁體中文](../zh-TW/governance-and-audit.md) | [Français](../fr/governance-and-audit.md) | [Deutsch](../de/governance-and-audit.md) | [Español](../es/governance-and-audit.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 보안 담당자, 컴플라이언스 담당자, 공공/의료/금융 부문

---

## 개요

이 문서는 Permission-aware RAG 시스템의 감사 로그 설계, 거버넌스 프레임워크, Responsible AI 구현 가이드라인을 정리합니다. "누가, 언제, 어떤 문서를 기반으로, 어떤 답변을 받았는지"를 설명할 수 있도록 하는 것이 목표입니다.

---

## 감사 로그 스키마

### RAG 검색 감사 로그

모든 RAG 검색 요청에 대해 다음 정보가 기록됩니다.

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent 모드 감사 로그

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### 권한 변경 감사 로그

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## 로그 저장 & 보호 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                        감사 로그 흐름                               │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (감사 로그 버킷)      │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ 보존: 1년    │    │ ・KMS 암호화            │ │
│                  └──────────────┘    │ ・수명 주기:            │ │
│                                      │   90일→IA, 365일→Glacier │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API 호출 │    │ (데이터 이벤트)│                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ 권한     │    │ Streams      │───▶ 권한 변경 감사 로그          │
│  │ 변경     │    └──────────────┘                                │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 권장 구성

| 컴포넌트 | 설정 | 목적 |
|----------|------|------|
| CloudWatch Logs | 보존: 1년 | 운영 로그, 디버깅 |
| S3 감사 로그 버킷 | Object Lock (Governance Mode) | 변조 방지 |
| KMS CMK | 자동 로테이션 활성화 | 암호화 |
| CloudTrail | 관리 + 데이터 이벤트 | API 호출 추적 |
| S3 수명 주기 | 90일 → IA, 365일 → Glacier | 비용 최적화 |
| Athena | 파티션된 테이블 | 로그 분석 및 검색 |

---

## Responsible AI / Guardrails 설계

### Bedrock Guardrails 활용

`enableGuardrails=true`로 활성화되는 Guardrails 구성:

| 정책 | 목적 | 구성 예시 |
|------|------|-----------|
| 콘텐츠 필터 | 유해 콘텐츠 감지 및 차단 | HATE: HIGH, VIOLENCE: HIGH |
| 주제 정책 | 금지 주제 정의 | 경쟁사 정보, 투자 조언 |
| PII 감지 | 개인정보 감지 및 마스킹 | 이름, 전화번호, 이메일 주소 |
| 단어 필터 | 금지 문구 차단 | 내부 코드명, 미공개 정보 |

### Guardrails 샘플 정책

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### 데이터 분류별 제어

| 데이터 분류 | 검색 | 요약 | 인용 | Agent 사용 |
|------------|------|------|------|-----------|
| 공개 | ✅ 허용 | ✅ 허용 | ✅ 허용 | ✅ 허용 |
| 내부 | ✅ 허용 | ✅ 허용 | ⚠️ 요약만 | ✅ 허용 |
| 기밀 | ✅ 허용 (권한자만) | ⚠️ 제한 | ❌ 원문 인용 불가 | ⚠️ 승인 필요 |
| 극비 | ⚠️ 승인 필요 | ❌ 금지 | ❌ 금지 | ❌ 금지 |

### Agent 모드의 인간 승인

Agent가 외부 작업을 실행하기 전에 인간 승인을 요청하는 설계:

```
Agent가 "이메일 전송" 도구 호출 시도
  → AgentCore Policy가 "외부 커뮤니케이션" 카테고리 감지
  → 인간 승인 요청 생성
  → UI에서 사용자에게 승인/거부 프롬프트 표시
  → 승인 후에만 작업 실행
```

---

## 산업별 사용 사례 및 규정 준수

### 의료

| 요구사항 | 구현 |
|----------|------|
| 환자 정보 격리 | 부서별 SID 그룹 + PII 마스킹 |
| 부서별 절차 검색 | 부서 SID로 필터링 |
| 감사 추적 | 모든 검색 로그 5년 보존 |
| 동의 관리 | 메타데이터에 환자 동의 플래그 포함 |
| 의료 진단 금지 | Guardrails 주제 정책으로 DENY |

**규정 준수**: 의료정보시스템 안전관리 가이드라인 (후생노동성)

### 정부 / 공공 부문

| 요구사항 | 구현 |
|----------|------|
| 부서별 문서 격리 | 부서 SID 그룹 |
| 정책과 비공개 자료 분리 | `access_level` 메타데이터 + SID |
| 정보공개 요청 지원 | 검색 로그 보존 및 내보내기 기능 |
| 개인정보 보호 | PII 감지 + 마스킹 |
| 행정 문서 관리 | 문서 분류 메타데이터 부여 |

**규정 준수**: 개인정보보호법, ISMAP

### 금융 기관

| 요구사항 | 구현 |
|----------|------|
| 엄격한 고객 정보 격리 | 고객 ID 기반 접근 제어 |
| 투자 조언 금지 | Guardrails 주제 정책 |
| 거래 기록 보존 | 10년 감사 로그 보존 |
| 내부 통제 | 운영 로그 정기 검토 |
| 암호화 요구사항 | KMS CMK + TLS 1.2 |

**규정 준수**: FISC 안전대책기준, 금융상품거래법

### 교육 기관

| 요구사항 | 구현 |
|----------|------|
| 교직원/학생 권한 분리 | 역할 기반 SID 그룹 |
| 연구실별 자료 격리 | 연구실 SID 그룹 |
| 학생 개인정보 보호 | PII 마스킹 |
| 연구 데이터 기밀성 | 연구 프로젝트별 접근 제어 |

---

## 감사 보고서 생성

### 정기 보고서 항목

| 보고서 | 빈도 | 내용 |
|--------|------|------|
| 접근 요약 | 일간 | 사용자별 검색 수, 거부 수 |
| 권한 위반 보고서 | 일간 | Fail-Closed 트리거, 이상 접근 패턴 |
| Guardrails 개입 보고서 | 주간 | 필터 트리거 수, 주제별 통계 |
| 비용 & 사용량 보고서 | 월간 | 토큰 소비량, API 호출 수, 스토리지 사용량 |
| 컴플라이언스 보고서 | 분기 | 규정 요구사항 적합 상태, 개선 항목 |

### Athena 쿼리 예시

```sql
-- 최근 7일간 권한 거부 이벤트
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- 사용자별 검색 패턴 분석
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## 개인정보 및 민감 정보 처리

### 마스킹 / 분류 흐름

```
문서 수집
  → PII 스캔 (Comprehend / Guardrails)
  → 분류 라벨 부여 (기밀 수준 + PII 유무)
  → .metadata.json에 분류 정보 기록
  → KB 동기화
  
검색 시
  → SID 필터링 (접근 권한)
  → Guardrails PII 감지 (출력 마스킹)
  → 답변 생성 (마스킹됨)
```

### 승인 흐름 (기밀 데이터 접근)

극비 데이터 접근이 필요한 경우의 승인 흐름:

1. 사용자가 검색 요청 제출
2. SID 매칭으로 "승인 필요" 카테고리 식별
3. 관리자에게 승인 요청 알림 전송 (SNS / Slack)
4. 관리자 승인 → 임시 접근 토큰 발급
5. 토큰 유효 기간 동안만 접근 가능
6. 접근 로그를 감사 테이블에 기록

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 프로덕션 준비 체크리스트 |
| [permission-consistency.md](permission-consistency.md) | 권한 변경 일관성 모델 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 아키텍처 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 안전한 실험 가이드 |
