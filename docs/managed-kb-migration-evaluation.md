# Amazon Bedrock Managed Knowledge Base 移行パス検討

**🌐 Language:** **日本語** | [English](en/managed-kb-migration-evaluation.md)

**作成日**: 2026-06-18
**対象リージョン**: ap-northeast-1 (東京) — Managed KB は東京リージョンで利用可能
**ステータス**: 検討ドキュメント（移行未実施 / 既存パス維持）
**関連**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md`（連携元）

---

## 0. このドキュメントの位置づけ

本ドキュメントは、AWS Summit New York 2026（2026-06-17）で GA となった [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/) を、本リポジトリの既存 Permission-aware RAG 構成（Bedrock KB + OpenSearch Serverless / S3 Vectors）にアップグレードする際の**移行パス検討**を整理したものである。

重要な前提:

- 本ドキュメントは**検討資料**であり、移行を即時推奨するものではない。
- 既存パス（Bedrock KB + OpenSearch Serverless / S3 Vectors）は**削除しない**。
- 記載内容は以下の2つのエビデンス階層に分類している。

| 階層 | 定義 | 本書での扱い |
|------|------|------------|
| Public evidence | AWS 公式ドキュメント・ブログから検証可能 | 出典リンク付きで記載 |
| Project-context expectation | 本プロジェクト内の設計判断・期待値（公開検証不可） | 「本プロジェクトの想定」と明示 |

> ⚠️ **Distinction discipline**: 「サンプル機能の一般説明」と「本プロジェクトでの検証済み挙動」を明確に区別する。Managed KB の機能記述は AWS 公開情報に基づく一般説明であり、本プロジェクトでの ACL 連携挙動は**未検証**（後述の検証ポイントを参照）。

---

## 1. Managed KB の主要機能（Public evidence）

[Introducing Amazon Bedrock Managed Knowledge Base ブログ](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) および [GA アナウンス](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/) に基づく。内容は出典の趣旨を保ちつつ要約・言い換えしている（ライセンス遵守のため再構成）。

| 機能 | 概要 | 本プロジェクトとの関連 |
|------|------|----------------------|
| 6 ネイティブデータコネクタ | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler。データと権限を自動取り込み | **S3 コネクタ**が FSx for ONTAP S3 Access Point に接続できるかが鍵 |
| Smart Parsing | データ型・コネクタごとに最適なパース戦略を自動選択（PDF・Office・テーブル・マルチモーダル） | 既存の手動チャンキング戦略選択を自動化できる可能性 |
| Agentic Retriever | 複雑なクエリをサブクエリに分解し、マルチホップ検索を反復実行 | Permission-aware の文脈で再認可が必要（後述） |
| マネージドベクトルストレージ | ベクトルDB のプロビジョニング不要。価格性能比最適化済み | OpenSearch Serverless / S3 Vectors の運用負荷が不要に |
| AgentCore Gateway 統合 | ビルトイン connector target（MCP）として公開。`Retrieve` と `AgenticRetrieveStream` の2ツール | 本プロジェクトの AgentCore Gateway（実装済み）と統合可能 |
| 既存 API 互換 | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` 等は同一 | KB ID 変更のみでコード変更不要（AWS の主張、要検証） |
| リージョン | 東京含む複数リージョンで GA | ap-northeast-1 デプロイと整合 |

### 価格モデル（Public evidence）

[AWS の説明](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/)によると、課金は2軸（インデックス済みデータサイズ + リトリーバル回数のオンデマンド）。事前コミットなし。

> ⚠️ **コスト見積もりの注意**: 上記は公開された価格モデルの構造であり、本プロジェクトのワークロードでの実コストは未測定。移行判断前に「現行（OpenSearch Serverless OCU / S3 Vectors ストレージ）」と「Managed KB（データサイズ + リトリーバル回数）」の単価比較を、想定クエリ量・データ量で実施すること。

---

## 2. 既存構成との比較

### 2.1 アーキテクチャ比較

