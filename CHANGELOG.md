# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

**最新バージョン**: 3.0.0
