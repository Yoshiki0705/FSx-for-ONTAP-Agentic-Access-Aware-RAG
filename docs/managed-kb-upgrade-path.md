# Amazon Bedrock Managed Knowledge Base アップグレードパス（検証手順）

**🌐 Language:** **日本語** | [English](en/managed-kb-upgrade-path.md) | [한국어](ko/managed-kb-upgrade-path.md) | [简体中文](zh-CN/managed-kb-upgrade-path.md) | [繁體中文](zh-TW/managed-kb-upgrade-path.md) | [Français](fr/managed-kb-upgrade-path.md) | [Deutsch](de/managed-kb-upgrade-path.md) | [Español](es/managed-kb-upgrade-path.md)

**作成日**: 2026-06-18
**対象リージョン**: ap-northeast-1 (東京) — Managed KB は東京リージョンで利用可能（2026-06-17 GA）
**ステータス**: 検証手順ドキュメント（移行未実施 / 既存パス維持）
**関連**: [Managed KB 移行パス検討](managed-kb-migration-evaluation.md)（判断基準・トレードオフ）

---

## 0. このドキュメントの位置づけ

本ドキュメントは、[Managed KB 移行パス検討](managed-kb-migration-evaluation.md) で整理した検証ポイントを、**実際に検証するための手順**に落とし込んだものである。判断基準・トレードオフの議論は移行パス検討ドキュメントを参照し、本書は「どう検証するか」に focus する。

重要な前提:

- 本ドキュメントは**検証手順書**であり、移行を即時推奨するものではない。
- 既存パス（Bedrock KB + OpenSearch Serverless / S3 Vectors）は**削除しない**。並列オプションとしての追加検証である。
- Managed KB が従来型 KB より「優れている」わけではない。**用途に応じた選択**であり、本プロジェクトの主目的である Permission-aware RAG の要件（ACL 厳密適用）を満たせるかが移行可否を決める。
- 記載内容のエビデンス階層を以下に分類する。

| 階層 | 定義 | 本書での扱い |
|------|------|------------|
| Public evidence | AWS 公式ドキュメント・ブログから検証可能 | 出典リンク付きで記載 |
| Project-context expectation | 本プロジェクト内の設計判断・期待値（公開検証不可） | 「本プロジェクトの想定」と明示 |

> ⚠️ **Validation Required**: 本書の検証手順は、AWS 公式チュートリアル（[従来型 KB 向け](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)）を Managed KB 向けに**読み替えた前提**を含む。Managed KB の S3 コネクタが FSx for ONTAP S3 Access Point を認識するかは公式に未確認であり、検証 V1 でこれを最初に確かめる必要がある。

---

## 1. 検証の全体像

移行可否を判断するための検証は、以下の3フェーズで構成する。各フェーズは前フェーズの成功を前提とする。

```
Phase A: 接続検証（V1, V2）
  └─ S3 AP をデータソースにできるか / メタデータが保持されるか
       │ PASS
       ▼
Phase B: 認可検証（V3, V4, V5）
  └─ ACL フィルタが機能するか / マルチホップで維持されるか / 反映遅延
       │ PASS
       ▼
Phase C: 監査・運用検証（V6, V7）
  └─ lineage 記録 / 会話履歴・キャッシュの ACL
       │ PASS
       ▼
移行可否判断（移行パス検討ドキュメント §5 へ）
```

> いずれのフェーズも、**本番データではなく FlexClone で作成した検証用ボリューム**に対して実施する（§4 参照）。

---

## 2. Phase A: S3 Access Point データソース接続検証

### 2.1 検証 V1: S3 コネクタが S3 AP URI を認識するか

⚠️ **Validation Required**: 公式チュートリアルは従来型 KB 向けであり、Managed KB の S3 コネクタが S3 AP の alias 形式 URI を受け付けるかは未確認。

**前提準備**:

1. FlexClone で検証用ボリュームを作成（§4 の手順）
2. 検証用ボリュームに対する S3 Access Point を作成（既存 `setup-kb-datasource.sh` のロジックを参照）
3. S3 AP alias を確認（形式: `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` または ARN）

**検証手順**:

```bash
# 1. Managed KB を作成（マネージドベクトルストレージ）
#    ⚠️ 以下は想定コマンド。Managed KB の正確な API パラメータは GA ドキュメントで要確認
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ managed storage の指定方法は要確認

# 2. S3 コネクタをデータソースとして追加し、S3 AP URI を指定
#    検証の核心: S3 AP の alias 形式 / ARN 形式のどちらが受理されるか
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ ここが受理されるかが V1 の本質
    }
  }'
```

