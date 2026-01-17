# ドキュメントインデックス

## 📋 概要

このドキュメントは、Permission-aware RAG System with Amazon FSx for NetApp ONTAPプロジェクトの全ドキュメントの索引です。

## 🎯 最新情報（2025年11月6日更新）

### システム状況

- **現在の状態**: ✅ **完全稼働中**
- **最終確認**: 2025年10月29日 15:40 JST
- **アプリケーションURL**: https://d1kbivn5pdlnap.cloudfront.net

### 🆕 進行中プロジェクト

- **CDK完全リソース管理プロジェクト**: 50% 完了（Phase 3進行中）
- **統一設定システム構築**: 85% 完了（2025年11月上旬完了予定）
- **クリーンアップ実行**: 2025年11月中旬開始予定

### 最新レポート


## 📚 ドキュメント分類

### 🚀 完全ガイド（統合版）

#### AgentCore関連（3ガイド）
- **[AgentCore完全ガイド](guides/agentcore-complete-guide.md)** - AgentCoreの全機能（デプロイ、運用、テスト、ユーザーガイド、チュートリアル）
- **[AgentCoreセキュリティ・運用ガイド](guides/agentcore-security-operations-guide.md)** - セキュリティベストプラクティス、インシデント対応、脆弱性管理
- **[AgentCore監視・トラブルシューティング](guides/agentcore-monitoring-troubleshooting-guide.md)** - 監視・アラート、トラブルシューティング、FAQ（50問）

#### デプロイメント・開発（3ガイド）
- **[デプロイメント完全ガイド](guides/deployment-complete-guide.md)** - CDKデプロイ、Lambda VPC統合、環境設定、トラブルシューティング
- **[フロントエンド完全ガイド](guides/frontend-complete-guide.md)** - Next.js/React開発、UI/UX、テーマ実装、TypeScript型安全性
- **[デバッグ完全ガイド](guides/debugging-complete-guide.md)** - Chrome DevTools MCP、トラブルシューティング、Agent選択イベント

#### FSx統合・運用（3ガイド）
- **[FSx統合完全ガイド](guides/fsx-integration-complete-guide.md)** - FSx for ONTAP + S3統合、Access Points、マルチリージョン対応
- **[運用・設定ガイド](guides/operations-configuration-guide.md)** - 運用・メンテナンス、Observability、Policy、Evaluations設定
- **[ユーザー設定完全ガイド](guides/user-preferences-complete-guide.md)** - DynamoDB永続化、クロスデバイス同期、API仕様、CDK実装

### 📚 専門ガイド

#### 基本ガイド
- **[クイックスタート](guides/quick-start.md)** - 初めての方向けガイド
- **[FAQ](guides/faq.md)** - よくある質問と回答

#### Bedrock関連
- **[Bedrock Knowledge Baseガイド](guides/bedrock-knowledge-base-guide.md)** - Knowledge Base設定と管理
- **[Bedrockモデルアダプターガイド](guides/bedrock-model-adapters-guide.md)** - モデルアダプター実装

#### その他
- **[コスト配分タグガイド](guides/cost-allocation-tagging-guide.md)** - コスト管理とタグ戦略
- **[モジュール開発ガイド（日本語）](guides/module-development-guide-ja.md)** - モジュール開発方法
- **[モジュール開発ガイド（英語）](guides/module-development-guide-en.md)** - Module Development Guide
- **[マルチリージョンデプロイメントガイド](guides/multi-region-deployment-guide.md)** - 14リージョン対応、自動フォールバック機能

### 🔧 技術ガイド・修正手順

#### CDK・TypeScript関連


#### Next.js・フロントエンド関連

##### 国際化（i18n）・翻訳システム 🆕

- **[翻訳キー命名規則ガイド](../development/docs/guides/i18n-translation-key-naming-guide.md)** - 翻訳キーの命名規則と実装方法の詳細ガイド（2025年12月22日作成）
  - 階層構造とドット記法の使用方法
  - カテゴリ別命名パターン（model, chat, sidebar, agent等）
  - 複数形対応（tp関数）の実装方法
  - TypeScript型安全性の確保
  - ベストプラクティスとよくある間違い
- **[翻訳キー クイックリファレンス](../development/docs/guides/i18n-quick-reference.md)** - 開発者向けクイックリファレンス（2025年12月22日作成）
  - カテゴリ別翻訳キー一覧
  - 実装パターンとコード例
  - 新しいキーの追加手順
  - よくあるエラーと解決方法
- **[翻訳キー開発チェックリスト](../development/docs/guides/i18n-development-checklist.md)** - 開発・レビュー用チェックリスト（2025年12月22日作成）
  - 開発フロー（設計→実装→品質確認→テスト→ドキュメント更新）
  - コードレビュー観点
  - 品質メトリクスと成功基準


#### AWS・インフラ関連

#### FSx for ONTAP統合 🆕

