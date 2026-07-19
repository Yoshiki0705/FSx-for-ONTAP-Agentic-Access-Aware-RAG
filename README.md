# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** **日本語** | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

> FSx for ONTAP に保存された企業データに対して、NTFS ACL / UNIX 権限を自動反映した Permission-aware RAG + Agentic AI を提供するリファレンス実装です。AWS CDK ワンコマンドデプロイ。PoC から本番検討まで対応。

---

## はじめる

| やりたいこと | ガイド | 所要時間 |
|-------------|--------|---------|
| まず動かして体験する | [PoC ワークショップガイド](docs/poc-workshop-guide.md) | 90 分 |
| 自分のアカウントにデプロイする | [デプロイ手順](docs/deployment-guide.ja.md) | 30-40 分 |
| 実データで検証する | [安全な実験ガイド](docs/safe-experimentation-guide.md) | 2-4 週間 |
| 精度・コストを評価する | [RAG/Agent 評価フレームワーク](docs/evaluation.md) | 1 週間 |
| 本番化を判断する | [本番化チェックリスト](docs/production-readiness-checklist.md) | — |
| コストを見積もる | [コスト見積もりワークシート](docs/cost-estimation-worksheet.md) | — |

<details><summary>📂 全機能・設計ガイド一覧</summary>

| カテゴリ | ガイド | 内容 |
|---------|--------|------|
| アーキテクチャ | [実装概要（22 の観点）](docs/implementation-overview.md) | 全コンポーネントの技術詳細 |
| アーキテクチャ | [Architecture Decision Records](docs/architecture-decision-records.md) | 6 つの主要意思決定の根拠 |
| アーキテクチャ | [スタック構成比較](docs/stack-architecture-comparison.md) | ベクトルストア・デプロイ構成の比較 |
| 権限制御 | [SID フィルタリング設計](docs/SID-Filtering-Architecture.md) | 権限照合の仕組み |
| 権限制御 | [権限整合性モデル](docs/permission-consistency.md) | ACL 伝播フロー・遅延・緊急剥奪 |
| 認証 | [認証・ユーザー管理](docs/auth-and-user-management.md) | OIDC / SAML / LDAP 連携 |
| 認証 | [認証モード別セットアップ](demo-data/guides/auth-mode-setup-guide.md) | 構成サンプル + ワンショットスクリプト |
| 運用 | [CloudWatch ダッシュボード](docs/cloudwatch-dashboard-guide.md) | メトリクス・アラーム・トラブルシュート |
| 運用 | [KB Auto-Sync エラーハンドリング](docs/kb-auto-sync-error-handling.md) | リトライ・手動復旧 |
| 運用 | [FSx for ONTAP サイジング](docs/fsxn-sizing-and-performance.md) | 規模別構成・QoS・ベクトルストア選定 |
| セキュリティ | [脅威モデル](docs/threat-model.md) | 10 脅威カテゴリ・攻撃経路・緩和策 |
| セキュリティ | [ガバナンス・監査設計](docs/governance-and-audit.md) | 監査ログ・Responsible AI・Guardrails |
| データ | [チャンキング戦略選定](docs/chunking-strategy-guide.md) | FIXED_SIZE / HIERARCHICAL / SEMANTIC |
| データ | [S3 Vectors SID 設計](docs/s3-vectors-sid-architecture-guide.md) | メタデータ制約・フィルタリング実装 |
| データ | [S3 AP 互換性マトリクス](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md) | プラットフォーム別制約（外部リンク） |
| パートナー | [パートナー展開パターン](docs/partner-deployment-patterns.md) | マルチテナント・コスト見積もり |
| ベンチマーク | [ベンチマークシナリオ](docs/benchmark-scenarios.md) | 10K/100K/1M ファイル性能計測 |
| デモ | [業種別デモデータ（7 業種）](demo-data/industry-packs/) | 行政・医療・法務・製造・建設・教育・保険 |
| 全ドキュメント | [ドキュメントインデックス](docs/DOCUMENTATION_INDEX.md) | 推奨読書順序付きの完全一覧 |

</details>

---

