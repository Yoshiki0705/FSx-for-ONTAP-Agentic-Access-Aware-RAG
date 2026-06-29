---
title: "権限を守りながら AI で検索する — Amazon FSx for NetApp ONTAP + Bedrock で実現する Permission-Aware RAG"
published: false
description: "NTFS ACL / UNIX 権限を維持したまま企業ファイルサーバーを AI 検索。FSx for ONTAP + S3 Access Point + Amazon Bedrock + S3 Vectors で CDK ワンコマンドデプロイ。PoC 月額 $430 から。"
tags: aws, amazonfsxfornetappontap, bedrock, rag
series: "Permission-Aware RAG with FSx for ONTAP"
cover_image: https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/v4-kb-mode-ja.png
---

## TL;DR

- FSx for ONTAP 上の企業文書を、**ユーザーごとのファイル権限（NTFS ACL / SID / UID+GID）を維持したまま** AI で検索・回答
- 同じ質問でも管理者は機密文書込み、一般ユーザーは公開情報のみで回答が変わる
- S3 Vectors（月数ドル）をデフォルトベクトルストアに採用し、PoC 月額 ~$430 から開始可能
- `npx cdk deploy --all` でフルスタックデプロイ（7 CDK スタック）
- v4.4: Voice Chat（WebRTC）、Smart Routing、Guardrails、Prompt Caching、エピソード記憶、**cdk-nag AwsSolutions 準拠**を含む [22 機能搭載](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG#features)。Web Search ハイブリッド検索は実装済み・次版リリース予定（[Summit NYC 2026 GA](https://aws.amazon.com/blogs/aws/announcing-web-search-on-amazon-bedrock-agentcore-ground-your-ai-agents-in-current-accurate-web-knowledge/)）

> **Responsible AI note**: 本システムの AI 出力は**補助的なシグナル**です。業務上の最終判断は人間が行います。権限フィルタリングは技術的なアクセス制御であり、法的・コンプライアンス上の判断を代替しません。規制対象ワークロードでの利用には顧客固有の評価が必要です。

👉 **GitHub**: [Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG)

---

## 課題: ファイルサーバー × AI の壁

> 「10万件の文書がファイルサーバーにあるが、必要な情報を探すのに毎回15分かかる。AI で検索したいが、部門ごとのアクセス権限は絶対に守らないといけない。」

この相談は製造業、金融、公共、医療 — 業種を問わず共通しています。従来の RAG は「セマンティック類似度」だけで検索するため、権限境界が消えます。結果として:

- 他部門の機密情報が漏洩するリスク
- 自部門に無関係なノイズが検索結果に混入
- 「AI を使いたいが怖い」で導入が止まる

**Permission-Aware RAG** はこの問題を解決します。

---

## アーキテクチャ

![KB Mode](https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/v4-kb-mode-ja.png)

```
Browser → CloudFront + WAF → Lambda Web Adapter (Next.js 15)
                                      │
           ┌──────────┬───────────────┼──────────────┐
           ▼          ▼               ▼              ▼
      Cognito    Bedrock KB       DynamoDB       DynamoDB
     User Pool  + S3 Vectors    user-access     perm-cache
                     │           (SID Data)
                     ▼
              FSx for ONTAP
            + S3 Access Point
```

7 CDK スタック: WAF (us-east-1) / Networking / Security / Storage / AI / WebApp / Transfer Family (opt-in)

---

## コアの仕組み: SID ベース権限フィルタリング

1. ユーザーが質問を送信
2. DynamoDB から SID リスト（個人 SID + グループ SID）を取得
3. Bedrock KB Retrieve で vector 検索 → 各結果に `allowed_group_sids` メタデータ
4. ユーザー SID と文書 SID の積集合でフィルタリング（**Fail-Closed**: 権限メタデータが存在しない文書は安全側に倒して非表示にする設計）
5. 許可された文書のみ Converse API に渡して回答生成

```
■ 管理者: SIDs = [...-512 (Domain Admins), S-1-1-0 (Everyone)]
  public/       → ✅   confidential/ → ✅   engineering/ → ❌

■ エンジニア: SIDs = [...-1100 (Engineering), S-1-1-0 (Everyone)]
  public/       → ✅   confidential/ → ❌   engineering/ → ✅

■ 営業: SIDs = [...-1200 (Sales), S-1-1-0 (Everyone)]
  public/       → ✅   confidential/ → ❌   engineering/ → ❌
```

![Chat Response + Citation Badge](https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/v4-kb-chat-response-ja.png)

---

## S3 Access Point: データ移行なしの接続

FSx for ONTAP の S3 Access Point は、既存 NFS/SMB 共有に S3 互換 API インターフェースを追加します。**データのコピーは発生しません。**

```
FSx for ONTAP Volume (/data)
  ├── document.md
  ├── document.md.metadata.json    ← 権限メタデータ
      │  S3 Access Point
      ▼
  Bedrock KB Data Source → Titan Embed v2 → S3 Vectors
```

- Bedrock KB が S3 AP 経由で直接ドキュメントを読み取り
- `.metadata.json` に `allowed_group_sids` を記述するだけで権限が RAG に反映
- 既存の Windows 共有フォルダ（SMB）はそのまま使い続けられる

---

## 主要機能ハイライト（v4.4.0）

### Smart Routing — クエリ単価の大幅削減

クエリの複雑度を自動判定し、3 ティアに振り分けます。一般的な企業利用ではクエリの大半が Simple/Complex に分類されるため、全クエリに最上位モデルを使う場合と比較してクエリ単価を大きく下げられます（実際の比率は利用パターンに依存）:

| クエリ例 | ティア | モデル | コスト目安 |
|---------|--------|--------|-----------|
| 「こんにちは」 | Simple | Haiku 4.5 | ~$0.001 |
| 「製品特徴を要約して」 | Complex | Sonnet 4.6 | ~$0.01 |
| 「全部門の四半期レポートを横断分析」 | Full-context | Opus 4 | ~$0.10 |

![Smart Routing](https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/kb-mode-smart-routing-ja.png)

### Transfer Family SFTP インジェスション — パートナー連携

外部パートナー（法律事務所、監査法人）が SFTP でファイルをアップロードするだけで、自動的に KB に取り込まれます。

```
パートナー → SFTP put → FSx for ONTAP S3 AP → メタデータ自動生成 → KB 自動取り込み
```

- パートナーは Web UI 不要（SFTP クライアントのみ）
- 権限メタデータはシステムが自動生成（IAM Deny でパートナーは操作不可）
- アップロードから 5 分以内に RAG 検索可能

### Web Search ハイブリッド検索（実装済み・次版リリース予定 — Summit NYC 2026 GA）

内部 KB の検索結果が不足した場合、AgentCore Web Search Gateway（us-east-1）で公開 Web 情報を補強します。本機能は実装・テスト完了済みで、次の正式リリースに含まれます。

```
KB 検索 → スコア不足 → Web Search Gateway (MCP, SigV4)
  → 内部引用: ✅ 認証済み  |  Web 引用: 🌐 参考情報（明確に分離）
```

- opt-in（`enableWebSearch=true`）、デフォルト無効
- us-east-1 のみ対応（ap-northeast-1 からクロスリージョン呼び出し。追加レイテンシ ~100-200ms）
- クエリサニタイズ: 内部情報（SID、IP、パス）を除去してから外部送信
- プロンプトインジェクション防御: `<web_search_results>` 境界タグで非信頼データを隔離
- Graceful degradation: Gateway 障害時は内部 KB のみで回答（5 秒タイムアウト）

### Voice Chat（WebRTC + Nova Sonic）

マイクから音声で質問し、テキスト + 音声で回答。権限フィルタリングは音声でも同様に適用。

- Phase 1: REST（実装済み）/ Phase 2: WebRTC 低レイテンシ（実装済み）
- AgentCore Runtime + Pipecat Agent でリアルタイム双方向ストリーミング
- 15 秒タイムアウトで自動フォールバック（WebRTC → REST）

### マルチエージェント協調

Supervisor + Collaborator パターンで複雑なタスクを分担:

- Permission Resolver / Retrieval Agent / Analysis Agent / Output Agent
- **KB アクセスは Permission Resolver と Retrieval Agent のみ**（権限境界の維持）

![Multi-Agent Mode](https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/v4-multi-agent-mode-ja.png)

### その他の機能

| 機能 | 概要 |
|------|------|
| **cdk-nag AwsSolutions 準拠** | 全スタックで AwsSolutionsChecks を有効化。S3 SSL、DynamoDB PITR、VPC Flow Logs、パスワードポリシー強化を含む 35 findings 解消 |
| **KB Auto-Sync** | 5 分間隔でファイル変更を自動検出・KB 取り込み |
| **Guardrails** | コンテンツフィルタ + PII 検出 + トピックポリシー + Automated Reasoning |
| **AgentCore Memory** | 短期記憶（セッション内）+ 長期記憶（セッション横断）+ エピソード記憶 |
| **AgentCore Policy** | Cedar 言語でエージェントの行動境界を定義（LOG_ONLY / ENFORCE） |
| **Prompt Caching** | Messages API 経由で system prompt キャッシュ（2 回目以降 33% コスト削減） |
| **Hybrid Search** | セマンティック + キーワード検索の切替（`kbSearchType=HYBRID`） |
| **8 言語 i18n** | UI + ドキュメント: 日/英/韓/簡中/繁中/仏/独/西 |

---

## コスト感

| 構成 | 月額概算 | 主な内訳 |
|------|---------|---------|
| PoC（最小） | ~$430 | FSx for ONTAP（128 MB/s Single-AZ ~$350）+ Bedrock 推論 + Lambda + S3 Vectors |
| 中規模 | ~$3,600 | FSx for ONTAP（256 MB/s Multi-AZ）+ Bedrock 推論増 |
| 大規模 | ~$8,500 | FSx for ONTAP（512 MB/s）+ OpenSearch Serverless |

> S3 Vectors（月数ドル）がデフォルトベクトルストア。OpenSearch Serverless（月 $700+）は低レイテンシ要件がある場合のみ。コスト内訳の詳細は [GitHub のコスト分析ドキュメント](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/cost-analysis.md) を参照。

---

## 始め方（90 分）

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG && npm install

npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1

bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```

> 前提: Node.js 22+、Docker、AWS CLI 設定済み。FSx for ONTAP 作成に 20-30 分かかるため、既存 FS がある場合は `existingFileSystemId` で 10 分以下に短縮可能。

デプロイ後、`admin@example.com` と `user@example.com` で同じ質問をすると、権限差異による検索結果の違いを体験できます。

---

## 他の選択肢との比較

企業データに対する AI 検索にはいくつかのアプローチがあります。要件に応じて選択してください:

| アプローチ | 適するケース | トレードオフ |
|-----------|-------------|-------------|
| **本システム（FSx for ONTAP + カスタム RAG）** | 既存ファイルサーバーの NTFS ACL / UNIX 権限をそのまま RAG に反映したい。データ移行なし | CDK でのデプロイ・運用が必要。カスタム実装のため保守は自組織 |
| **Amazon Q Business** | マネージドな企業向け AI アシスタントを短期間で導入したい。S3、SharePoint 等のコネクタを使う | FSx for ONTAP のファイルレベル ACL をそのまま反映する仕組みは自前で構築が必要。マネージド故のカスタマイズ制約あり |
| **Amazon Kendra + GenAI** | ドキュメント検索（キーワード + セマンティック）が主目的で、LLM 生成は補助的 | 権限制御は ACL トークンベース（コネクタ依存）。FSx for ONTAP 用コネクタは提供されていないためカスタム開発が必要 |
| **Bedrock Knowledge Bases（マネージド）** | S3 / Web クローラーを使ったマネージド RAG を素早く構築したい | メタデータフィルタによる権限制御は可能だが、SID/ACL の動的解決は自前で実装。Agentic Retrieval でのフィルタ維持は検証が必要 |

> **選び方**: 「既存 NAS のファイル権限をそのまま AI に反映する」要件が強い場合は本システムのアプローチが適します。「マネージドサービスで素早く始めたい」場合は Amazon Q Business や Bedrock Knowledge Bases（マネージド）から始め、権限要件に応じてカスタマイズを検討するのが現実的です。

---

## 詳細情報

アーキテクチャの深掘り、認証モード（5 種）、デプロイオプション、運用手順、業種別デモデータの詳細は GitHub リポジトリの README（8 言語対応）を参照してください。

👉 [GitHub Repository](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG)
📖 [運用 Runbook](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/blob/main/docs/operations-runbook.md)
🏭 [7 業種デモデータ](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/tree/main/demo-data/industry-packs)

---

*Yoshiki Fujiwara — AWS Community Builder*
