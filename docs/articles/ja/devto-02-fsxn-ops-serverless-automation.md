---
title: "FSx for ONTAP S3 Access Point でサーバーレス運用自動化 — AI データパイプライン・容量監視・SnapMirror DR"
published: false
description: "S3 Access Point で FSx for ONTAP の NAS データに Lambda から直接アクセス。NFS マウント不要で AI 前処理・容量ガードレール・SnapMirror DR を自動化。月額 $2.60 のサーバーレスコスト。"
tags: aws, amazonfsxfornetappontap, serverless, lambda
series: "Permission-Aware RAG with FSx for ONTAP"
cover_image: https://raw.githubusercontent.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/main/docs/screenshots/v4-kb-mode-ja.png
---

## TL;DR

- FSx for ONTAP の **S3 Access Point** を「サーバーレス自動化の境界」として活用
- データ移動なし — NAS データに S3 互換 API（`ListObjectsV2`, `GetObject`, `PutObject`）でアクセス
- Lambda + Step Functions + EventBridge で AI 前処理・容量監視・SnapMirror DR を自動化
- サーバーレスコンピュート月額 **~$2.60**（EventBridge 5 分間隔 = 1 日 288 回実行前提。VPC エンドポイント別）
- 全コード OSS: [`automation/fsxn-ops/`](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/tree/main/automation/fsxn-ops)

---

## S3 Access Point がサーバーレス NAS 自動化を可能にする

従来、FSx for ONTAP のファイルデータを Lambda で操作するには NFS マウントが必要でした。VPC 接続、コールドスタートペナルティ、接続数制限 — サーバーレスの利点を殺す制約です。

**S3 Access Point はこの制約を解消します。** ONTAP のファイルデータを S3 オブジェクト API 経由で公開し、SMB/NFS の並行アクセスを維持したまま、Lambda から直接データパス操作が可能になります。

これにより実現するパターン:

| パターン | S3 AP の役割 | ONTAP REST API の役割 |
|---------|-------------|---------------------|
| AI/RAG 前処理 | ファイル一覧取得・コンテンツ読み取り | ACL・セキュリティスタイル取得 |
| 権限メタデータ自動生成 | `.metadata.json` 書き込み | NTFS ACL 読み取り |
| 容量監視 | — | ボリューム使用率取得・リサイズ |
| SnapMirror DR | — | フェイルオーバー/フェイルバック制御 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  Orchestration: EventBridge Scheduler / Step Functions │
├─────────────────────────────────────────────────────┤
│  Compute: Lambda (Python 3.12, VPC)                  │
├────────────────────┬────────────────────────────────┤
│  Data Path:        │  Control Plane:                 │
│  S3 Access Point   │  ONTAP REST API                 │
│  (List/Get/Put)    │  (volumes, SnapMirror, ACLs)    │
├────────────────────┴────────────────────────────────┤
│  Storage: FSx for ONTAP (SMB/NFS + S3 AP)           │
└─────────────────────────────────────────────────────┘
```

**設計原則**: S3 AP = データパス、ONTAP REST API = コントロールプレーン。Lambda は NFS/SMB をマウントしません。

---

## 1. AI データ前処理: S3 AP ワークフロー

Permission-Aware RAG の核となるパイプラインです。S3 AP 経由でファイル一覧を取得し、ONTAP REST API で ACL メタデータを収集、`.metadata.json` を自動生成します。

```python
# S3 AP: ファイル一覧取得
response = s3.list_objects_v2(Bucket=s3_access_point_arn, Prefix="docs/")

# ONTAP REST: セキュリティスタイル・ACL取得
vol_detail = ontap.get_volume(vol_uuid)
security_style = vol_detail["nas"]["security_style"]

# S3 AP: 権限メタデータ書き込み
s3.put_object(Bucket=s3_ap_arn, Key="docs/report.md.metadata.json", Body=metadata_json)
```

**生成されるメタデータ**:
```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-5-21-xxx-512\", \"S-1-1-0\"]",
    "access_level": "confidential"
  }
}
```

これにより手動の `.metadata.json` 管理が不要に — ONTAP の NTFS ACL から自動生成されます。

---

## 2. 容量監視 + Capacity Guardrails

EventBridge Scheduler で 5 分間隔実行。FSx API + CloudWatch + ONTAP REST API でファイルシステム/ボリュームレベルの使用率を監視し、安全な自動拡張を実行します。

| ガードレール | デフォルト | 目的 |
|-------------|-----------|------|
| `DRY_RUN` | `true` | **安全なデフォルト** — ログのみ、実行なし |
| `MAX_GROW_PER_ACTION_PCT` | 50% | 1 回の実行でボリュームを倍増させない |
| `MAX_GROW_PER_DAY_GIB` | 500 GiB | 日次の合計拡張上限 |
| `VOL_THRESHOLD_PCT` | 80% | AWS 推奨の SSD 使用率上限に準拠 |
| `BREAK_GLASS` | `false` | 緊急時のガードレール一時解除（SNS 通知 + 監査ログ必須） |

DynamoDB でアトミックに日次累積を追跡し、並行実行時のレースコンディションを防止。

---

## 3. SnapMirror フェイルオーバー自動化（ボリュームレベル）

Step Functions ステートマシンで 10 アクションを制御:

```
Initialize → Quiesce → Break → Mount exports → Activate CIFS shares
  ↕ (Failback: reverse)
