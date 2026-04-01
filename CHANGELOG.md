# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-04

### Added
- **画像分析RAG（Image Recognition）**: チャット入力に画像アップロード（ドラッグ＆ドロップ / ファイルピッカー）を追加。Bedrock Vision API（Claude 3 Haiku）で画像を分析し、結果をKB検索コンテキストに統合。JPEG/PNG/GIF/WebP対応、5MB上限、30秒タイムアウト、テキストのみフォールバック
- **Knowledge Base接続UI**: Agent作成・編集フォームにKBSelector追加。AgentとKnowledge Baseの接続・解除・一覧表示。Agent詳細パネルに接続済みKB表示。Bedrock Agent APIに3アクション追加（associate/disassociate/listAgentKnowledgeBases）
- **コスト最適化ルーティング（Smart Routing）**: クエリ複雑度分類エンジン（ComplexityClassifier）で simple/complex を判定し、軽量モデル（Haiku）または高性能モデル（Sonnet）を自動選択。サイドバーにRoutingToggle、レスポンスにAuto/Manualバッジ表示。ModelSelectorに「自動」オプション追加。localStorage永続化
- 36プロパティのfast-checkプロパティベーステスト（7テストファイル、64テストケース）
- 全3機能の8言語i18n対応（ja, en, ko, zh-CN, zh-TW, fr, de, es）

### Changed
- `/api/bedrock/kb/retrieve/route.ts`: imageData/imageMimeTypeフィールド追加、Vision API統合
- `/api/bedrock/agent/route.ts`: KB接続管理3アクション追加（既存アクション変更なし）
- `ModelSelector.tsx`: Smart Routing ON時に「自動」オプション表示
- `AgentCreator.tsx` / `AgentEditor.tsx` / `AgentDetailPanel.tsx`: KBSelector/ConnectedKBList統合

## [3.0.0] - 2026-03

### Added
- Permission-aware RAGデモ環境（KBモード専用）
- 5スタック構成のCDKデプロイメント（Networking, Security, Storage, AI, WebApp）
- FSx for ONTAP + FlexCacheによるキャッシュボリューム構成
- Bedrock Knowledge Base + OpenSearch Serverlessによるベクトル検索
- SID/ACLベースのPermission-awareフィルタリング
- DynamoDB権限キャッシュ（TTL: 5分）
- デモデータ・セットアップスクリプト一式
- プロパティベーステスト（fast-check）

### Changed
- KBモード専用に簡素化（Agent Mode除外）
- パブリックリポジトリ向けコード整理
- EC2ベースのビルド・デプロイ手順に統一

## [2.0.0] - 2025-11

### Added
- Amazon Nova Pro統合
- 多言語対応（日本語・英語）

## [1.0.0] - 2024

### Added
- 初期リリース
- モジュラーアーキテクチャ実装
- 基本的なRAG機能

---

**最新バージョン**: 3.1.0
