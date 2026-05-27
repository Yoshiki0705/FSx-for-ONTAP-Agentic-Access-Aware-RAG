# AWS Partner Central MCP サーバー活用ガイド

**作成日**: 2026-05-26
**対象**: APN パートナー（NetApp 等）のセールス・SA チーム
**目的**: 本プロジェクトの案件化・ファンド申請を Partner Central MCP サーバーで効率化する

---

## 概要

[AWS Partner Central エージェント MCP サーバー](https://docs.aws.amazon.com/partner-central/latest/APIReference/partner-central-mcp-server.html)は、Partner Central の機能を MCP プロトコル経由で AI エージェントに公開するサービスです。本プロジェクト（Permission-aware RAG with FSx for ONTAP）の案件管理・ファンド活用を自動化できます。

**前提条件**:
- AWS Partner Central の新コンソールエクスペリエンスに移行済み
- IAM ポリシーで Partner Central API へのアクセス権限が付与済み
- MCP 対応クライアント（Kiro、Claude Desktop、Amazon Q Developer 等）

---

## 本プロジェクトでの活用シナリオ

### 1. オポチュニティ作成の自動化

顧客との PoC ミーティング後、議事録やメモから自動的にオポチュニティを作成できます。

**プロンプト例**:
```
以下の PoC ミーティングメモからオポチュニティを作成してください:
- 顧客: [顧客名]
- ワークロード: FSx for ONTAP + Bedrock RAG による権限付きドキュメント検索
- 想定月額 AWS 利用料: $3,000-5,000
- クローズ予定: 3ヶ月後
- 次のステップ: デモ環境構築、PoC データ投入
```

### 2. ファンド適格性の確認と申請

本プロジェクトの PoC 実施に利用可能な AWS ファンドプログラムを自動で特定できます。

**プロンプト例**:
```
オポチュニティ O1234567890 に対して利用可能なファンドプログラムを教えてください。
特に以下に該当するものを探しています:
- PoC/Proof of Concept 支援
- Migration Acceleration Program (MAP)
- ISV Workload Migration Program
```

**本プロジェクトに関連するファンドカテゴリ**:
| ファンド | 適用シナリオ | 備考 |
|---------|------------|------|
| **POC Fund** | 顧客環境での PoC 実施 | デプロイ費用（FSx ONTAP + Bedrock）をカバー |
| **MAP** | オンプレ NAS → FSx ONTAP 移行 | 大規模移行案件向け |
| **SCA (Strategic Collaboration Agreement)** | 年間コミット案件 | NetApp-AWS 共同 GTM |
| **ISV Accelerate** | ISV ソリューション拡販 | NetApp ソリューションとしての提案時 |

### 3. セールスプレイ生成

業種別のカスタマイズされたセールス戦略を自動生成できます。

**プロンプト例**:
```
オポチュニティ O1234567890 に対するセールスプレイを生成してください。
以下のコンテキストを含めてください:
- 顧客は製造業で、設計図面・技術文書が部門間で散在している
- 現在は共有フォルダを手動検索（平均15分/件）
- 権限管理が検索システムと分離しており情報漏えいリスクがある
- 本ソリューション: FSx ONTAP + Bedrock RAG で権限付き AI 検索を実現
- 期待効果: 検索時間50%以上削減、権限違反0件
```

### 4. パイプライン分析

FSx ONTAP RAG 関連の案件パイプラインを俯瞰的に分析できます。

**プロンプト例**:
```
FSx for ONTAP または Bedrock RAG に関連するオポチュニティの現状を教えてください。
- 今月クローズ予定の案件は？
- 停滞している案件は？
- 次のアクションが必要な案件は？
```

### 5. 顧客プロファイル作成

PoC 提案前に顧客の公開情報を自動収集し、提案準備を効率化できます。

**プロンプト例**:
```
[顧客名] の顧客プロファイルを作成してください。
特に以下の観点で情報を整理してください:
- 業種と事業規模
- IT インフラの傾向（クラウド移行状況）
- データ管理・コンプライアンス要件
- 本ソリューションとの適合性
```

---

## MCP サーバーのセットアップ

### Kiro での設定

`.kiro/settings/mcp.json` に以下を追加:

```json
{
  "mcpServers": {
    "partner-central": {
      "command": "npx",
      "args": ["-y", "@aws/partner-central-mcp-server"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "partner-central"
      }
    }
  }
}
```

> **注意**: Partner Central MCP サーバーは SigV4 認証を使用します。AWS プロファイルに Partner Central API へのアクセス権限が必要です。

### 必要な IAM 権限

> **最小権限原則**: 以下は本プロジェクトの案件管理に必要なアクションのみに絞った推奨ポリシーです。`partnercentral-selling:*` のようなワイルドカードは本番環境では避けてください。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PartnerCentralOpportunityManagement",
      "Effect": "Allow",
      "Action": [
        "partnercentral-selling:GetOpportunity",
        "partnercentral-selling:ListOpportunities",
        "partnercentral-selling:CreateOpportunity",
        "partnercentral-selling:UpdateOpportunity",
        "partnercentral-selling:GetEngagementInvitation",
        "partnercentral-selling:ListEngagementInvitations",
        "partnercentral-selling:ListSolutions"
      ],
      "Resource": "*"
    }
  ]
}
```

> **注意**: Partner Central API は現時点でリソースレベルの ARN 制約をサポートしていないため `Resource: "*"` としていますが、アクションは必要最小限に絞っています。ファンド申請や顧客プロファイル作成に追加アクションが必要な場合は、段階的に追加してください。

---

## 本プロジェクトとの連携ワークフロー

```
┌─────────────────────────────────────────────────────────────────┐
│                    案件ライフサイクル                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 顧客発掘                                                     │
│     └─ Partner Central MCP: 顧客プロファイル作成                   │
│                                                                 │
│  2. PoC 提案                                                     │
│     ├─ Partner Central MCP: セールスプレイ生成                     │
│     └─ 本リポジトリ: docs/poc-workshop-guide.md                   │
│                                                                 │
│  3. PoC 実施                                                     │
│     ├─ Partner Central MCP: オポチュニティ作成 + ファンド申請       │
│     ├─ 本リポジトリ: npx cdk deploy --all                        │
│     └─ 本リポジトリ: demo-data/industry-packs/ (業種別データ)      │
│                                                                 │
│  4. 評価・判定                                                    │
│     ├─ 本リポジトリ: tests/rag-evaluation/ (RAGAS 品質評価)        │
│     ├─ 本リポジトリ: docs/evaluation.md (KPI フレームワーク)       │
│     └─ Partner Central MCP: オポチュニティ進捗更新                 │
│                                                                 │
│  5. 本番化・クローズ                                              │
│     ├─ 本リポジトリ: docs/production-readiness-checklist.md       │
│     └─ Partner Central MCP: ファンド精算 + クローズ               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 業種別提案テンプレート（MCP プロンプト）

