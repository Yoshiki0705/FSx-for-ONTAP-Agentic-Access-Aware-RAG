# 権限メタデータ変更の整合性モデル（Permission Metadata Consistency Model）

**🌐 Language:** **日本語** | [English](en/permission-consistency.md) | [한국어](ko/permission-consistency.md) | [简体中文](zh-CN/permission-consistency.md) | [繁體中文](zh-TW/permission-consistency.md) | [Français](fr/permission-consistency.md) | [Deutsch](de/permission-consistency.md) | [Español](es/permission-consistency.md)

**作成日**: 2026-05-21
**更新日**: 2026-09-07（実装確認にもとづき、ACL 起点の自動反映フローの記述を撤回）
**ステータス**: ドラフト
**対象**: 運用設計者、セキュリティ担当者向け

---

## 概要

本ドキュメントは、検索時の権限判定に使われるデータが変更されたとき、検索結果にいつ反映されるかを定義します。判定に使われるのは 2 つで、文書側の `.metadata.json` と、利用者側の DynamoDB `user-access` です。

**FSx for ONTAP 上のファイルの NTFS ACL 変更を、自動で追随する機構はありません。** 権限索引は ACL の射影ではなく、別に構築・保守される索引です。理由と運用上の含意は「ACL 変更が届かない理由」に書きます。

---

## 権限判定に使われるデータ

| データ | 保持場所 | 生成・更新の主体 | 検索時の役割 |
|-------|---------|---------------|------------|
| `.metadata.json`（`allowed_group_sids` / `allowed_uids` / `allowed_gids`） | S3 AP 上の隣接オブジェクト → Bedrock KB のメタデータ属性 | 経路ごとに異なる（下表） | 取得チャンクの許可 SID / UID / GID 集合 |
| `user-access`（`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`） | DynamoDB | AD / LDAP 同期 Lambda（`lambda/agent-core-ad-sync/`） | 呼び出し元の SID / UID / GID 集合 |
| `perm-cache` | DynamoDB（TTL 5 分） | 権限フィルタ | 判定結果のキャッシュ |

`.metadata.json` の生成元:

| 経路 | 生成元 | 契機 |
|------|-------|------|
| Transfer Family SFTP（`enableTransferFamily=true`） | 管理者が保守する DynamoDB マッピング（アップロードユーザー名がキー） | ファイルアップロード時 |
| 自前埋め込みサーバー（`ENV_AUTO_METADATA=true`、任意・非既定） | ONTAP REST API で実 NTFS ACL を取得 | 未処理ファイルの検出時（mtime 判定） |
| デモ環境 | リポジトリ同梱のサンプルを手動配置 | 手動 |

SFTP ユーザーには `*.metadata.json` への IAM Deny が付与されており、アップロード者が自分の権限を書けない構造になっています。

---

## 反映経路

自動で反映される経路は 2 系統です。

### 経路 A: 文書側の権限変更

| 段 | 担い手 | 遅延 |
|----|-------|------|
| ① `.metadata.json` の更新 | 上表の生成元、または管理者による直接更新 | 契機依存 |
| ② 差分検出 | KB Auto-Sync（EventBridge Scheduler、`size` / `lastModified` / `ETag` の比較） | ポーリング間隔（既定 15 分） |
| ③ ベクトルストア更新 | `StartIngestionJob` | 1〜15 分（件数依存） |
| ④ 判定結果キャッシュの失効 | `perm-cache` の TTL | 最大 5 分 |

### 経路 B: 利用者側の権限変更

| 段 | 担い手 | 遅延 |
|----|-------|------|
| ① AD グループメンバーシップの変更 | AD レプリケーション | 通常 15 分以内 |
| ② `user-access` の更新 | AD / LDAP 同期 Lambda。**Cognito の PostAuthentication / PostConfirmation トリガー契機で、スケジュール実行はありません** | 対象利用者の次回サインインまで（不定） |
| ③ 判定結果キャッシュの失効 | `perm-cache` の TTL、または `user-access` の DynamoDB Streams による明示的無効化 | 最大 5 分 |

経路 B の ② は、セッションが継続している利用者には届きません。剥奪を確実に行う場合は「緊急権限剥奪手順」を使います。

---

## ACL 変更が届かない理由

ファイルの NTFS ACL を変更しても、どのデプロイ構成でも `.metadata.json` は再生成されません。実装の確認結果は次のとおりです。

