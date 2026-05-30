# S3AP Serverless Patterns 連携アーキテクチャ

**🌐 Language:** **日本語** | [English](en/s3ap-serverless-patterns-integration.md)

**作成日**: 2026-05-23  
**ステータス**: ドラフト  
**対象**: アーキテクト、パートナー SA 向け

---

## 概要

本ドキュメントは、[FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)（17 UC のサーバーレス処理パターン）と本プロジェクト（Permission-aware Agentic RAG）の連携アーキテクチャを説明します。

---

## 2 プロジェクトの位置づけ

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (企業ファイルサーバー)                                      │
│                                                                         │
│  NAS データ: 設計図面、契約書、診療記録、財務レポート、研究論文...          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (処理・変換・分析)            │  │ (権限付き AI 検索・対話)      │
│                              │  │                              │
│ ・Step Functions バッチ処理   │  │ ・Bedrock KB + Converse API  │
│ ・AI/ML サービス連携          │  │ ・SID フィルタリング          │
│ ・処理結果を FSx に書き戻し   │  │ ・チャット UI (Next.js)      │
│                              │  │ ・Agent モード               │
│ 17 業界 UC                   │  │ 14 Agent テンプレート        │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## 連携パターン

### パターン A: 処理結果を RAG 検索対象にする

S3AP Serverless Patterns で処理・分析された結果を、RAG の検索対象ドキュメントとして活用します。

```
FSx for ONTAP (生データ: DICOM画像、契約書PDF、IoTログ)
  ↓ S3 AP (読み取り)
S3AP Serverless Patterns
  ├─ UC5: DICOM → メタデータ抽出・匿名化
  ├─ UC1: 契約書 → エンティティ抽出・分類
  └─ UC3: IoTログ → 異常検知・レポート生成
  ↓ S3 AP (書き戻し) or S3 バケット
FSx for ONTAP (処理済みデータ + .metadata.json)
  ↓ S3 AP (読み取り)
Permission-aware RAG (Bedrock KB)
  ↓ SID フィルタリング
ユーザー: 「先月の品質検査で異常があった製品は？」
```

**メリット**:
- 生データ（画像、バイナリ）を AI が理解可能なテキストに変換してから RAG に投入
- 処理結果に権限メタデータを付与し、部門別アクセス制御を維持
- 2 つのシステムが同じ FSx for ONTAP ボリュームを共有（データコピー不要）

### パターン B: RAG から処理パイプラインをトリガーする

Agent モードで「分析を実行して」と指示すると、S3AP パターンの Step Functions をトリガーします。

```
ユーザー: 「最新の品質検査画像を分析してレポートを作成して」
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: 製造業分析)
  ↓ 処理完了
Agent: 「分析が完了しました。結果はこちらです: ...」
```

### パターン C: 監査・コンプライアンスの統合

S3AP UC1（法務・コンプライアンス）の監査結果を RAG で検索可能にし、コンプライアンス状況を対話的に確認します。

```
S3AP UC1: ファイルサーバー監査 → 監査レポート生成
  ↓
RAG: 「コンプライアンス違反のファイルはありますか？」
  → 監査レポートから権限範囲内の情報を回答
```

---

## 業種別連携マッピング

| S3AP UC | 業種 | RAG での活用方法 | Agent テンプレート |
|---------|------|----------------|------------------|
| UC1 | 法務 | 監査レポートの検索、コンプライアンス状況確認 | `legalCompliance` |
| UC2 | 金融 | OCR 処理済み請求書・契約書の検索 | `financial` |
| UC3 | 製造 | 品質検査レポート・異常検知結果の検索 | `search` |
| UC5 | 医療 | DICOM メタデータ・匿名化済み所見の検索 | `medicalGuideline` |
| UC10 | 建設 | BIM メタデータ・安全コンプライアンスレポートの検索 | `project` |
| UC13 | 教育 | 論文分類結果・引用ネットワークの検索 | `search` |
| UC14 | 保険 | 査定レポート・損害評価結果の検索 | `insuranceClaim` |
| UC16 | 政府 | 公文書分類・墨消し済み文書の検索 | `publicDocument` |

---

## デプロイ構成例

### 最小構成（1 アカウント）

```
AWS Account
├── FSx for ONTAP (共有ボリューム)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (選択デプロイ)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### エンタープライズ構成（マルチアカウント）

```
Management Account
├── StackSets (S3AP パターン配布)
└── CDK Pipelines (RAG 配布)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | マルチテナント展開パターン |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR（ベクトルストア、権限フィルタ等） |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | 17 UC の詳細 |