## アーキテクチャ

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (認証: OIDC/SAML/Email)    (RAG検索 + Embedding)        (SID/権限データ)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**処理フロー**: ユーザー認証 → DynamoDB から SID 取得 → Bedrock KB ベクトル検索 → SID 照合でフィルタ → 許可ドキュメントのみで回答生成

主な特徴:
- **Permission-aware RAG** — NTFS ACL / UNIX 権限を検索時に自動反映（Fail-Closed）
- **Agentic AI** — KB モード（文書検索）と Agent モード（多段階推論）をワンクリック切替
- **Smart Routing** — クエリ複雑度で Haiku / Sonnet / Opus を自動選択（コスト 40-60% 削減）
- **低コスト** — S3 Vectors（月数ドル）をデフォルト採用
- **22 の統合機能** — 音声チャット、Guardrails、Graph RAG、Web Search 等（[詳細](docs/implementation-overview.md)）

<details><summary>⚠️ 前提条件・制約</summary>

| 項目 | 内容 |
|------|------|
| 前提環境 | Node.js 22+、Docker、AWS CLI 設定済み、AdministratorAccess 相当 |
| デプロイ先 | ap-northeast-1（変更可）+ us-east-1（WAF/Web Search 用、固定） |
| ONTAP バージョン | 9.17.1 以上（S3 Access Points 要件） |
| S3 AP 主要制約 | 条件付き書き込み非対応、Event Notifications 非対応、ListObjectsV2 高レイテンシ |
| ベクトルストア | S3 Vectors（デフォルト、filterable 2KB 制限あり）/ OpenSearch Serverless（高性能） |
| Responsible AI | AI 出力は補助的シグナル。最終判断は人間の責任。[詳細](docs/governance-and-audit.md) |

S3 AP の包括的な互換性マトリクスは [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md) を参照してください。

</details>

<details><summary>📚 関連リポジトリ</summary>

| リポジトリ | 用途 | 概要 |
|-----------|------|------|
| **[本リポジトリ]** | AI / RAG | 権限フィルタリング付き RAG + Agentic AI |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless 自動化 | 17 業種別サーバーレスパターン（FPolicy イベント駆動） |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Athena / Glue / EMR / SageMaker 統合 |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability | 監査ログを Datadog / Splunk / Grafana へ EC2 不要で配信 |

**共通基盤**: 全リポジトリが FSx for ONTAP S3 Access Points を使用し、NFS/SMB を中断せずデータ活用を拡張します。

**AWS 公式リソース**:
- [Build a RAG application using Amazon Bedrock Knowledge Bases with FSx for ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [FSx for ONTAP S3 Access Points as an Amazon Bedrock Data Source](https://repost.aws/articles/AReKa8-o8XRGeVW2Nicbg1_w/fsxn-s3-access-points-as-an-amazon-bedrock-data-source)

</details>

<details><summary>🔧 開発者向け</summary>

```bash
# TypeScript 型チェック
npx tsc --noEmit

# CDK synth（フィーチャーフラグ組み合わせテスト）
npx cdk synth --quiet
npx cdk synth --quiet -c enableTransferFamily=true
npx cdk synth --quiet -c enableGuardrails=true -c enableAgentCoreGateway=true

# テスト
npx jest --no-coverage
cd docker/nextjs && npx vitest run
cd automation/transfer-family && python3 -m pytest tests/ -v
```

プロジェクト構成、コーディング規約、CI パイプラインの詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。

</details>

<details><summary>🖼️ スクリーンショット</summary>

| 画面 | 説明 |
|------|------|
| ![KB モード](docs/screenshots/v4-kb-mode-ja.png) | KB モード — カードグリッド + サイドバー |
| ![Agent モード](docs/screenshots/v4-agent-mode-ja.png) | Agent モード — Agent 選択 + カードグリッド |
| ![チャット応答](docs/screenshots/v4-kb-chat-response-ja.png) | Citation + アクセスレベルバッジ |
| ![Agent Directory](docs/screenshots/v4-agent-directory-registry-ja.png) | Agent 管理・Registry 統合 |
| ![Smart Routing](docs/screenshots/kb-mode-smart-routing-ja.png) | 自動モデル選択 |
| ![マルチ Agent](docs/screenshots/v4-multi-agent-mode-ja.png) | Supervisor + Collaborator 協調 |

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)