| 機構 | ACL 変更で走るか | 根拠 |
|------|---------------|------|
| AD / LDAP 同期 Lambda | 走らない | ACL 取得も `.metadata.json` 書き込みも実装されていない。取得するのは AD 上のユーザー SID のみ |
| Transfer Family のメタデータ生成 | 走らない | 契機はファイルアップロード。生成元は管理者保守の DynamoDB マッピングで、ACL を参照しない |
| 自前埋め込みサーバー（`ENV_AUTO_METADATA=true`） | 走らない | 再処理の判定が `mtime`。ACL のみの変更は `mtime` を動かさない |
| KB Auto-Sync | 走らない | 差分判定が `size` / `lastModified` / `ETag`。ACL 変更はいずれも動かさない |
| FSx 権限サービス（`lambda/permissions/fsx-permission-service.ts`） | 対象外 | ACL を読むコードは存在するが、どの CDK スタックからもデプロイされていない |

**含意**: ACL 変更を検索結果に反映するには、運用者が `.metadata.json` を作り直して S3 AP に置く必要があります。この索引の正しさは運用に依存し、ACL との一致は自動では保証されません。緊急のアクセス停止は、ACL 変更ではなく利用者側（`user-access` の削除 + キャッシュクリア + セッション無効化）で行ってください。

---

## 各段の詳細

### ベクトルストア更新（KB 再同期）

| 方式 | トリガー | 遅延 | 備考 |
|------|---------|------|------|
| KB Auto-Sync | EventBridge Scheduler（ポーリング） | 設定間隔（デフォルト: 15 分） | `enableKbAutoSync=true` 時。ファイル変更検出時のみ StartIngestionJob 実行 |
| 手動 KB 同期 | AWS コンソール / CLI | 即時開始、完了まで数分 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail イベント | S3 PutObject | 数分 | Transfer Family パスで `enableCloudTrailIngestion=true` 時 |

**KB 同期の所要時間目安:**

| ドキュメント数 | 同期時間（目安） |
|--------------|----------------|
| 〜100 件 | 1〜3 分 |
| 〜1,000 件 | 5〜15 分 |
| 〜10,000 件 | 30〜60 分 |
| 〜100,000 件 | 数時間（差分同期推奨） |

### 権限キャッシュ無効化

| キャッシュ | TTL | 無効化方式 | 備考 |
|-----------|-----|-----------|------|
| DynamoDB `perm-cache` | 5 分 | TTL 自動期限切れ / `user-access` の Streams による明示的削除 | フィルタリング結果のキャッシュ |
| DynamoDB `user-access` | なし（永続） | 明示的更新が必要 | ユーザー SID / グループ SID |
| ブラウザセッション | セッション中 | ログアウト / セッション期限切れ | フロントエンドのメモリキャッシュ |

---

## 最大遅延（Permission Propagation Delay）

| 起点 | 最大遅延 | 内訳 |
|------|---------|------|
| 文書側の権限変更（経路 A、Auto-Sync 15 分間隔） | 約 35 分 | ポーリング 15 分 + KB 同期 15 分 + キャッシュ 5 分 |
| 文書側の権限変更（Auto-Sync 5 分間隔） | 約 25 分 | ポーリング 5 分 + KB 同期 15 分 + キャッシュ 5 分 |
| 文書側の権限変更（手動 KB 同期） | 約 20 分 | KB 同期 15 分 + キャッシュ 5 分 |
| 利用者側の権限変更（経路 B） | 定義不可 | AD レプリケーション 15 分 + 次回サインインまで（不定）+ キャッシュ 5 分 |
| 緊急権限剥奪（下記手順） | 最大 5 分 | キャッシュ強制クリア + Fail-Closed |
| ファイルの ACL 変更 | **定義不可** | 自動で追随する機構がない。運用者による `.metadata.json` 再生成が前提 |

KB 同期の 15 分はドキュメント数に依存します（上表の所要時間目安を参照）。1 万件規模では 30〜60 分となり、合計遅延はその分伸びます。

---

## 緊急権限剥奪手順

ユーザーのアクセス権限を即座に剥奪する必要がある場合:

### 手順 1: DynamoDB からユーザー SID を削除（即時効果）

```bash
# ユーザーの SID データを削除 → Fail-Closed により全ドキュメント拒否
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 手順 2: 権限キャッシュを強制クリア

```bash
# 該当ユーザーのキャッシュエントリを削除
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### 手順 3: Cognito ユーザーを無効化（セッション無効化）

