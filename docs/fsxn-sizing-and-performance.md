# FSx for ONTAP 性能・容量設計ガイド

**🌐 Language:** **日本語** | [English](en/fsxn-sizing-and-performance.md) | [한국어](ko/fsxn-sizing-and-performance.md) | [简体中文](zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](zh-TW/fsxn-sizing-and-performance.md) | [Français](fr/fsxn-sizing-and-performance.md) | [Deutsch](de/fsxn-sizing-and-performance.md) | [Español](es/fsxn-sizing-and-performance.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: インフラ設計者、ストレージ管理者向け

---

## 概要

本ドキュメントは、Permission-aware RAG システムにおける FSx for ONTAP の性能・容量設計指針を提供します。ファイル数、ファイルサイズ、アクセス頻度、再同期頻度に応じた構成推奨を整理します。

---

## 規模別の想定構成

### 小規模（〜10,000 ファイル）— PoC / 部門利用

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| FSx throughput capacity | 128 MB/s | 最小構成 |
| SSD storage capacity | 1,024 GiB | 最小構成 |
| Capacity pool tiering | 有効 | コスト最適化 |
| ベクトルストア | S3 Vectors | 低コスト（月数ドル） |
| KB Auto-Sync 間隔 | 15 分 | デフォルト |
| 初回 indexing 時間 | 5〜15 分 | ドキュメントサイズに依存 |
| 月額概算（FSx のみ） | 約 $300〜$500 | throughput + SSD |

### 中規模（10,000〜100,000 ファイル）— 事業部 / 全社利用

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| FSx throughput capacity | 256〜512 MB/s | 同時アクセス数に応じて |
| SSD storage capacity | 2,048〜10,240 GiB | ホットデータ量に応じて |
| Capacity pool tiering | 有効 | コールドデータを自動階層化 |
| ベクトルストア | S3 Vectors or OpenSearch Serverless | QPS 要件に応じて選択 |
| KB Auto-Sync 間隔 | 5〜15 分 | 更新頻度に応じて |
| 初回 indexing 時間 | 30〜120 分 | 並列処理で短縮可能 |
| 月額概算（FSx のみ） | 約 $1,000〜$5,000 | throughput + SSD + capacity pool |

### 大規模（100,000〜1,000,000 ファイル）— エンタープライズ

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| FSx throughput capacity | 1,024〜4,096 MB/s | Multi-AZ + 高スループット |
| SSD storage capacity | 10,240+ GiB | ホットデータ量に応じて |
| Capacity pool tiering | 有効 | 大部分をキャパシティプールに |
| ベクトルストア | OpenSearch Serverless | 高 QPS、低レイテンシ |
| KB Auto-Sync 間隔 | 差分同期設計が必要 | 全件スキャンは非現実的 |
| 初回 indexing 時間 | 数時間〜1 日 | バッチ分割推奨 |
| 月額概算（FSx のみ） | 約 $5,000〜$30,000+ | 構成に大きく依存 |

---

## FSx for ONTAP の性能特性

### スループットキャパシティ

FSx for ONTAP のスループットキャパシティは、ファイルシステムレベルで設定します。

| スループット | 読み取り IOPS（SSD） | 書き込み IOPS | ネットワーク帯域 | 用途 |
|------------|---------------------|-------------|----------------|------|
| 128 MB/s | 6,000 | 1,500 | 最大 600 MB/s | PoC、小規模 |
| 256 MB/s | 12,000 | 3,000 | 最大 1.2 GB/s | 部門利用 |
| 512 MB/s | 40,000 | 10,000 | 最大 2.4 GB/s | 全社利用 |
| 1,024 MB/s | 80,000 | 20,000 | 最大 4.8 GB/s | 大規模 |
| 2,048 MB/s | 160,000 | 40,000 | 最大 9.6 GB/s | ミッションクリティカル |

> **参考**: Amazon FSx for ONTAP は最大 72 GB/s のスループット（12 HA ペア構成）をサポートしています。

### ストレージ階層化（Capacity Pool Tiering）

| 階層 | 特性 | コスト | 用途 |
|------|------|--------|------|
| SSD | サブミリ秒レイテンシ | 高 | 頻繁にアクセスされるファイル |
| Capacity Pool | 数十ミリ秒レイテンシ | 低（SSD の約 1/10） | アーカイブ、低頻度アクセス |

**RAG システムでの推奨**:
- `.metadata.json` と頻繁に検索されるドキュメント → SSD 階層
- アーカイブドキュメント、古いバージョン → Capacity Pool

**Tiering ポリシー**:
- `auto`: 一定期間アクセスがないデータを自動的に Capacity Pool に移動（推奨）
- `snapshot-only`: スナップショットデータのみ Capacity Pool に移動
- `all`: 全データを Capacity Pool に移動（コスト最優先）
- `none`: 全データを SSD に保持（性能最優先）

---

## S3 Access Point 利用時の考慮点

### パフォーマンス特性

FSx for ONTAP の S3 Access Point は、FSx ボリューム上のファイルを S3 互換インターフェースで公開します。

| 操作 | レイテンシ | スループット | 備考 |
|------|-----------|------------|------|
| ListObjectsV2 | 数百ミリ秒 | — | ファイル数に比例 |
| GetObject（小ファイル） | 数十〜数百ミリ秒 | — | SSD 階層の場合 |
| GetObject（大ファイル） | ファイルサイズに比例 | FSx throughput に依存 | ストリーミング |
| HeadObject | 数十ミリ秒 | — | メタデータのみ |

### Bedrock KB 同期時の負荷

KB 同期（StartIngestionJob）実行時、Bedrock は S3 Access Point 経由で全ドキュメントを読み取ります。

| ドキュメント数 | 同期時の読み取り負荷 | 推奨 throughput |
|--------------|-------------------|---------------|
| 〜1,000 | 低（数 GB） | 128 MB/s で十分 |
| 〜10,000 | 中（数十 GB） | 256 MB/s 推奨 |
| 〜100,000 | 高（数百 GB） | 512 MB/s 以上推奨 |

### Dual-Layer Authorization

S3 Access Point 経由のアクセスには 2 層の認証が必要です:

1. **IAM 認証**: S3 Access Point ポリシー + IAM identity-based policy
2. **ファイルシステム認証**: NTFS ACL（Windows ユーザーマッピング）

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   両方 Allow → アクセス成功
```

---

## ベクトルストア選定基準

### S3 Vectors vs OpenSearch Serverless

| 観点 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| コスト（小規模） | 月数ドル | 月 $700+（最小 2 OCU） |
| コスト（大規模） | ベクトル数に比例 | OCU 数に比例 |
| クエリレイテンシ | コールド: サブ秒、ウォーム: 〜100ms | 常時 〜50ms |
| 最大ベクトル数 | 10,000 indexes/bucket | 実質無制限 |
| メタデータフィルタ | 2KB/vector（filterable） | 制限緩い |
| スケーラビリティ | 自動 | OCU 手動/自動スケール |
| 運用負荷 | ほぼゼロ | OCU 監視が必要 |
| エクスポート | → OpenSearch Serverless（ワンクリック） | — |

### 選定フローチャート

```
同時ユーザー数 < 10 かつ ドキュメント数 < 10,000?
  → Yes: S3 Vectors（コスト最優先）
  → No:
    レイテンシ要件 < 100ms?
      → Yes: OpenSearch Serverless
      → No:
        月額予算 < $1,000?
          → Yes: S3 Vectors（レイテンシ許容）
          → No: OpenSearch Serverless
```

### 移行パス

S3 Vectors → OpenSearch Serverless への移行は、コンソールからワンクリックでエクスポート可能です（所要時間: 約 15 分）。逆方向の移行は KB 再同期で実現します。

---

## 初回 Indexing 設計

### 推奨アプローチ

| ドキュメント数 | 方式 | 備考 |
|--------------|------|------|
| 〜1,000 | 一括 KB 同期 | `StartIngestionJob` 1 回で完了 |
| 〜10,000 | 一括 KB 同期 | 同期完了まで待機（30〜60 分） |
| 〜100,000 | バッチ分割 | データソースを分割し、段階的に同期 |
| 100,000+ | 段階的投入 | フォルダ単位で投入 → 同期を繰り返す |

### 初回 Indexing 時の注意点

1. **FSx throughput の一時的な増加**: 初回 indexing 時は読み取り負荷が高いため、throughput capacity を一時的に引き上げることを検討
2. **S3 Access Point の同時接続**: Bedrock KB は並列でファイルを読み取るため、FSx の同時接続数に注意
3. **`.metadata.json` の事前準備**: 全ドキュメントの `.metadata.json` が揃っていることを確認してから同期開始
4. **同期中のファイル変更**: 同期中にファイルが変更されると不整合が発生する可能性。初回は変更凍結を推奨

---

## 差分同期（Incremental Sync）設計

### KB Auto-Sync の動作

`enableKbAutoSync=true` で有効化される差分同期の仕組み:

```
EventBridge Scheduler (5〜15分間隔)
  → Lambda: ListObjectsV2 で S3 AP のファイル一覧取得
  → DynamoDB: 前回のインベントリと比較
  → 変更検出時のみ: StartIngestionJob 実行
  → IN_PROGRESS ジョブがある場合: スキップ（重複排除）
```

### 差分検出の仕組み

| 検出対象 | 方式 | 備考 |
|---------|------|------|
| 新規ファイル | LastModified 比較 | DynamoDB インベントリに存在しないキー |
| 更新ファイル | ETag / LastModified 比較 | 値が変更されたキー |
| 削除ファイル | インベントリ差分 | DynamoDB に存在するが S3 AP に存在しないキー |

### 大規模環境での差分同期の課題

| ファイル数 | ListObjectsV2 所要時間 | 対策 |
|-----------|----------------------|------|
| 〜10,000 | 数秒 | 問題なし |
| 〜100,000 | 数十秒 | Lambda タイムアウト延長（15 分） |
| 100,000+ | 数分以上 | プレフィックス分割、Step Functions 化 |

---

## QoS（Quality of Service）設計

マルチテナントや複数ワークロードが FSx を共有する場合、QoS ポリシーで性能を制御できます。

### 推奨 QoS 設定

| ワークロード | 優先度 | IOPS 上限 | スループット上限 |
|------------|--------|----------|----------------|
| RAG 検索（S3 AP 経由） | 高 | 制限なし | 制限なし |
| KB 同期（バッチ） | 中 | 5,000 IOPS | 100 MB/s |
| ユーザー CIFS/SMB アクセス | 高 | 制限なし | 制限なし |
| バックアップ / SnapMirror | 低 | 2,000 IOPS | 50 MB/s |

### QoS ポリシーの適用

```bash
# ONTAP CLI で QoS ポリシーグループを作成
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# ボリュームに QoS ポリシーを適用
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## 容量監視と自動拡張

### 監視メトリクス

| メトリクス | 閾値 | アクション |
|-----------|------|-----------|
| SSD 使用率 | > 80% | 容量拡張 or Tiering ポリシー見直し |
| Capacity Pool 使用率 | > 90% | 容量拡張 |
| IOPS 使用率 | > 80% | throughput capacity 引き上げ |
| ネットワーク帯域使用率 | > 70% | throughput capacity 引き上げ |

### 自動拡張（FSx ONTAP Ops）

本プロジェクトの `automation/fsxn-ops/` に含まれる容量監視 Lambda が自動拡張を実行します:

- EventBridge 5 分間隔でボリューム使用率を監視
- 閾値超過時に自動でボリュームサイズを拡張
- Capacity Guardrails（日次上限、クールダウン期間）で過剰拡張を防止
- CloudWatch Dashboard で拡張履歴を可視化

---

## コスト最適化のポイント

### 1. Capacity Pool Tiering の活用

RAG で検索対象となるドキュメントの多くは、一度 embedding されれば頻繁にはアクセスされません。Tiering ポリシー `auto` を設定し、アクセス頻度の低いデータを自動的に低コスト階層に移動します。

### 2. throughput capacity の適正化

初回 indexing 後は読み取り負荷が大幅に減少します。初回は高い throughput で同期し、運用フェーズでは低い throughput に変更することでコストを削減できます。

```bash
# throughput capacity の変更（ダウンタイムなし）
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. S3 Vectors の活用

小〜中規模環境では S3 Vectors（月数ドル）を使用し、OpenSearch Serverless（月 $700+）のコストを回避します。性能要件が高まった場合はワンクリックでエクスポート可能です。

---

## FlexCache + S3 Access Point の制約と代替パス

### 現状の制約（2026年5月時点）

| 項目 | 状態 | 影響 |
|------|------|------|
| FlexCache Cache ボリュームでの S3 AP | **未対応** | FlexCache 経由のデータに S3 API でアクセスできない |
| FlexCache Origin ボリュームでの S3 AP | **対応** | Origin ボリュームに直接 S3 AP をアタッチ可能 |
| S3 AP 経由のファイルサイズ上限 | **5 GB** | 大容量ファイルは分割が必要 |
| S3 AP 経由の rename / append | **未対応** | PutObject で新規作成のみ |

### 代替パス

FlexCache Cache ボリュームのデータを RAG に取り込む場合:

```
パターン A: Embedding サーバー経由（CIFS マウント）
  FlexCache Cache Volume → CIFS マウント → Embedding EC2 → OpenSearch Serverless
  ✅ FlexCache の読み取り高速化を活用
  ❌ OpenSearch Serverless 構成が必要（月 $700+）

パターン B: Origin ボリュームに S3 AP をアタッチ
  Origin Volume → S3 Access Point → Bedrock KB
  ✅ S3 Vectors（低コスト）が使用可能
  ❌ FlexCache の読み取り高速化は RAG パスでは不使用

パターン C: DataSync で S3 に同期
  FlexCache Cache Volume → DataSync → S3 Bucket → Bedrock KB
  ✅ 任意のベクトルストアが使用可能
  ❌ データの二重管理、同期遅延
```

### S3 AP パフォーマンス特性

> **注記**: 以下は特定のテスト環境（ap-northeast-1、128 MB/s throughput、SINGLE_AZ_1）での参考値です。実際のパフォーマンスはファイルシステム構成、ネットワーク条件、同時アクセス数により変動します。本番環境では必ず実測に基づいて設計してください。

| 操作 | オブジェクトサイズ | 参考レイテンシ（P50） | 備考 |
|------|-----------------|---------------------|------|
| ListObjectsV2 | — | 100-300ms | プレフィックス内のオブジェクト数に依存 |
| GetObject | 1 KB | 50-150ms | 小ファイルはオーバーヘッドが相対的に大きい |
| GetObject | 1 MB | 100-300ms | throughput capacity に依存 |
| PutObject | 1 KB | 100-200ms | メタデータ書き込み含む |
| PutObject | 100 MB | 1-5s | throughput capacity に依存 |

**NFS/SMB との共有スループット**: S3 AP 経由のアクセスは FSx ONTAP の throughput capacity を NFS/SMB と共有します。大量の S3 AP アクセスが NFS/SMB のパフォーマンスに影響する可能性があるため、ピーク時の同時アクセスパターンを考慮して throughput capacity を設計してください。

### データ鮮度と SnapMirror RPO

RAG 検索結果に反映されるまでの最大遅延は以下の合計です:

```
最大遅延 = SnapMirror 同期間隔 + KB Auto-Sync ポーリング間隔 + インジェスション処理時間

例（DR読み取りパス分離構成）:
  SnapMirror RPO: 15分
  KB Auto-Sync: 5分
  インジェスション: 1-5分
  → 最大遅延: 21-25分

例（直接S3 APアクセス構成）:
  SnapMirror: なし（同一ボリューム）
  KB Auto-Sync: 5分
  インジェスション: 1-5分
  → 最大遅延: 6-10分
```

顧客に「ファイルを更新してからRAGに反映されるまでの時間」を説明する際は、この最大遅延を明示してください。CloudTrail モード（イベント駆動）を使用すると、ポーリング間隔分の遅延を削減できます。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [permission-consistency.md](permission-consistency.md) | 権限変更時の整合性モデル |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID アーキテクチャ |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3 構成比較表 |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx ONTAP 運用自動化 |