**判定基準**:

| 結果 | 判定 | 次のアクション |
|------|------|--------------|
| S3 AP ARN/alias が受理され、同期が成功 | ✅ PASS | V2 へ |
| S3 AP は不可だが通常 S3 バケットなら可 | △ 条件付き | DataSync 等で S3 中継パスを検討（ACL メタデータ保持に追加検証必要） |
| S3 コネクタ自体が同期失敗 | ❌ FAIL | 移行不成立。現行構成を維持 |

> **本プロジェクトの想定**: S3 互換 API であれば接続可能と想定するが、S3 AP 固有の制約（[FSx for ONTAP S3 AP 互換性マトリクス](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/ja/compatibility-matrix.md) 記載の ListObjectsV2 レイテンシ等）が Managed KB のクローラに影響する可能性がある。

### 2.2 検証 V2: メタデータの保持

**検証手順**:

1. 検証用ボリュームに `.metadata.json`（`allowed_group_sids` を含む）を配置
2. Managed KB の同期を実行
3. `Retrieve` API でドキュメントを取得し、レスポンスにメタデータが含まれるか確認

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "テストクエリ"}' \
  --region ap-northeast-1
# レスポンスの metadata フィールドに allowed_group_sids が含まれるかを確認
```

**判定基準**:

| 結果 | 判定 |
|------|------|
| `allowed_group_sids` がメタデータとして保持され取得可能 | ✅ PASS → Phase B へ |
| メタデータが欠落または別形式に変換される | ❌ FAIL → ACL フィルタ不可。現行構成を維持 |

> ⚠️ Managed KB の Smart Parsing がメタデータをどう扱うかは未確認。`.metadata.json` の sidecar 方式が従来型 KB と同様に機能するか、それとも別のメタデータ付与方式（コネクタ属性等）が必要かを確認する。

---

## 3. Phase B: Permission-aware RAG 設計課題の検証

本プロジェクトの主目的は Permission-aware RAG であり、ACL 厳密適用は譲れない要件である。Phase B の検証をクリアしない限り、現行構成の維持が既定方針となる。

### 3.1 既存方式との不変条件

現行は[ベクトルストア非依存方式](s3-vectors-sid-architecture-guide.md)を採用している。

```
Bedrock KB Retrieve → 検索結果 + allowed_group_sids
→ アプリ側(route.ts)で ユーザーSID ∩ ドキュメントSID を照合（Fail-Closed）
→ マッチしたドキュメントのみ Converse API へ
```

**移行時に維持すべき不変条件**: 「アプリ側で最終的な認可を強制し、SID 取得不可なら全拒否（Fail-Closed）」。Managed KB がこの不変条件を崩さないかを検証する。

### 3.2 検証 V3: `listContains` による SID 配列照合

[AgentCore Gateway connector target ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html) によると、Managed KB の `Retrieve` ツールは `managedSearchConfiguration.filter` で `listContains` 演算子をサポートする（出典の趣旨を要約）。

**検証手順**:

```bash
# ユーザーの SID が allowed_group_sids 配列に含まれるドキュメントのみ取得
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "機密文書テスト"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**判定基準**:

| テストケース | 期待結果 |
|-------------|---------|
| ユーザー SID が配列に含まれる文書 | 取得される |
| ユーザー SID が配列に含まれない文書 | 除外される |
| `allowed_group_sids` が欠落した文書 | 除外される（Fail-Closed） |

> ⚠️ **重要**: `listContains` がリトリーバル層でフィルタしても、本プロジェクトの設計原則は**アプリ側での再認可**である。Managed KB の filter を「一次フィルタ」として使い、最終認可はアプリ側で維持する二層防御を推奨する（filter のみに依存しない）。

### 3.3 検証 V4: Agentic Retrieval マルチホップ中のフィルタ維持

これが Managed KB 固有の最大リスクである。`AgenticRetrieveStream` はクエリをサブクエリに分解し、複数回の検索を反復する。**各ホップでメタデータフィルタが維持されないと、中間ステップで権限外データが混入する**。

**検証手順**:

1. 権限の異なる複数文書をまたぐ必要のある複雑クエリを用意（例: 「部門Aの機密設計書と公開仕様書を比較して」）
2. 権限外文書（部門Aの機密）にアクセスできないユーザーで `AgenticRetrieveStream` を実行
3. 各ホップのトレース（CloudWatch / レスポンスの中間ステップ）を確認し、権限外文書が**どのホップでも参照されていない**ことを検証

