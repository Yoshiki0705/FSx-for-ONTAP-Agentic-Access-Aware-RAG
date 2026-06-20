# 2026 Q2 AI 업데이트 구현 로드맵

## Overview

2026年3月〜6月のAWS AIアップデートを本プロジェクト（Permission-aware RAG with FSx for ONTAP）に統合するための実装ロードマップ。全7 Specを段階的に実装し、Permission境界の一貫性を維持しながら新機能を導入する。

## Core Invariant: Permission Boundary Classification

全Specを貫く不変条件として、以下の **Permission Boundary Type** を定義する。すべてのデータソースはこの分類に従い、UI・ログ・監査で一貫して使用する。

| Type | Source | Permission保証 | Trust Level | UI表示 |
|------|--------|---------------|-------------|--------|
| `verified` | KB (FSx for ONTAP, SID-matched) | Fail-closed + SIDマッチング完了 | HIGH | 🔒 社内文書 |
| `reference` | Web Search (Claude Platform) | 不適用（公開情報） | LOW | 🌐 参考情報（外部） |
| `expanded` | Graph RAG expansion (Neptune) | Real-time SIDチェック済み（遅延あり） | MEDIUM | 🔗 関連ドキュメント |
| `memory` | Agent Memory (AgentCore) | SIDスコープタグ付き | MEDIUM | 表示しない（内部利用） |

## Implementation Phases

### Phase 0: Foundation (Week 1-2)

**Spec: model-lifecycle-2026q2**

| Task | 内容 | リスク |
|------|------|--------|
| モデルID確認 & 更新 | Opus 4.8, Sonnet 4.6, Nova 2 Lite, GPT-5.5 GA | LOW |
| RAGAS品質ゲート | Permission-matrix 31シナリオ + RAGAS回帰テスト | LOW |
| CI/CD品質ゲート設定 | model-defaults.ts変更時の自動評価 | LOW |

**完了条件**: 全テストパス + RAGAS baseline確立

---

### Phase 1: Core Hardening (Week 3-5)

**Spec: cost-optimization-bedrock** (Prompt Caching部分のみ)

| Task | 内容 | リスク |
|------|------|--------|
| Prompt構造分離 | Static/Dynamic segment分割 | LOW |
| Cache invalidation | Permission rule version hash | LOW |
| コストメトリクス | CacheHit/Miss率可視化 | LOW |

**Expected Impact**: トークンコスト30-90%削減

**Spec: guardrails-automated-reasoning**

| Task | 内容 | リスク |
|------|------|--------|
| Automated Reasoningポリシー定義 | Fail-closed + SID matching形式検証 | MEDIUM |
| コンテキスト依存Guardrails | 権限レベル別プロファイル | MEDIUM |
| Adversarial test set | 意図的Permission違反テスト | LOW |

**完了条件**: Guardrail有効時にPermission違反を検知・ブロック

---

### Phase 2: Platform Foundation (Week 6-9)

**Spec: agentcore-gateway-modernization**

| Task | 内容 | リスク |
|------|------|--------|
| Gateway構築 | CDK construct + IAM認証 | MEDIUM |
| Permission Interceptor | Lambda + DynamoDB Permission check | MEDIUM |
| MCP Server登録 | FSx for ONTAP/KB/Capacity各ツール | LOW |
| Observability | 構造化ログ + X-Ray | LOW |

**完了条件**: 全エージェントツール通信がGateway経由 + Permission Interceptor通過

---

### Phase 3: Intelligence Expansion (Week 10-14)

**Spec: claude-platform-integration**

| Task | 内容 | リスク |
|------|------|--------|
| Web Search統合 | Claude Platform API接続 + サニタイザー | MEDIUM |
| Permission Boundary分類 | verified/reference分離表示 | LOW |
| Citations | ソース帰属 + boundary type表示 | LOW |
| MCP Connector | Gateway経由FSxNツール公開 | LOW |

**Spec: agent-framework-evolution** (MVP)

| Task | 内容 | リスク |
|------|------|--------|
| Strands SDK基盤 | 1エージェント（FSx for ONTAP Agent）のみ移行 | MEDIUM |
| Memory Permission tagging | SIDスコープ付きメモリ | HIGH |
| Tool decorator | @permission_required 強制 | LOW |

