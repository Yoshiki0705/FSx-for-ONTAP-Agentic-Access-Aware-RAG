# 2026 Q2 AI Update Hands-On Guide

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | **English**

**Created**: 2026-06-07  
**Duration**: ~60 minutes  
**Audience**: Developers and partners who want to try new features

---

## Overview

A hands-on guide to the features added in the 2026 Q2 AI update (phases 0-5). You enable them one at a time on an existing deployment and confirm each works.

---

## Prerequisites

- An already-deployed Permission-aware RAG environment
- AWS CLI configured
- Node.js 22+, npm

---

## Step 1: confirm the model update (5 min)

Check that the model IDs updated in phase 0 behave as expected.

```bash
# Current model configuration
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# Expected:
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

Send a query from the chat UI and confirm that `modelId` in the response metadata names the new model.

---

## Step 2: confirm the effect of prompt caching (10 min)

> **Prerequisite**: prompt caching works with **Anthropic Claude models only**. In the default configuration (no model selected, falling back to Nova 2 Lite) nothing is cached. Before the steps below, pick **Claude Sonnet 4.6** or **Claude Opus 4.8** under model selection in the sidebar.

Send consecutive queries within one session and confirm a cache hit.

```bash
# 1. Ask a question in the chat UI
# 2. Ask a second question within 5 minutes
# 3. Check CloudWatch Logs:
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# Expected log line:
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

Check the CloudWatch metric:
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

## Step 3: Automated Reasoning Guardrails (15 min)

Deliberately provoke a permission violation and confirm that Automated Reasoning blocks it.

```bash
# 1. Guardrails有効でデプロイ
npx cdk deploy ${PREFIX}-AI \
  -c enableGuardrails=true \
  -c 'guardrailsConfig={"enableAutomatedReasoning":true,"contextualGrounding":true}'

# 2. チャットUIで Permission 境界外のクエリを試行
#    例: 管理者専用文書について一般ユーザーで質問
#    → 「この回答はセキュリティポリシーにより制限されました」が返ることを確認

# 3. Guardrail介入ログ確認
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailResult"' \
  --region ap-northeast-1
```

---

## Step 4: AgentCore Gateway and the Permission Interceptor (15 min)

```bash
# 1. Gateway有効でデプロイ
npx cdk deploy ${PREFIX}-AI -c enableAgentCoreGateway=true

# 2. Stack出力からGateway URLを取得
aws cloudformation describe-stacks \
  --stack-name ${PREFIX}-AI \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`GatewayUrl`)].OutputValue' \
  --output text

# 3. Interceptor Lambdaのログ確認
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-gateway-interceptor" \
  --filter-pattern '"permission_decision"' \
  --region ap-northeast-1

# 期待されるログ:
# {"event":"permission_decision","toolName":"list_volumes","decision":"ALLOW",...}
# {"event":"permission_decision","toolName":"expand_volume","decision":"DENY",...}
```

---

## Step 5: citations and the permission boundary (10 min)

Send a query from the chat UI and inspect the citations in the response.

```bash
# API レスポンスの citations フィールドを確認
curl -s ${CLOUDFRONT_URL}/api/bedrock/kb/retrieve \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"query":"売上レポートについて教えて","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | jq '.citations[] | {index, fileName, boundaryType, permissionVerified}'

# 期待値:
# { "index": 1, "fileName": "quarterly-report.pdf", "boundaryType": "verified", "permissionVerified": true }
```

---

## Step 6: Graph RAG (optional, 5 min)

```bash
# 1. Graph RAG有効でデプロイ（Neptune Analytics起動に~10分）
npx cdk deploy ${PREFIX}-AI -c enableGraphRAG=true

# 2. Neptune Analytics エンドポイント確認
aws cloudformation describe-stacks \
  --stack-name ${PREFIX}-AI \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`GraphEndpoint`)].OutputValue' \
  --output text

# 3. グラフへのテストクエリ（Lambda経由）
# ドキュメント関連性グラフの構築は別途スクリプト実行が必要
```

---

## Cleanup

Disable the new features to save cost:

```bash
# Graph RAG無効化（Neptune Analytics停止）
npx cdk deploy ${PREFIX}-AI -c enableGraphRAG=false

# Gateway無効化
npx cdk deploy ${PREFIX}-AI -c enableAgentCoreGateway=false

# Guardrails無効化
npx cdk deploy ${PREFIX}-AI -c enableGuardrails=false
```

---

## Related Documents

- [2026 Q2 AI Update Roadmap](design/2026q2-ai-update-roadmap.md)
- [チャンキング戦略選定ガイド](chunking-strategy-guide.md)
- [コスト見積もりワークシート](cost-estimation-worksheet.md)
- [本番化チェックリスト](production-readiness-checklist.md)