Resume → Resync → Delete temp exports
```

> **スコープ**: ボリューム単位の計画フェイルオーバー/フェイルバックです。SVM-DR（ID 保持、LIF・エクスポートポリシー・CIFS サーバー構成のレプリケーション含む）とは異なり、本自動化はボリュームデータのみを対象とします。SVM 全体の DR が必要な場合は [ONTAP SVM-DR ドキュメント](https://docs.netapp.com/us-en/ontap/data-protection/snapmirror-svm-replication-concept.html) を参照してください。

**検証知見（ONTAP 9.17.1P4D3）**:
- `create` with `state: "snapmirrored"` は事前作成済みの dest ボリュームでジョブ失敗 → 明示的 `POST /transfers` にフォールバック
- 両パスを実装済み（初期化セマンティクスは ONTAP バージョンに依存）

---

## ネットワーク: プライベートサブネット設計

NAT Gateway なしでの運用に必要な VPC エンドポイント:

| サービス | タイプ | 理由 |
|---------|--------|------|
| `secretsmanager` | Interface | ONTAP 認証情報 |
| `fsx` | Interface | FSx API |
| `monitoring` | Interface | CloudWatch メトリクス |
| `sns` | Interface | アラート通知 |
| `s3` | Gateway | S3 AP データパス（時間課金なし） |

> S3 Gateway エンドポイントは Lambda サブネットのルートテーブルに関連付けが必要。

---

## コスト

| コンポーネント | 月額 |
|--------------|------|
| Lambda (4 関数) | ~$1.65 |
| Step Functions | ~$0.05 |
| EventBridge Scheduler | ~$0.00 |
| Secrets Manager | ~$0.40 |
| CloudWatch Logs | ~$0.50 |
| **サーバーレス小計** | **~$2.60** |
| VPC Interface Endpoints (4 × ~$7.30/AZ) | ~$29-58 |
| **合計（専用エンドポイント込み）** | **~$32-61** |

> VPC エンドポイントが既存環境に存在する場合、追加コストはサーバーレス小計のみ。

---

## テスト

```bash
# ユニットテスト（38 テスト）
pip install -r automation/fsxn-ops/requirements.txt
pytest automation/fsxn-ops/tests/ -v

# AWS 統合テスト（自動デプロイ → テスト → クリーンアップ）
bash automation/fsxn-ops/tests/integration/run_aws_verification.sh
```

---

## 実装時のハマりポイント

| 問題 | 原因 | 対策 |
|------|------|------|
| SNS Publish がタイムアウト | VPC 内 Lambda に SNS エンドポイントなし | `sns` Interface Endpoint 追加 |
| ONTAP REST API で 401 | コンソールでパスワード変更、Secrets Manager 未更新 | Secrets Manager を正として運用 |
| S3 AP 経由の ListObjects 失敗 | S3 Gateway Endpoint が Lambda サブネットのルートテーブルに未関連付け | ルートテーブル確認 |
| TLS 検証エラー | FSx for ONTAP 管理 LIF は自己署名証明書（2026 年 6 月時点） | 本番: CA バンドル指定 / PoC: `verify_ssl=False`（将来 CA 発行証明書対応の可能性あり — 公式ドキュメントを確認） |

---

## 拡張パターン

### 権限メタデータ自動パイプライン

```
EventBridge (日次)
  → S3 AP: ListObjectsV2 → ファイル一覧
  → ONTAP REST: ACL 取得
  → .metadata.json 生成
  → S3 AP: PutObject
  → Bedrock KB Ingestion Job トリガー
```

手動の `.metadata.json` 管理を排除し、ONTAP ACL を権限の源泉とする自動化パイプライン。

### マルチボリューム並列取り込み

```
Step Functions Map:
  → ボリュームごと: S3 AP スキャン → メタデータ生成 → KB Ingestion
  → 全完了待ち → ベクトル数検証 → 通知
```

---

## 代替アプローチとの比較

容量監視や DR 自動化にはいくつかの方法があります。用途に応じて選択してください:

| アプローチ | 適するケース | トレードオフ |
|-----------|-------------|-------------|
| **本システム（S3 AP + ONTAP REST + Lambda）** | FSx for ONTAP 固有のメタデータ（ACL、セキュリティスタイル）と S3 データパスを組み合わせた自動化が必要 | ONTAP REST API の知識が必要。S3 AP の対応 API サブセットに制約あり |
| **CloudWatch Agent + アラーム** | シンプルな閾値監視とアラートのみで十分 | ボリュームレベルの詳細監視や ACL メタデータ取得は不可。自動拡張ロジックは別途実装が必要 |
| **AWS Backup** | バックアップ/リストアが主目的で SnapMirror 不要 | ボリュームレベルの計画フェイルオーバー/フェイルバック自動化は対象外 |
| **AWS DataSync** | FSx for ONTAP からの定期データ同期（S3/EFS 先）が目的 | リアルタイム性は低い。ONTAP ストレージメタデータは同期されない |

> 本システムは「FSx for ONTAP の S3 AP + ONTAP REST API を活用したい」場合に選択肢となるアプローチです。シンプルな監視のみであれば CloudWatch アラーム単体でも十分に機能します。

---

## まとめ

FSx for ONTAP S3 Access Point は、NAS データへのサーバーレス自動化の「境界」です:

- **AI パイプライン**: ファイルデータに S3 API でアクセス + ONTAP REST API でストレージメタデータ取得
- **容量管理**: ガードレール付き安全な自動拡張
- **DR**: ボリュームレベル SnapMirror の計画フェイルオーバー/フェイルバック

サーバーレスコスト ~$2.60/月。コードは OSS で CloudFormation ワンコマンドデプロイ。

👉 **コード**: [`automation/fsxn-ops/`](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG/tree/main/automation/fsxn-ops)
📖 **全体プロジェクト**: [Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG)

---

*Yoshiki Fujiwara — AWS Community Builder*