**完了条件**: FSx for ONTAP AgentがStrands SDKで動作 + Memory安全性確認

---

### Phase 4: Advanced Capabilities (Week 15-20)

**Spec: knowledge-base-multimodal** (Multimodal部分のみ)

| Task | 内容 | リスク |
|------|------|--------|
| Multimodal KB構成 | PDF画像/図表のvector化 | MEDIUM |
| Permission inheritance | 親ドキュメントからの権限継承 | LOW |
| UI統合 | 画像サムネイル + 統合ランキング | LOW |

**Spec: agent-framework-evolution** (Full)

| Task | 内容 | リスク |
|------|------|--------|
| RAG Agent Strands移行 | search_kb + citations ツール化 | MEDIUM |
| Supervisor Agent | Multi-Agent orchestration | HIGH |
| Claude Managed Agent | Simple query handler | LOW |

---

### Phase 5: Graph & Full Integration (Week 21+)

**Spec: knowledge-base-multimodal** (GraphRAG部分)

| Task | 内容 | リスク |
|------|------|--------|
| Neptune Analytics構築 | CDK + VPC統合 | HIGH |
| Graph構築Lambda | Entity extraction + relationship detection | MEDIUM |
| Real-time SID check | Graph展開結果のPermission検証 | HIGH |
| Permission Graph | User→Group→Document可視化 | MEDIUM |

**Spec: cost-optimization-bedrock** (Distillation + Batch)

| Task | 内容 | リスク |
|------|------|--------|
| Model Distillation pipeline | Training data + evaluation | MEDIUM |
| Batch Inference | KB Auto-Sync metadata enrichment | LOW |

---

## Risk Register

### Risk 1: Web Search → Permission Boundary Confusion
- **Impact**: ユーザーがWeb検索結果を「社内検証済み情報」と誤認
- **Likelihood**: HIGH (UIが不明瞭な場合)
- **Severity**: HIGH
- **Mitigation**: Permission Boundary Classification + UI badge + Guardrail検証
- **Owner**: Frontend team
- **Phase**: Phase 3

### Risk 2: Memory Cross-Scope Leakage
- **Impact**: 高権限ユーザーのデータが低権限ユーザーに漏洩
- **Likelihood**: MEDIUM (実装ミスの場合)
- **Severity**: CRITICAL
- **Mitigation**: Memory Permission tagging + SIDスコープフィルタ + 監査ログ
- **Owner**: Agent team
- **Phase**: Phase 3

### Risk 3: Graph Expansion Stale Permission
- **Impact**: 権限削除後5分以内にグラフ展開で旧権限文書が表示される
- **Likelihood**: MEDIUM
- **Severity**: MEDIUM
- **Mitigation**: Real-time SID check + expanded boundary type表示
- **Owner**: Backend team
- **Phase**: Phase 5

### Risk 4: Model Update Quality Regression
- **Impact**: 新モデルがPermission判定を誤り機密情報漏洩
- **Likelihood**: LOW (品質ゲートあり)
- **Severity**: CRITICAL
- **Mitigation**: RAGAS + Permission-matrix CI gate + ベースライン比較
- **Owner**: ML team
- **Phase**: Phase 0

---

## Cost Tier Architecture

| Tier | 追加機能 | 月額増分(見込) | 対象 |
|------|---------|--------------|------|
| Essential | Model Update + Prompt Caching + Guardrails AR | ~$50-100 | 全環境 |
| Professional | + Gateway + Citations + Web Search + Registry | ~$200-400 | Standard環境 |
| Enterprise | + Strands Multi-Agent + Multimodal + GraphRAG + Distillation + Memory | ~$800-1500 | Enterprise環境 |

---

## Quality Gates (All Phases)

- [ ] Permission-matrix 31シナリオ全通過
- [ ] RAGAS evaluation baseline維持
- [ ] `npx tsc --noEmit` → `npx cdk synth --quiet` → `npx jest --no-coverage` → `npx vitest run`
- [ ] CDK synth: 全feature flag組み合わせ成功
- [ ] Security: IAM最小権限、Fail-closed原則維持
- [ ] Observability: 全新機能にCloudWatchメトリクス/ログあり