- **[FSx ONTAP S3 Access Points統合ガイド](guides/fsx-ontap-s3-access-points-integration-guide.md)** - S3 Access Points for Amazon FSx for NetApp ONTAP統合ガイド（2024年12月2日リリース機能、26リージョン対応）
  - AI/ML統合（Bedrock, SageMaker, Rekognition, Textract, Transcribe, Comprehend）
  - データ分析統合（Glue, Athena, EMR, QuickSight）
  - ストリーミング統合（Kinesis Data Analytics, Kinesis Data Firehose）
  - コンピュート統合（Lambda, ECS/EKS）
  - 開発者ツール・CI/CD（CodePipeline, CodeBuild）
  - IoT・エッジコンピューティング（IoT Core, IoT Greengrass）
  - メディア・コンテンツ配信（CloudFront, Elemental MediaConvert）
  - セキュリティ・認証（デュアル認証、VPC制限、IAMポリシー）
  - パフォーマンス最適化（レイテンシ、スループット、並列処理）
  - コスト最適化（課金構造、ベストプラクティス）
  - 実装ガイド（Step-by-Stepセットアップ、CDK実装例）
- **[FSx ONTAP S3統合ガイド](guides/fsx-ontap-s3-integration-guide.md)** - FSx for ONTAP S3 Access Points + Bedrock Knowledge Base統合、AWS公式ドキュメント調査結果


### 🏗️ アーキテクチャ・設計

#### CDK完全リソース管理プロジェクト 🆕


#### モジュラーアーキテクチャ


#### 統合CDKアーキテクチャ


### 🌍 マルチリージョン・グローバル展開


### 🔐 セキュリティ・認証


### 🧪 テスト・品質保証

#### 統合テスト

- **[統合テスト実行ガイド](../development/docs/guides/integration-testing-guide.md)** - 全スタック統合テストとPermission-aware統合テストの実行方法
- **[全スタック統合テストセットアップレポート](../development/docs/reports/local/full-stack-integration-test-setup-20251125.md)** - 統合テスト環境構築完了レポート
- **[Permission-aware統合テスト仕様書](../.kiro/specs/permission-aware-integration-testing/requirements.md)** - FSx for ONTAPを使用したPermission-aware RAGシステムの統合テスト仕様（開発中）
- **[Permission-aware統合テスト設計書](../.kiro/specs/permission-aware-integration-testing/design.md)** - 統合テストの設計書（作成予定）
- **[Permission-aware統合テストタスク](../.kiro/specs/permission-aware-integration-testing/tasks.md)** - 統合テストの実装タスク（作成予定）


### 📊 運用・監視


### 🛠️ 開発環境・ツール


### 📖 リファレンス・仕様


### 📈 プロジェクト管理・レポート

#### 最新レポート（2025年10月29日）


#### 完了・成果レポート


#### フェーズ別レポート


### 🔄 メンテナンス・更新

#### 命名・標準化


#### 設定・環境


## 🎯 推奨読書順序

### 新規利用者向け
1. [クイックスタート](guides/quick-start.md) - システムの基本的な使い方
2. [FAQ](guides/faq.md) - よくある質問と回答
3. [AgentCore完全ガイド](guides/agentcore-complete-guide.md) - AgentCore機能の全体像

### 開発者向け
1. [デプロイメント完全ガイド](guides/deployment-complete-guide.md) - デプロイ手順の理解
2. [フロントエンド完全ガイド](guides/frontend-complete-guide.md) - フロントエンド開発
3. [デバッグ完全ガイド](guides/debugging-complete-guide.md) - デバッグ・トラブルシューティング
4. [FSx統合完全ガイド](guides/fsx-integration-complete-guide.md) - FSx統合の実装

### 運用者向け
1. [運用・設定ガイド](guides/operations-configuration-guide.md) - 日常運用とメンテナンス
2. [AgentCore監視・トラブルシューティング](guides/agentcore-monitoring-troubleshooting-guide.md) - 監視とトラブルシューティング
3. [AgentCoreセキュリティ・運用ガイド](guides/agentcore-security-operations-guide.md) - セキュリティとインシデント対応


## 📝 ドキュメント更新履歴

### 2026年1月18日

- ✅ **Phase 1-3完了**: ドキュメント統合プロジェクト完了（46ファイル → 18ファイル、74%削減）
- ✅ **AgentCore関連統合**: 15ファイル → 3ファイル（agentcore-complete-guide.md、agentcore-security-operations-guide.md、agentcore-monitoring-troubleshooting-guide.md）
- ✅ **デプロイメント・開発統合**: 11ファイル → 3ファイル（deployment-complete-guide.md、frontend-complete-guide.md、debugging-complete-guide.md）
- ✅ **FSx統合・運用統合**: 9ファイル → 3ファイル（fsx-integration-complete-guide.md、operations-configuration-guide.md、user-preferences-complete-guide.md）
- ✅ **README.md更新**: 新しいガイド構造を反映
- ✅ **DOCUMENTATION_INDEX.md更新**: 統合ガイドのカテゴリ別整理

### 2025年12月22日

- ✅ [翻訳キー命名規則ガイド](../development/docs/guides/i18n-translation-key-naming-guide.md) 新規作成
- ✅ [翻訳キー クイックリファレンス](../development/docs/guides/i18n-quick-reference.md) 新規作成
- ✅ [翻訳キー開発チェックリスト](../development/docs/guides/i18n-development-checklist.md) 新規作成

### 2025年11月6日

- ✅ [ドキュメントインデックス](DOCUMENTATION_INDEX.md) CDK完全リソース管理プロジェクト情報追加

### 2025年10月29日

- ✅ [ドキュメントインデックス](DOCUMENTATION_INDEX.md) 新規作成

### 継続更新中


---

**最終更新**: 2026年1月18日  
**作成者**: AI Assistant  
**システム状態**: ✅ 完全稼働中  
**ドキュメント統合**: Phase 1-3完了（46ファイル → 18ファイル、74%削減）