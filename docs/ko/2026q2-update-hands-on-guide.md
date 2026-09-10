# 2026 Q2 AI 업데이트 실습 가이드

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | **한국어** | [简体中文](../zh-CN/2026q2-update-hands-on-guide.md) | [繁體中文](../zh-TW/2026q2-update-hands-on-guide.md) | [Français](../fr/2026q2-update-hands-on-guide.md) | [Deutsch](../de/2026q2-update-hands-on-guide.md) | [Español](../es/2026q2-update-hands-on-guide.md)

**작성일**: 2026-06-07  
**소요 시간**: 약 60분  
**대상**: 새 기능을 직접 확인하려는 개발자·파트너

---

## 개요

2026 Q2 AI 업데이트(Phase 0-5)로 추가된 기능을 체험하는 실습 가이드입니다. 기존 배포 환경에 기능을 하나씩 활성화하며 동작을 확인합니다.

---

## 전제 조건

- 이미 배포된 Permission-aware RAG 환경
- AWS CLI 설정 완료
- Node.js 22+, npm

---

## Step 1: 모델 업데이트 확인(5분)

Phase 0에서 갱신된 모델 ID가 기대대로 동작하는지 확인합니다.

```bash
# 현재 모델 설정 확인
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# 기대값:
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

채팅 UI에서 쿼리를 보내고, 응답 메타데이터의 `modelId`가 새 모델인지 확인합니다.

---

## Step 2: Prompt Caching 효과 확인(10분)

> **전제 조건**: Prompt Caching은 **Anthropic Claude 모델만** 지원합니다. 기본 구성(모델 미선택 → Nova 2 Lite 폴백)에서는 캐시가 동작하지 않습니다. 아래 절차 전에 사이드바의 모델 선택에서 **Claude Sonnet 4.6** 또는 **Claude Opus 4.8**을 선택하십시오.

같은 세션에서 연속으로 쿼리를 보내고 캐시 적중을 확인합니다.

```bash
# 1. 채팅 UI에서 질문 전송
# 2. 5분 이내에 두 번째 질문 전송
# 3. CloudWatch Logs에서 확인:
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# 기대되는 로그:
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

CloudWatch 메트릭으로 확인:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "RAG/TokenUsage" \
  --metric-name "CachedInputTokens" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## Step 3: Automated Reasoning Guardrails(15분)

권한 위반을 의도적으로 유발하고 Automated Reasoning이 차단하는지 확인합니다.

```bash
# 1. Guardrails를 활성화하여 배포
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. 채팅 UI에서 권한 경계를 벗어난 쿼리 시도
#    예: 관리자 전용 문서를 일반 사용자 계정으로 질문
#    → 보안 정책에 의해 제한되었다는 응답이 오는지 확인

# 3. Guardrail 개입 로그 확인
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Step 4: AgentCore Gateway + Permission Interceptor(15분)

```bash
# 1. Gateway를 활성화하여 배포
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. 스택 출력에서 Gateway URL 확인
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. Interceptor Lambda 로그 확인
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Step 5: Citations + 권한 경계 확인(10분)

채팅 UI에서 쿼리를 보내고 응답의 Citations를 확인합니다.

```bash
# API 응답의 citations 필드 확인
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"매출 보고서에 대해 알려줘","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# 기대값:
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Step 6: Graph RAG(선택, 5분)

```bash
# 1. Graph RAG를 활성화하여 배포(Neptune Analytics 기동에 약 10분)
npx cdk deploy --all -c enableGraphRAG=true

# 2. Neptune Analytics 엔드포인트 확인
aws neptune-graph list-graphs --region ap-northeast-1

# 3. 그래프에 테스트 쿼리(Lambda 경유)
# 문서 관련성 그래프 구축에는 별도 스크립트 실행이 필요
```

---

## 정리

비용 절감을 위해 새 기능을 비활성화합니다:

```bash
# Graph RAG 비활성화(Neptune Analytics 중지)
npx cdk deploy --all -c enableGraphRAG=false

# Gateway 비활성화
npx cdk deploy --all -c enableAgentCoreGateway=false

# Guardrails 비활성화
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## 관련 문서

- [청킹 전략 선정 가이드](chunking-strategy-guide.md)
- [비용 견적 워크시트](cost-estimation-worksheet.md)
- [프로덕션 준비 체크리스트](production-readiness-checklist.md)