**判定基準**:

| 結果 | 判定 |
|------|------|
| 全ホップで `userContext` / filter が適用され、権限外データ非参照 | ✅ PASS |
| 中間ホップでフィルタが脱落し権限外データが混入 | ❌ FAIL → マルチホップは無効化、単一 `Retrieve` のみ使用 |

> ⚠️ **Validation Required**: マルチホップ各ステップへのフィルタ伝播は公式に明示されていない。検証で確認できない場合、`AgenticRetrieveStream` を使わず単一 `Retrieve` + アプリ側照合に限定する（マルチホップの利点を放棄してでも ACL 保証を優先）。

### 3.4 検証 V5: 権限変更・削除の反映遅延

**検証手順**:

1. ユーザーの SID をグループから削除（または文書の `allowed_group_sids` を変更）
2. Managed KB の同期完了後、当該ユーザーで再検索
3. 旧権限のデータが返らなくなるまでの遅延を計測

**判定基準**: 反映遅延が本プロジェクトの[権限整合性モデル](permission-consistency.md)で定義する許容範囲内か。範囲外なら、緊急失効（emergency revocation）はアプリ側キャッシュ無効化で別途担保する設計が必要。

---

## 4. FlexClone を使った安全な検証パターン

本番データを直接 Managed KB のクロール対象にしてはならない。FlexClone で本番相当の検証用ボリュームを作成し、隔離された環境で検証する。

### 4.1 なぜ FlexClone か

| 観点 | 直接本番アクセス | FlexClone 検証 |
|------|----------------|---------------|
| 本番 I/O への影響 | クロール負荷が業務ワークロードに影響 | 影響なし（クローンは独立） |
| データ一貫性 | クロール中の更新で不整合の可能性 | ポイントインタイムで一貫 |
| 検証の再現性 | 本番データ変動で再現困難 | 同一スナップショットから何度でも再現 |
| 誤操作リスク | 本番データへの誤書き込みリスク | クローンは破棄可能 |
| コスト | — | スナップショット差分のみ（初期は数MB） |

### 4.2 検証用クローン作成手順

