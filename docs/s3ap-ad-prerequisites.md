# FSx for ONTAP S3 Access Point + AD 前提条件ガイド

**🌐 Language:** **日本語** | [English](en/s3ap-ad-prerequisites.md)

**作成日**: 2026-07-13
**検証環境**: ap-northeast-1 (東京), ONTAP 9.17.1P7D1
**ステータス**: E2E 検証済み

---

## 概要

Amazon FSx for NetApp ONTAP の S3 Access Point (以下 FSx for ONTAP S3 AP) を AD参加 SVM 上で使用する場合、特有の前提条件と制約がある。本ドキュメントはこれらの知見を整理し、運用チームが迅速にトラブルシューティングできるようにするものである。

---

## 重要な制約: AD DC 到達性

### 根本原因

AD参加 SVM (CIFS有効) では、**全ての S3 AP データ操作** (ListObjectsV2, GetObject, PutObject) で ONTAP が `unix→win` 逆引きネームマッピングを実行する。このマッピングには AD DC への LDAP/Kerberos 接続が必須。

AD DC が到達不能な場合、データ操作は `AccessDenied` を返す。

### 紛らわしい診断パターン

| テスト | AD DC 到達可能 | AD DC 到達不能 |
|--------|:---:|:---:|
| HeadBucket | ✅ 成功 | ✅ 成功 (false positive) |
| ListObjectsV2 | ✅ 成功 | ❌ AccessDenied |
| GetObject | ✅ 成功 | ❌ AccessDenied |
| PutObject | ✅ 成功 | ❌ AccessDenied |

> **HeadBucket は信頼できるヘルスチェックではない**: HeadBucket は S3 レイヤーで AP の存在のみ検証し、ファイルシステムレイヤーを経由しない。HeadBucket 成功はデータ操作の成功を保証しない。

### 誤診断の典型パターン

1. ListObjectsV2 が AccessDenied → IAM ポリシーを調査
2. IAM ポリシーは正しい → S3 AP リソースポリシーを調査
3. AP ポリシーも正しい → ネットワーク設定を調査
4. VPC Endpoint / Security Group も正しい → **原因不明で行き詰まる**

実際の原因: SVM から AD DC への接続が失われている。

---

## 推奨アーキテクチャパターン

### Internet-origin AP + VPC外 Lambda (検証済み推奨)

```
Lambda (VPC外) → Internet-origin S3 AP → FSx for ONTAP Volume
                                          ↕
                                     AD DC (VPC内)
```

- S3 AP: `NetworkOrigin: Internet` (VpcConfiguration なし)
- Lambda: `VpcConfig` なし (VPC外で実行)
- 同一アカウント: `put_access_point_policy` 不要 (IAM identity policy で十分)

### VPC-origin AP (環境依存で問題あり)

```
Lambda (VPC内) → S3 Gateway EP → VPC-origin S3 AP → FSx for ONTAP Volume
```

VPC-origin AP + VPC内 Lambda + S3 Gateway Endpoint の組み合わせでは、環境依存で AccessDenied が発生するケースが確認されている。Internet-origin パターンを推奨する。

---

## S3 AP リソースポリシー

### 同一アカウントアクセス

同一 AWS アカウント内のアクセスでは、S3 AP リソースポリシーは**不要**。IAM identity policy (`s3:ListBucket`, `s3:GetObject` on AP ARN) のみで十分。

AP リソースポリシーが必要なケース:
- クロスアカウントアクセス
- 条件キーの使用 (`aws:PrincipalAccount`, `s3:DataAccessPointAccount`)
- IAM 許可を超えたアクセス制限

---

## FSx API 同期遅延

### FlexClone 作成後の発見遅延

FlexClone を作成した後、FSx API (`DescribeVolumes`) がそのボリュームを認識するまで **12〜36 分** の遅延がある (実測、増加傾向)。

### Step Functions での推奨タイミングバジェット

