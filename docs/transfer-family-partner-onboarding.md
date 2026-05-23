# Transfer Family パートナーオンボーディングガイド

**🌐 Language:** **日本語** | [English](en/transfer-family-partner-onboarding.md)

**最終更新**: 2026-05-23  
**対象**: 外部パートナー（法律事務所、監査法人、規制機関等）のSFTPアクセス設定

---

## 概要

このガイドでは、AWS Transfer Family を使用して外部パートナーがSFTP経由でドキュメントをアップロードし、Permission-aware RAG Knowledge Base に自動取り込みされるまでの設定手順を説明します。

### アーキテクチャ

```
パートナー (SFTP) → Transfer Family → FSx ONTAP S3 AP → Metadata Generator → Bedrock KB
```

パートナーはSFTPクライアントのみで操作可能です。Web UIやAWSコンソールへのアクセスは不要です。

---

## 1. 前提条件

### システム管理者側

- [x] `enableTransferFamily=true` でCDKデプロイ済み
- [x] S3 Access Point が FSx ONTAP ボリュームにアタッチ済み
- [x] DynamoDB 権限マッピングテーブルにパートナーの権限設定を登録済み

### パートナー側

- [x] SFTPクライアント（FileZilla, WinSCP, OpenSSH等）
- [x] SSH鍵ペア（RSA 4096bit または Ed25519）

---

## 2. SSH鍵の準備

### パートナーが鍵を生成する場合

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

生成された **公開鍵** (`~/.ssh/transfer-family-key.pub`) をシステム管理者に送付してください。

> **セキュリティ注意**: 秘密鍵 (`~/.ssh/transfer-family-key`) は絶対に共有しないでください。

### システム管理者が鍵を登録する場合

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. SFTP接続パラメータ

パートナーに以下の接続情報を提供してください:

| パラメータ | 値 |
|-----------|-----|
| ホスト | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| ポート | `22` |
| プロトコル | SFTP |
| ユーザー名 | `partner-a`（管理者が割り当て） |
| 認証方式 | SSH公開鍵認証 |
| ホームディレクトリ | `/uploads/partner-a/` |

### 接続コマンド（OpenSSH）

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### FileZilla設定

1. **サイトマネージャー** → 新しいサイト
2. プロトコル: **SFTP**
3. ホスト: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. ログオンタイプ: **鍵ファイル**
5. ユーザー: `partner-a`
6. 鍵ファイル: 秘密鍵のパスを指定

### WinSCP設定

1. **新しいセッション**
2. ファイルプロトコル: **SFTP**
3. ホスト名: Transfer Family エンドポイント
4. ユーザー名: `partner-a`
5. **詳細設定** → SSH → 認証 → 秘密鍵ファイルを指定

---

## 4. ファイルアップロード手順

### ディレクトリ構造

パートナーのホームディレクトリは `/uploads/partner-a/` に制限されています。

```
/uploads/partner-a/
├── contracts/          ← 契約書
├── reports/            ← レポート
├── correspondence/     ← 通信文書
└── misc/               ← その他
```

### アップロード操作

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### ファイル命名規則

| ルール | 説明 |
|--------|------|
| 拡張子 | `.pdf`, `.docx`, `.txt`, `.md`, `.html` を推奨 |
| ファイル名 | 英数字、ハイフン、アンダースコアを使用 |
| サイズ上限 | 5 GB（S3 Access Point の制限） |
| 禁止操作 | ファイル名変更（rename）、追記（append）は未対応 |

### 制限事項

- **`.metadata.json` ファイルの作成・変更・削除は禁止**されています（IAM Deny）
- 権限メタデータはシステムが自動生成します
- ファイルの rename/append 操作は S3 Access Point の制限により未対応です

---

## 5. インジェスション確認

アップロード後、以下のタイムラインで処理されます:

| ステップ | 所要時間 | 説明 |
|---------|---------|------|
| ファイル検出 | 最大5分 | EventBridge Scheduler によるポーリング |
| メタデータ生成 | 数秒 | `.metadata.json` 自動生成 |
| KB インジェスション | 1-5分 | Bedrock Knowledge Base への取り込み |
| RAG検索可能 | 即時 | インジェスション完了後 |

### 確認方法（システム管理者向け）

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. トラブルシューティング

### 接続できない

| 症状 | 原因 | 対処 |
|------|------|------|
| `Permission denied (publickey)` | SSH鍵が未登録または不一致 | 管理者に公開鍵の再登録を依頼 |
| `Connection timed out` | ネットワーク制限（IP許可リスト） | 管理者にIPアドレスの追加を依頼 |
| `no matching host key type found` | HostKeyAlgorithms 不一致 | `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` を追加 |

### アップロードできない

| 症状 | 原因 | 対処 |
|------|------|------|
| `Permission denied` on `put` | ホームディレクトリ外へのアクセス | `/uploads/partner-a/` 配下にアップロード |
| `Permission denied` on `.metadata.json` | IAM Deny ポリシー | メタデータファイルの操作は禁止（正常動作） |
| `File too large` | 5GB制限超過 | ファイルを分割してアップロード |

### ファイルがRAGに反映されない

| 症状 | 原因 | 対処 |
|------|------|------|
| 5分以上経過しても反映されない | ポーリング間隔待ち or Lambda エラー | 管理者に CloudWatch Logs の確認を依頼 |
| インジェスションジョブが FAILED | ファイル形式未対応 | 対応形式（PDF, DOCX, TXT, MD, HTML）を確認 |

---

## 7. セキュリティモデル

### パートナーのアクセス範囲

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### 権限メタデータの自動生成

パートナーがファイルをアップロードすると、システムが自動的に `.metadata.json` を生成します:

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

この権限情報は DynamoDB の管理者設定テーブルから導出されます。パートナーが直接権限を指定することはできません。

---

## 8. 管理者向け: パートナー追加手順

### 新規パートナーの追加

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### パートナーの無効化

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## 関連ドキュメント

- [Transfer Family E2E 検証レポート](transfer-family-e2e-verification.md)
- [Transfer Family ネットワーキング前提条件](transfer-family-networking-prerequisites.md)
- [AWS Transfer Family + FSx S3 AP ドキュメント](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