| 観点 | 現行（Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors） | Managed KB |
|------|--------------------------------------------------------------|------------|
| ベクトルストア運用 | 自己管理（AOSS の OCU 設計 / S3 Vectors index 管理） | フルマネージド（プロビジョニング不要） |
| データソース | FSx ONTAP → S3 AP → Bedrock KB（`setup-kb-datasource.sh`） | S3 コネクタ経由（S3 AP 接続は要検証） |
| パース・チャンキング | `kbChunkingStrategy` で手動選択（FIXED/HIERARCHICAL/SEMANTIC/NONE） | Smart Parsing が自動選択（カスタマイズ可） |
| 埋め込みモデル | デプロイ時固定（`embeddingModel`、再作成で変更） | デフォルト自動選択 + 任意で Bedrock モデル指定 |
| リトリーバル | 単一 Retrieve + アプリ側 SID フィルタ | `Retrieve`（単一ハイブリッド）+ `AgenticRetrieveStream`（マルチホップ） |
| ACL フィルタ | アプリ側で `allowed_group_sids` を照合（ベクトルストア非依存） | metadata `filter` 演算子 + `userContext`（要検証） |
| Gateway 統合 | カスタム（実装済み AgentCore Gateway + Permission Interceptor） | ビルトイン connector target |
| 運用負荷 | 中（ベクトルストア・パイプライン設計が必要） | 低（マネージド） |
| カスタマイズ性 | 高（全コンポーネント制御可能） | 中（マネージド範囲内で調整） |

### 2.2 既存システムの SID フィルタリング方式（Project-context）

本プロジェクトは [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) のとおり、以下のベクトルストア非依存方式を採用している。

```
Bedrock KB Retrieve API → 検索結果 + メタデータ(allowed_group_sids)
→ アプリ側(route.ts)で ユーザーSID ∩ ドキュメントSID を照合
→ マッチしたドキュメントのみ Converse API へ
→ Fail-Closed: SID 取得不可なら全拒否
```

この方式の強みは、ベクトルストア（AOSS / S3 Vectors）を変えても**アプリ側の認可ロジックが不変**である点。Managed KB への移行でもこの不変条件を維持できるかが最重要論点となる。

---

## 3. 移行判断基準

「競合の置き換え」ではなく「用途に応じた選択（right tool for the job）」として整理する。両構成のトレードオフを対称に記載する。

### 3.1 Managed KB へ移行を検討すべきケース

- ベクトルストア（OpenSearch Serverless OCU / S3 Vectors index）の**運用・設計負荷を下げたい**
- Smart Parsing による**多形式ドキュメント（PDF・Office・テーブル）の自動パース**を活用したい
- Agentic Retriever による**マルチホップ・複雑クエリ**の精度向上を求める
- 新しい埋め込み・リランクモデルへ**インフラ再構築なしで追従**したい
- AgentCore Gateway 中心のアーキテクチャに統合し、**ビルトイン connector target** で接続を簡素化したい

### 3.2 現行構成を維持すべきケース

- **ファイルレベル ACL（NTFS / SID）を検索時に厳密適用する要件**があり、`allowed_group_sids` 照合の挙動を完全に制御したい
- 権限変更・削除・リネームの**即時反映ロジックを独自実装**している（Managed のマネージド同期で同等に保てるか未検証）
- ベクトルストアの **filter / ranking / reranking を細かく制御**したい
- マネージドストレージでの **ACL メタデータ保持・フィルタが未検証**な段階で、本番の Fail-Closed 保証を崩したくない
- データ主権・監査要件で**ベクトルデータの保存先を明示的に管理**する必要がある

### 3.3 判断フロー

```
ACL を検索時に厳密適用する必要があるか？
├─ YES → §4 の検証ポイントを全てクリアできるか？
│        ├─ YES → 段階的移行を検討（§5）
│        └─ NO  → 現行構成を維持（ACL 保証を優先）
└─ NO  → 運用負荷・精度を重視して Managed KB を優先検討
```

> ⚠️ 本プロジェクトの主目的は **Permission-aware RAG** であり、ACL 厳密適用は譲れない要件である。したがって §4 の検証をクリアしない限り、現行構成の維持が既定方針となる。

---

## 4. Permission-aware RAG への影響（最重要）

Managed KB のマネージドストレージで、本プロジェクトの SID ベース ACL フィルタを維持できるか。Public evidence と検証ポイントを整理する。

### 4.1 Public evidence: Managed KB のアクセス制御手段

[AgentCore Gateway connector target ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html) によると、Managed KB は2つのアクセス制御手段を持つ。