### 製造業

```
オポチュニティを作成してください:
- 顧客: [顧客名]（製造業）
- ワークロード: FSx for ONTAP に保存された設計図面・技術文書の権限付き AI 検索
- 課題: 部門間で散在する技術文書の検索に平均15分/件かかっている
- ソリューション: Permission-aware RAG（NTFS ACL 自動反映）
- 期待効果: 設計レビュー準備時間60%削減
- 想定月額: $3,000-5,000
- クローズ予定: [日付]
```

### 金融

```
オポチュニティを作成してください:
- 顧客: [顧客名]（金融業）
- ワークロード: 規制文書・内部レポートの権限付き AI 検索
- 課題: アクセス管理が手動で漏えいリスク、コンプライアンス確認に時間がかかる
- ソリューション: Permission-aware RAG（SID/UID/GID フィルタリング + Fail-Closed）
- 期待効果: コンプライアンス確認工数50%削減
- 想定月額: $5,000-8,000
- クローズ予定: [日付]
```

### 公共

```
オポチュニティを作成してください:
- 顧客: [顧客名]（公共機関）
- ワークロード: 政策文書・内部資料の部局横断 AI 検索
- 課題: 部局間連携が遅く、情報収集に時間がかかる
- ソリューション: Permission-aware RAG（部局×職位の権限制御）
- 期待効果: 政策立案の情報収集時間70%削減
- 想定月額: $3,000-5,000
- クローズ予定: [日付]
- 備考: Guardrails 有効化（PII 検出 + コンテンツフィルタ）
```

---

## 参考リンク

- [AWS Partner Central MCP Server ドキュメント](https://docs.aws.amazon.com/partner-central/latest/APIReference/partner-central-mcp-server.html)
- [Getting Started ガイド](https://docs.aws.amazon.com/partner-central/latest/APIReference/mcp-getting-started.html)
- [AWS Partner Central 自動化ソリューション](https://aws.amazon.com/partners/partner-central/automations/)
- [本プロジェクト PoC ワークショップガイド](poc-workshop-guide.md)
- [本プロジェクト コスト見積もりワークシート](cost-estimation-worksheet.md)
- [本プロジェクト パートナー展開パターン](partner-deployment-patterns.md)