```
FlexClone 作成 → 静的 Wait (10分)
  → ポーリングループ (120秒間隔 × 最大25回 = 50分)
  → 合計 60分バジェット
```

ONTAP REST API での即座の確認は可能だが、FSx API レベルでの確認が必要な場合はこのバジェットを想定する。

---

## FSx 自動管理の Name-Mapping

S3 AP を FSx for ONTAP ボリュームにアタッチすると、FSx は SVM 上に `s3_unix` direction のネームマッピングエントリを**自動作成**する:

```
s3_unix: amazon-fsx-<RANDOM> → <FileSystemIdentity で指定した UNIX ユーザー>
```

このマッピングは AP デタッチ時に自動削除される。**手動でのネームマッピング設定は不要。**

---

## AD DC 必須ポート

SVM ENI から AD DC への接続に必要なポート:

| ポート | プロトコル | サービス |
|--------|-----------|---------|
| 53 | TCP/UDP | DNS |
| 88 | TCP/UDP | Kerberos |
| 389 | TCP/UDP | LDAP |
| 445 | TCP | SMB/CIFS |
| 636 | TCP | LDAPS |
| 3268 | TCP | Global Catalog |

---

## トラブルシューティング手順

### S3 AP AccessDenied の切り分け

```bash
# Step 1: HeadBucket で S3 レイヤーの疎通確認
aws s3api head-bucket --bucket <S3_AP_ARN>
# 成功 → S3 レイヤーは OK

# Step 2: ListObjectsV2 でデータ操作を試行
aws s3api list-objects-v2 --bucket <S3_AP_ARN> --max-keys 1
# AccessDenied → ファイルシステムレイヤーの問題

# Step 3: HeadBucket=OK + ListObjectsV2=AccessDenied → AD DC 問題
# ONTAP REST API で DC 検出を確認:
curl -k -u admin:pass \
  "https://<MGMT_LIF>/api/protocols/cifs/domains?svm.name=<SVM>&fields=discovered_servers"
# discovered_servers が空 = AD DC 到達不能
```

### AD DC 到達性の回復

1. **Security Group 確認**: SVM ENI の SG が AD DC への上記ポートを許可しているか
2. **NACL 確認**: SVM サブネットの NACL がトラフィックをブロックしていないか
3. **DNS 確認**: SVM の DNS 設定が AD DC を解決できるか
4. **AD DC 状態確認**: AD DC 自体が起動しているか (AWS Managed AD の場合は Service Health Dashboard)

### Lambda ログでの AD 問題検出

本システムの Lambda (KB Auto-Sync, Transfer Family Ingestion Trigger) は、AccessDenied 発生時に以下の診断ログを出力する:

```json
{
  "message": "S3 AP AccessDenied — AD DC到達性問題の可能性",
  "headBucketOk": true,
  "likelyAdIssue": true,
  "guidance": "HeadBucketが成功しListObjectsV2がAccessDeniedの場合..."
}
```

`likelyAdIssue: true` が出力された場合、IAM/ポリシーではなく AD DC 到達性を調査する。

---

## 環境変数リファレンス

AD DC 診断を有効にするためのオプション環境変数:

| 環境変数 | 用途 | 設定先 |
|---------|------|--------|
| `SVM_ID` | FSx API 経由の AD 参加状態確認 | KB Auto-Sync, Transfer Family Lambda |

`SVM_ID` が設定されている場合、AccessDenied 発生時に FSx `DescribeStorageVirtualMachines` API で SVM の AD 設定を確認し、より精度の高い診断を提供する。

---

## 関連ドキュメント

- [S3 Vectors + SIDフィルタリング アーキテクチャガイド](s3-vectors-sid-architecture-guide.md)
- [Global Steering: FSx for ONTAP AD Integration](~/.kiro/steering/global-fsx-ontap-ad-integration.md) (ローカル)
- [AWS Docs: FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/accessing-data-via-s3-access-points.html)
