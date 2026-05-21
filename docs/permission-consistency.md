# 権限変更時の整合性モデル（Permission Consistency Model）

**🌐 Language:** **日本語** | [English](en/permission-consistency.md) | [한국어](ko/permission-consistency.md) | [简体中文](zh-CN/permission-consistency.md) | [繁體中文](zh-TW/permission-consistency.md) | [Français](fr/permission-consistency.md) | [Deutsch](de/permission-consistency.md) | [Español](es/permission-consistency.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: 運用設計者、セキュリティ担当者向け

---

## 概要

本ドキュメントは、FSx for ONTAP 上のファイル ACL が変更された際に、ベクトルストアや権限キャッシュにいつ・どのように反映されるかを明確にし、権限変更時の整合性保証レベルを定義します。

---

## 権限データフロー全体図

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        権限変更の伝播フロー                                    │
│                                                                              │
│  ① ACL変更          ② メタデータ再生成      ③ KB再同期           ④ キャッシュ  │
│                                                                    無効化    │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json 更新   │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ 変更     │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL期限 │  │
│                                                                  │切れ    │  │
│  管理者が           サービスロール          KB Auto-Sync          └────────┘  │
│  ファイル権限を      Lambda が              (EventBridge           5分TTL     │
│  変更               ACL を再取得           Scheduler)             で自動     │
│                                           または手動トリガー       無効化     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 各ステップの詳細

### ステップ①: ACL 変更（FSx for ONTAP）

| 操作 | 反映タイミング | 備考 |
|------|--------------|------|
| ファイルの ACL 変更 | 即時（FSx 上） | NTFS ACL は即座に FSx ボリュームに反映 |
| グループメンバーシップ変更 | AD 伝播後（通常 15 分以内） | AD レプリケーション遅延に依存 |
| ファイル移動（rename/move） | 即時（FSx 上） | 継承権限が再計算される |
| 継承権限の変更 | 即時（FSx 上） | 親フォルダの ACL 変更が子に伝播 |

### ステップ②: メタデータ再生成

`.metadata.json` の `allowed_group_sids` を更新する方法:

| 方式 | トリガー | 遅延 | 備考 |
|------|---------|------|------|
| Transfer Family 経由アップロード | ファイルアップロード時 | 即時 | `enableTransferFamily=true` 時。アップロードされたファイルのメタデータを自動生成 |
| AD Sync Lambda | 手動 / スケジュール | 設定による | `lambda/agent-core-ad-sync/` が NTFS ACL を再取得 |
| 手動更新 | 管理者操作 | 即時 | S3 バケットフォールバックパスの場合、直接 `.metadata.json` を更新 |

### ステップ③: ベクトルストア更新（KB 再同期）

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

### ステップ④: 権限キャッシュ無効化

| キャッシュ | TTL | 無効化方式 | 備考 |
|-----------|-----|-----------|------|
| DynamoDB `perm-cache` | 5 分 | TTL 自動期限切れ | フィルタリング結果のキャッシュ |
| DynamoDB `user-access` | なし（永続） | 明示的更新が必要 | ユーザー SID / グループ SID |
| ブラウザセッション | セッション中 | ログアウト / セッション期限切れ | フロントエンドのメモリキャッシュ |

---

## 最大権限遅延（Permission Propagation Delay）

### 通常運用時

```
ACL変更 → メタデータ再生成 → KB再同期 → キャッシュ期限切れ
  0分        0〜15分           1〜15分        0〜5分
                                              
最大遅延: 約35分（15分ポーリング + 15分KB同期 + 5分キャッシュ）
```

### RPO（Recovery Point Objective）的な表現

| シナリオ | 最大遅延 | 説明 |
|---------|---------|------|
| 通常運用（KB Auto-Sync 15分間隔） | 最大 35 分 | ポーリング間隔 + KB 同期 + キャッシュ TTL |
| 高頻度同期（KB Auto-Sync 5分間隔） | 最大 15 分 | ポーリング間隔短縮 |
| 手動即時同期 | 最大 10 分 | 手動 KB 同期 + キャッシュ TTL |
| 緊急権限剥奪 | 最大 5 分 | キャッシュ強制クリア + Fail-Closed |

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

---

## 権限変更シナリオ別の動作

### シナリオ 1: ファイルの ACL 変更

```
管理者がファイル A の ACL から User X を削除
  → .metadata.json の allowed_group_sids から User X の SID を削除
  → KB 再同期でベクトルストアのメタデータ更新
  → User X の次回検索でファイル A が結果から除外
```

**遅延**: 最大 35 分（通常運用時）

### シナリオ 2: AD グループメンバーシップ変更

```
管理者が User X を Engineering グループから削除
  → AD レプリケーション（〜15分）
  → DynamoDB user-access の groupSIDs 更新（AD Sync Lambda 実行時）
  → User X の次回検索で Engineering グループ限定ドキュメントが除外
```

**遅延**: AD レプリケーション + AD Sync Lambda 実行間隔 + キャッシュ TTL

### シナリオ 3: ファイル移動（rename / move）

```
管理者がファイル A を /public/ から /confidential/ に移動
  → FSx 上で継承権限が再計算
  → .metadata.json の再生成が必要
  → KB 再同期でベクトルストアのメタデータ更新
```

**注意**: ファイル移動時は `.metadata.json` の自動再生成が行われない場合があります。KB Auto-Sync のポーリングでファイルパス変更を検出し、メタデータ再生成をトリガーする設計を推奨します。

### シナリオ 4: 継承権限の変更

```
管理者が /confidential/ フォルダの ACL を変更（継承有効）
  → 配下の全ファイルの実効権限が変更
  → 各ファイルの .metadata.json 再生成が必要
  → KB 再同期
```

**注意**: 大量ファイルの一括権限変更は KB 同期に時間がかかります。段階的な変更を推奨します。

---

## 整合性保証レベル

| レベル | 保証内容 | 実装方式 |
|--------|---------|---------|
| **Fail-Closed** | SID 情報が取得できない場合は全拒否 | DynamoDB エラー時 / レコードなし時 |
| **Eventually Consistent** | ACL 変更は最終的に検索結果に反映 | KB Auto-Sync + キャッシュ TTL |
| **No False Positive** | 権限のないドキュメントは表示されない | SID マッチング（集合の積） |
| **Metadata Required** | メタデータなしドキュメントは除外 | `.metadata.json` 必須 |

### 注意: False Negative の可能性

以下のケースでは、本来アクセス可能なドキュメントが一時的に表示されない（False Negative）可能性があります:

- 権限付与直後（メタデータ未更新）
- KB 同期中（古いメタデータが残存）
- AD レプリケーション遅延中

**設計方針**: セキュリティ上、False Negative（見えるべきものが見えない）は許容し、False Positive（見えてはいけないものが見える）はゼロを目指します。

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