**(A) メタデータ `filter` 演算子（`Retrieve` ツール）**

`managedSearchConfiguration.filter` で以下の演算子が利用可能（出典の趣旨を要約）:
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains` が `allowed_group_sids`（配列）に対するユーザー SID 照合に使える可能性がある**。これは現行のアプリ側照合を、リトリーバル層に押し込める設計につながる。

**(B) `userContext` によるアクセス制御フィルタ**

ドキュメントによると、KB がユーザー/グループ単位のアクセス制御を行う場合、呼び出しアプリが `userContext`（例: `userId`）をリクエストに含める。Gateway はこれを KB に渡し、KB が `userContext` に基づきフィルタを適用する。重要な点として、**Gateway は呼び出し元の IAM アイデンティティから `userContext` を自動補完しない。アプリが明示的に渡す必要がある**。また、`userContext` は**モデルではなくアプリが付与する**ことが明記されている。

→ この「アプリが明示的に付与」「モデルに任せない」という設計は、本プロジェクトの **Fail-Closed・アプリ強制** の原則と方向性が一致する。

### 4.2 検証ポイント（移行前に必ず確認）

以下は全て**未検証**であり、移行可否を左右する。Project-context の想定を併記する。

| # | 検証項目 | 本プロジェクトの想定 | リスク |
|---|---------|---------------------|--------|
| V1 | S3 コネクタが **FSx ONTAP S3 Access Point** をデータソースにできるか（alias 形式・IAM 境界） | S3 互換なら接続可能と想定 | 接続不可なら移行自体が不成立 |
| V2 | `.metadata.json` の `allowed_group_sids` が Managed KB のインデックスに**メタデータとして保持**されるか | 保持されると想定 | 保持されないと ACL フィルタ不可 |
| V3 | `Retrieve` の `filter` で **`listContains` による SID 配列照合**が機能するか | 機能すると想定 | 機能しなければ userContext 方式へ切替 |
| V4 | `userContext` 方式が **S3 コネクタ取り込みデータ**でも有効か（SaaS コネクタ前提でないか） | S3 でも有効か不明 | S3 で無効なら filter 方式に依存 |
| V5 | **`AgenticRetrieveStream`（マルチホップ）の各ステップ**で ACL フィルタが適用されるか | 各ステップ適用が必要 | 中間ステップで権限外データが混入するリスク |
| V6 | マネージドストレージで**権限変更・削除・リネームの反映遅延**が許容範囲か | 既存同様の即時性を期待 | 反映遅延で旧権限のデータが残るリスク |
| V7 | 会話履歴・キャッシュへの **ACL 適用**が維持されるか | アプリ側で維持 | Managed 側キャッシュの挙動が不明 |

> ⚠️ **Non-negotiable**: V2・V3（または V4）・V5 のいずれかが未達なら、**権限外データが検索結果に混入する可能性**があるため移行は BLOCKED とする。FSxN AI/RAG アーキテクチャレビューの非交渉要件（「権限外データが vector search 結果に混入する可能性がある設計」「LLM に渡す context の認可チェックがない設計」）に抵触する。

### 4.3 多層防御の維持

移行する場合でも、単一手段に依存しない多層防御を維持する。

```
1. IdP / Cognito / AD によるユーザー認証
2. user principal / group SID の取得（DynamoDB user-access）
3. Managed KB retrieval 時の filter (listContains) または userContext
4. ★ LLM context 投入直前のアプリ側 ACL 再照合（現行 route.ts のロジックを維持）★
5. AgenticRetrieveStream 利用時は各ステップ後の再認可
6. 引用元リンク表示時の再認可
7. 監査ログ（誰が・いつ・どのSID由来の情報を利用したか）
```

→ Managed KB 側のフィルタを使う場合でも、**手順4（アプリ側の最終 ACL 照合）は残す**ことを強く推奨する。これにより、Managed 側フィルタの挙動が想定と異なっても Fail-Closed を担保できる。

---

## 5. 移行パス（段階的・既存パス維持）

既存の Dual KB 移行パターン（[migration-guide-multimodal.md](migration-guide-multimodal.md)）と同様、**並行運用**で段階的に検証する。既存パスは削除しない。

### Phase 0: PoC 検証（本番影響なし）

1. 小規模な検証用データセット（Snapshot / FlexClone 由来の一貫性あるデータ推奨）で Managed KB を作成
2. §4.2 の V1〜V7 を順に検証
3. SID フィルタリング（filter / userContext）の挙動を、[tests/permission-matrix/](../tests/permission-matrix/) の 31 シナリオ相当で確認

### Phase 1: 並行運用（Shadow）

1. 既存 KB を維持したまま、Managed KB を**読み取り専用のシャドウ**として並行運用
2. 同一クエリを両系統に投げ、検索結果・ACL フィルタ結果・引用整合性を比較
3. RAGAS 等（[evaluation.md](evaluation.md)）で精度・citation precision を比較

### Phase 2: 段階移行（カナリア）

1. AgentCore Gateway の A/B テスト（AgentCore Optimization — 本リポジトリに実装済み）で、一部トラフィックを Managed KB 経路へ
2. 権限テスト（Fail-Closed・group nesting・ACL edge cases）が全て pass することを確認
3. 統計的有意性を確認後、段階的にトラフィックを移行

### Phase 3: 切替判断

- 全検証クリア → Managed KB を既定経路に
- 未達項目あり → 現行構成を維持し、Managed KB はシャドウ継続 or 撤退

> 既存パス（Bedrock KB + OpenSearch Serverless / S3 Vectors）は、移行完了後も**ロールバック経路として一定期間維持**することを推奨。

---

## 6. 検証チェックリスト

移行判断前に以下を全て確認する。

### データ基盤
- [ ] V1: S3 コネクタで FSx ONTAP S3 AP をデータソース登録できる
- [ ] Snapshot / FlexClone 由来の一貫性あるデータで PoC を実施した
- [ ] 本番データを直接重いクロール対象にしていない

### Permission-aware RAG（最重要）
- [ ] V2: `allowed_group_sids` がメタデータとして保持される
- [ ] V3 or V4: `listContains` filter または `userContext` で SID フィルタが機能する
- [ ] V5: AgenticRetrieveStream の各ステップで ACL が適用される
- [ ] 多層防御の手順4（アプリ側最終照合）を維持している
- [ ] Fail-Closed: SID 取得不可時に全拒否となる
- [ ] 権限テスト 31 シナリオが全て pass

### データライフサイクル
- [ ] V6: 権限変更・削除・リネームの反映遅延が許容範囲
- [ ] V7: 会話履歴・キャッシュに ACL が適用される

### コスト・性能
- [ ] 現行 vs Managed KB の単価比較を実施（データサイズ + リトリーバル回数）
- [ ] 想定クエリ量での月額見積もりを作成

### 運用
- [ ] ロールバック手順（既存パスへの復帰）を runbook 化
- [ ] 監査ログで利用履歴を追跡できる

---

## 7. 推奨判定

**現時点の判定: REQUEST CHANGES（検証完了まで移行保留）**

解除条件:

1. §4.2 の検証ポイント V1〜V7 を PoC で確認
2. 特に **V2・V3（または V4）・V5** をクリア（未達なら BLOCKED）
3. 多層防御の手順4（アプリ側最終 ACL 照合）を維持する設計であること
4. コスト単価比較で現行より不利でない、または運用負荷削減がコスト増を上回ると判断できること

**判定の根拠:**

- Managed KB の運用負荷削減・Smart Parsing・Agentic Retriever は本プロジェクトにとって明確な価値がある（Public evidence）。
- 一方、本プロジェクトの**最優先要件は Permission-aware RAG の ACL 厳密適用**であり、マネージドストレージでの SID フィルタ挙動は**未検証**である。
- `userContext`（アプリ明示付与・モデル非依存）と `listContains` filter は方向性が一致しており、**検証次第で移行は十分に現実的**。

> このドキュメントは検討資料である。実際の移行は、上記検証を経て、関連レビュー（FSxN AI/RAG アーキテクチャレビュー）の承認を得てから実施すること。

---

## 関連ドキュメント

- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SID フィルタリングの基本設計
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID 統合
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — 既存スタック構成と KB クォータ
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids` メタデータスキーマ
- [migration-guide-multimodal.md](migration-guide-multimodal.md) — Dual KB 段階移行の参考パターン
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — 現行チャンキング戦略
- [evaluation.md](evaluation.md) — RAG 評価手法