```bash
# 1. 本番ボリュームのスナップショットを作成（ONTAP REST API / CLI）
#    ⚠️ ONTAP 管理エンドポイントへのアクセスは VPC 内から実施
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. スナップショットから FlexClone を作成
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. クローンボリュームに対する S3 Access Point を作成
#    （既存 setup-kb-datasource.sh のロジックを検証用に流用）

# 4. 検証完了後、クローンを破棄（本番に影響なし）
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> 正確な ONTAP REST API パラメータは [運用 Runbook](operations-runbook.md) の ONTAP 操作セクションを参照。SSH 鍵・管理エンドポイント情報は本番手順に従う。

### 4.3 検証環境の隔離原則

- 検証用 Managed KB は本番 KB とは**別リソース**として作成し、本番 KB ID を変更しない
- 検証用 S3 AP は検証用クローンのみを指す（本番ボリューム非参照）
- 検証用 IAM ロールは検証リソースに**最小権限**でスコープする（本番データへの読み取り権限を付与しない）
- 検証完了後はクローン・KB・S3 AP・IAM ロールを全て破棄

---

## 5. 監査・lineage 検証（Phase C / Optional）

⚠️ **Validation Required**: Managed KB 経由のアクセスが、連携先（[fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)）の Unity Catalog lineage に記録されるかは未確認。

**検証観点**:

- Managed KB の `Retrieve` / `AgenticRetrieveStream` 呼び出しが CloudTrail に記録されるか
- 「誰が・いつ・どの文書由来の情報を・どの回答で使ったか」を追跡できるか
- 会話履歴・キャッシュへの ACL 適用がアプリ側で維持されるか（Managed 側キャッシュの挙動が不明なため、アプリ側で明示的に制御）

監査要件の詳細は [ガバナンス・監査設計](governance-and-audit.md) を参照。

---

## 6. 検証ステータス更新（2026-07-19）

### 現行構成の E2E 検証結果から得られた知見

2026-07-19 の E2E デプロイ検証で、以下が確認された。これらは Managed KB 移行検討時の前提条件に影響する。

| 知見 | Managed KB への影響 |
|------|---------------------|
| **S3 AP + AD-joined SVM**: AD DC 到達不能で S3 AP 作成 FAILED | Managed KB の S3 コネクタも同じ制約を受ける可能性大。V1 検証時に考慮 |
| **Permission Filter (Fail-Closed)**: `allowed_group_sids` メタデータなしのドキュメントは即拒否 | Managed KB でもアプリ側 Fail-Closed は維持必須。`listContains` を KB 側で使う場合でも、アプリ側の再認可レイヤーは残す |
| **Inference Profile 必須化**: 全 ACTIVE Anthropic モデルが `INFERENCE_PROFILE` のみ | Managed KB + Agentic Retriever もモデル呼び出しに Inference Profile が必要。IAM ポリシーに `inference-profile/*` 含める |
| **Bedrock KB Retrieve API**: メタデータは `retrievalResults[].metadata` で返却 | Managed KB の `managedSearchConfiguration.filter` と現行のアプリ側照合は相補的に使える |

### 移行判断の現時点ステータス

```
Phase A (接続検証): V1 FAIL
  - V1 S3 AP → Managed KB S3 コネクタ: ❌ FAIL (2026-07-19 検証済み)
    → Managed KB (type=MANAGED) は S3 データソースタイプを受け付けない
    → エラー: "Unsupported data source type for MANAGED knowledge base type"
    → Managed KB は独自の Managed Data Source コネクタのみ対応
  - V2 allowed_group_sids メタデータ保持: ❓ V1 FAIL のため検証不能

Phase B (認可検証): ブロック (V1 FAIL)
Phase C (監査検証): ブロック (V1 FAIL)
```

**判定 (2026-07-19)**: **V1 FAIL — 現行構成を維持**

Managed KB は FSx for ONTAP S3 Access Point をデータソースとして直接使用できない。
これは本プロジェクトの基本アーキテクチャ（FSx for ONTAP → S3 AP → KB）と互換性がない。

**今後の選択肢**:
1. **現行構成維持（推奨）**: Bedrock KB (type=VECTOR) + S3 Vectors / OpenSearch Serverless + アプリ側 SID フィルタリング
2. **Managed KB のデータコネクタ調査**: Managed KB が将来的に S3 AP をサポートする可能性を追跡
3. **ハイブリッド構成**: 一部クエリ（マルチホップ、複雑推論）に Managed KB を使い、FSx データは DataSync で同期

> **Note**: Managed KB 自体は正常に動作する（`type: MANAGED` で KB 作成 → ACTIVE 状態確認済み）。
> 制約は「データソースタイプの互換性」にのみ存在する。

---

## 7. 検証チェックリスト（サマリ）

移行可否判断の前に、以下を全てクリアすること。

- [ ] **V1**: S3 コネクタが FSx for ONTAP S3 AP を認識（Phase A）
- [ ] **V2**: `allowed_group_sids` がメタデータとして保持（Phase A）
- [ ] **V3**: `listContains` で SID 配列照合が機能（Phase B）
- [ ] **V4**: Agentic Retrieval マルチホップ中もフィルタ維持（Phase B）
- [ ] **V5**: 権限変更・削除の反映遅延が許容範囲内（Phase B）
- [ ] **V6**: CloudTrail / lineage に記録（Phase C）
- [ ] **V7**: 会話履歴・キャッシュへの ACL 適用維持（Phase C）
- [ ] 全検証を **FlexClone 検証用ボリューム**で実施（本番非影響）
- [ ] アプリ側 Fail-Closed 再認可の不変条件を維持

> いずれかが FAIL の場合、当該リスクを許容できる設計補完がない限り、**現行構成（OpenSearch Serverless / S3 Vectors）の維持**が既定方針となる。CDK スタックへの Managed KB 統合は全検証クリア後に着手する。

---

## 8. 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [Managed KB 移行パス検討](managed-kb-migration-evaluation.md) | 判断基準・トレードオフ・既存構成比較 |
| [CDKスタック アーキテクチャガイド](stack-architecture-comparison.md) | ベクトルストア構成比較（Managed KB 列含む） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID フィルタリング設計 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | ベクトルストア非依存の認可方式 |
| [権限整合性モデル](permission-consistency.md) | ACL 変更反映フロー・許容遅延 |
| [ガバナンス・監査設計](governance-and-audit.md) | 監査ログ・lineage 要件 |
| [運用 Runbook](operations-runbook.md) | ONTAP 操作（FlexClone 作成手順） |

---

## 参考リンク

- [Amazon Bedrock Managed Knowledge Base GA アナウンス](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [AWS 公式チュートリアル（従来型 KB）](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway connector target（Managed KB）](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> Content was rephrased for compliance with licensing restrictions. AWS 公式情報は出典の趣旨を保ちつつ要約・言い換えしている。
