# 2026 Q2 AI Update ハンズオンガイド

**🌐 Language:** **日本語** | [English](en/2026q2-update-hands-on-guide.md)

**作成日**: 2026-06-07  
**所要時間**: 約60分  
**対象**: 新機能を体験したい開発者・パートナー

---

## 概要

2026 Q2 AI Update（Phase 0-5）で追加された新機能を体験するハンズオンガイド。既存のデプロイ環境に対して、新機能を段階的に有効化して動作確認します。

---

## 前提条件

- 既にデプロイ済みの Permission-aware RAG 環境
- AWS CLI 設定済み
- Node.js 22+, npm

---

## Step 1: モデル更新確認（5分）

Phase 0 で更新されたモデルIDの動作を確認します。

```bash
# 現在のモデル設定確認
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# 期待値:
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

チャットUIでクエリを送信し、レスポンスメタデータの `modelId` が新モデルになっていることを確認。

---

## Step 2: Prompt Caching 効果確認（10分）

> **前提条件**: Prompt Caching は **Anthropic Claude モデルのみ** 対応です。デフォルト構成（モデル未選択 → Nova 2 Lite fallback）ではキャッシュが効きません。以下の手順の前に、サイドバーの「AIモデル選択」で **Claude Sonnet 4.6** または **Claude Opus 4.8** を選択してください。

同一セッション内で連続クエリを送信し、キャッシュヒットを確認します。

```bash
# 1. チャットUIで質問を送信
# 2. 5分以内に2回目の質問を送信
# 3. CloudWatch Logs で確認:
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# 期待されるログ:
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

CloudWatch メトリクスで確認:
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

## Step 3: Automated Reasoning Guardrails（15分）

Permission違反を意図的に誘発し、Automated Reasoningがブロックすることを確認します。

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

## Step 4: AgentCore Gateway + Permission Interceptor（15分）

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

## Step 5: Citations + Permission Boundary 確認（10分）

チャットUIでクエリを送信し、レスポンスのCitationsを確認します。

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

## Step 6: Graph RAG（オプション、5分）

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

## クリーンアップ

新機能を無効化してコストを節約:

```bash
# Graph RAG無効化（Neptune Analytics停止）
npx cdk deploy ${PREFIX}-AI -c enableGraphRAG=false

# Gateway無効化
npx cdk deploy ${PREFIX}-AI -c enableAgentCoreGateway=false

# Guardrails無効化
npx cdk deploy ${PREFIX}-AI -c enableGuardrails=false
```

---

## 関連ドキュメント

- [2026 Q2 AI Update Roadmap](design/2026q2-ai-update-roadmap.md)
- [チャンキング戦略選定ガイド](chunking-strategy-guide.md)
- [コスト見積もりワークシート](cost-estimation-worksheet.md)
- [本番化チェックリスト](production-readiness-checklist.md)