```bash
# Cognito ユーザーを無効化
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 効果

- 手順 1 実行後: 新規検索リクエストは即座に全ドキュメント拒否（Fail-Closed）
- 手順 2 実行後: キャッシュされた古い権限情報が使われることを防止
- 手順 3 実行後: ユーザーのセッション自体を無効化

**この手順が文書側ではなく利用者側を止めていることに注意してください。** 特定の文書だけを 1 人から隠す操作は、`.metadata.json` の更新と KB 再同期を待つため経路 A の遅延を受けます。

---

## 権限変更シナリオ別の動作

### シナリオ 1: 文書の権限メタデータの変更

```
管理者がファイル A の .metadata.json から User X の SID を削除
  → KB Auto-Sync が差分を検出（ETag 変化）
  → StartIngestionJob でベクトルストアのメタデータ更新
  → perm-cache の TTL 失効後、User X の検索でファイル A が除外
```

**遅延**: 最大約 35 分（Auto-Sync 15 分間隔時）

### シナリオ 2: AD グループメンバーシップ変更

```
管理者が User X を Engineering グループから削除
  → AD レプリケーション（〜15 分）
  → User X の次回サインインで AD 同期 Lambda が user-access の groupSIDs を更新
  → perm-cache 失効後、Engineering 限定ドキュメントが除外
```

**遅延**: AD レプリケーション + 次回サインインまで（不定）+ キャッシュ TTL。**セッションが継続している間は反映されません。** 即時性が必要な場合は緊急権限剥奪手順を使います。

### シナリオ 3: ファイル移動（rename / move）

```
管理者がファイル A を /public/ から /confidential/ に移動
  → FSx 上で継承権限が再計算される（ONTAP 側の実効権限のみ）
  → .metadata.json は移動先の権限に自動追随しない
  → 運用者が .metadata.json を再生成して配置する必要がある
```

**注意**: 移動元の許可 SID が残るため、移動しただけでは検索上の可視性は変わりません。ディレクトリ構成を権限境界として使う運用では、移動と `.metadata.json` 更新を 1 つの手順にまとめてください。

### シナリオ 4: 親フォルダの ACL 一括変更

```
管理者が /confidential/ フォルダの ACL を変更（継承有効）
  → 配下の全ファイルの ONTAP 上の実効権限が変更
  → .metadata.json は追随しない（「ACL 変更が届かない理由」参照）
  → 配下ファイル分の .metadata.json 再生成 + KB 再同期が必要
```

**注意**: 大量ファイルの一括変更は KB 同期に時間がかかります。段階的な変更を推奨します。

---

## 整合性保証レベル

| レベル | 保証内容 | 実装方式 |
|--------|---------|---------|
| **Fail-Closed** | SID 情報が取得できない場合は全拒否 | DynamoDB エラー時 / レコードなし時 |
| **Eventually Consistent** | 権限メタデータ（`.metadata.json` / `user-access`）の変更は最終的に検索結果に反映 | KB Auto-Sync + キャッシュ TTL + Streams 無効化 |
| **No False Positive** | 権限のないドキュメントは表示されない | SID マッチング（集合の積） |
| **Metadata Required** | メタデータなしドキュメントは除外 | `.metadata.json` 必須 |
| **ACL 追随の不成立** | ファイルの ACL 変更は自動反映されない | 運用者による `.metadata.json` 再生成が前提 |

### 注意: False Negative の可能性

以下のケースでは、本来アクセス可能なドキュメントが一時的に表示されない（False Negative）可能性があります:

- 権限付与直後（`.metadata.json` 未更新、または KB 再同期前）
- KB 同期中（古いメタデータが残存）
- AD レプリケーション遅延中、または対象利用者が再サインインする前

**設計方針**: セキュリティ上、False Negative（見えるべきものが見えない）は許容し、False Positive（見えてはいけないものが見える）はゼロを目指します。

ただし、**この方針は権限索引が正しいことを前提にしています。** ACL を絞ったのに `.metadata.json` を更新していない場合、索引側は依然として許可を返すため、False Positive が発生します。索引の保守が境界そのものです。

---

## 監視・アラート推奨設定

```yaml
# CloudWatch Alarm 推奨設定
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # キャッシュミス率が高い = 権限データ更新頻度が高い

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 3回連続失敗でアラート

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID解決失敗は即時アラート

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed発動が多い場合は調査必要
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID フィルタリング設計詳細 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 本番化チェックリスト |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能・容量設計 |
