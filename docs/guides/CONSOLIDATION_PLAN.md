# ガイドファイル統合計画

**作成日**: 2026-01-18  
**目的**: docs/guides配下のガイドファイルをテーマごとに統合し、保守性を向上

---

## 📋 現状分析

### 現在のガイドファイル数: 46ファイル

### 統合対象グループ

#### 1. AgentCore関連（15ファイル → 3ファイルに統合）

**統合先: `agentcore-complete-guide.md`**
- agentcore-deployment-guide.md
- agentcore-operations-manual.md
- agentcore-production-deployment-plan.md
- agentcore-staging-test-plan.md
- agentcore-staging-test-execution-guide.md
- agentcore-user-guide.md
- agentcore-tutorials.md
- bedrock-agentcore-implementation-guide.md

**統合先: `agentcore-security-operations-guide.md`**
- agentcore-security-guide.md
- agentcore-security-best-practices.md
- agentcore-incident-response.md
- agentcore-vulnerability-response.md

**統合先: `agentcore-monitoring-troubleshooting-guide.md`**
- agentcore-monitoring-alert-guide.md
- agentcore-v2-troubleshooting-guide.md
- agentcore-faq.md

**削除候補**:
- agentcore-cost-estimation.md（README.mdに統合）

#### 2. デプロイメント関連（3ファイル → 1ファイルに統合）

**統合先: `deployment-complete-guide.md`**
- deployment-guide.md
- deployment-guide-unified.md
- lambda-vpc-deployment-guide.md

#### 3. フロントエンド開発関連（5ファイル → 2ファイルに統合）

**統合先: `frontend-complete-guide.md`**
- frontend-development-guide.md
- ui-ux-guide.md
- theme-implementation-guide.md
- typescript-type-safety-guide.md

**統合先: `i18n-complete-guide.md`**
- i18n-troubleshooting-guide.md（既存のi18n関連ドキュメントと統合）

#### 4. デバッグ・トラブルシューティング関連（4ファイル → 1ファイルに統合）

**統合先: `debugging-complete-guide.md`**
- debugging-troubleshooting-guide.md
- chrome-devtools-mcp-debugging-guide.md
- chrome-devtools-testing-guide.md
- agent-selection-event-troubleshooting-guide.md

#### 5. FSx統合関連（2ファイル → 1ファイルに統合）

**統合先: `fsx-integration-complete-guide.md`**
- fsx-ontap-s3-access-points-integration-guide.md
- fsx-ontap-s3-integration-guide.md

#### 6. 運用・設定関連（7ファイル → 2ファイルに統合）

**統合先: `operations-configuration-guide.md`**
- operations-maintenance-guide-en.md
- operations-maintenance-guide-ja.md
- observability-configuration-guide.md
- policy-configuration-guide.md
- evaluations-configuration-guide.md

**統合先: `user-preferences-complete-guide.md`**
- user-preferences-system-guide.md
- task3.2-preferences-deployment-guide.md
- task3.2-cdk-deployment-notes.md

#### 7. その他（保持）

**保持するファイル**:
- quick-start.md（エントリーポイントとして重要）
- faq.md（よくある質問として独立）
- bedrock-knowledge-base-guide.md（Bedrock KB専用ガイド）
- bedrock-model-adapters-guide.md（モデルアダプター専用ガイド）
- cost-allocation-tagging-guide.md（コスト管理専用ガイド）
- module-development-guide-en.md（モジュール開発ガイド英語版）
- module-development-guide-ja.md（モジュール開発ガイド日本語版）

---

## 🎯 統合後の構成（46ファイル → 18ファイル）

### コアガイド（8ファイル）
1. `agentcore-complete-guide.md` - AgentCore完全ガイド
2. `agentcore-security-operations-guide.md` - AgentCoreセキュリティ・運用ガイド
3. `agentcore-monitoring-troubleshooting-guide.md` - AgentCore監視・トラブルシューティング
4. `deployment-complete-guide.md` - デプロイメント完全ガイド
5. `frontend-complete-guide.md` - フロントエンド開発完全ガイド
6. `debugging-complete-guide.md` - デバッグ・トラブルシューティング完全ガイド
7. `fsx-integration-complete-guide.md` - FSx統合完全ガイド
8. `operations-configuration-guide.md` - 運用・設定ガイド

### 専門ガイド（10ファイル）
9. `quick-start.md` - クイックスタート
10. `faq.md` - よくある質問
11. `bedrock-knowledge-base-guide.md` - Bedrock Knowledge Baseガイド
12. `bedrock-model-adapters-guide.md` - Bedrockモデルアダプターガイド
13. `cost-allocation-tagging-guide.md` - コスト配分タグガイド
14. `module-development-guide-en.md` - モジュール開発ガイド（英語）
15. `module-development-guide-ja.md` - モジュール開発ガイド（日本語）
16. `i18n-complete-guide.md` - 国際化完全ガイド
17. `user-preferences-complete-guide.md` - ユーザー設定完全ガイド

---

## 📝 統合作業手順

### Phase 1: AgentCore関連の統合（優先度: 高）
1. `agentcore-complete-guide.md`作成
2. `agentcore-security-operations-guide.md`作成
3. `agentcore-monitoring-troubleshooting-guide.md`作成
4. 元ファイル削除

### Phase 2: デプロイメント・フロントエンド関連の統合（優先度: 高）
1. `deployment-complete-guide.md`作成
2. `frontend-complete-guide.md`作成
3. `debugging-complete-guide.md`作成
4. 元ファイル削除

### Phase 3: その他の統合（優先度: 中）✅ 完了
1. ✅ `fsx-integration-complete-guide.md`作成（完了: 2026-01-18）
2. ✅ `operations-configuration-guide.md`作成（完了: 2026-01-18）
3. ✅ `user-preferences-complete-guide.md`作成（完了: 2026-01-18）
4. ✅ 元ファイル削除（Step 1, 2, 3完了）
5. ⏳ `i18n-complete-guide.md`作成（保留: 既存i18nガイドの確認が必要）

### Phase 4: EC2同期とドキュメント更新（優先度: 高）
1. README.mdのリンク更新
2. 他のドキュメントからのリンク更新
3. EC2への同期

---

## ✅ 期待される効果

### 保守性の向上
- ファイル数: 46 → 18（61%削減）
- テーマごとに整理され、探しやすい
- 重複内容の削減

### ユーザビリティの向上
- 関連情報が1つのファイルに集約
- 目次による素早いナビゲーション
- 一貫性のある構成

### 更新の効率化
- 更新箇所が明確
- 重複更新の防止
- バージョン管理の簡素化

---

**次のステップ**: Phase 1から順次実行
