# ONTAP REST API セットアップガイド

## 概要

このPermission APIは、**ONTAP REST API**を使用してFSx for NetApp ONTAPの権限情報を取得します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│              Lambda: Permission API                          │
│  - Node.js 20.x                                              │
│  - ONTAP REST APIクライアント                                │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTPS (Basic Auth)
┌─────────────────────────────────────────────────────────────┐
│         FSx for ONTAP Management Endpoint                    │
│  - management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com     │
│  - ONTAP REST API (port 443)                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    FSx for ONTAP                             │
│  - Volumes, Files, ACLs                                      │
└─────────────────────────────────────────────────────────────┘
```

## 前提条件

### 1. FSx for ONTAP Management Endpoint

FSx for ONTAPファイルシステムのManagement Endpointを取得します。

```bash
# AWS CLIで取得
aws fsx describe-file-systems \
  --file-system-ids fs-xxxxx \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.DNSName' \
  --output text

# 出力例
management.fs-0123456789abcdef0.fsx.ap-northeast-1.amazonaws.com
```

### 2. ONTAP管理者認証情報

FSx for ONTAPの管理者ユーザー（`fsxadmin`）の認証情報が必要です。

**重要**: パスワードは**Secrets Manager**に保存してください。

```bash
# Secrets Managerにシークレットを作成
aws secretsmanager create-secret \
  --name TokyoRegion-permission-aware-rag-prod-OntapCredentials \
  --description "FSx for ONTAP管理者認証情報" \
  --secret-string '{
    "username": "fsxadmin",
    "password": "YOUR_SECURE_PASSWORD"
  }' \
  --region ap-northeast-1
```

### 3. ボリューム情報

使用するONTAPボリュームのUUIDまたは名前を取得します。

```bash
# ONTAP REST APIでボリューム一覧を取得
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/storage/volumes \
  | jq '.records[] | {name: .name, uuid: .uuid}'

# 出力例
{
  "name": "vol1",
  "uuid": "12345678-1234-1234-1234-123456789abc"
}
```

## 環境変数設定

Lambda関数に以下の環境変数を設定します。

### 必須環境変数

```bash
# FSx Management Endpoint
FSX_MANAGEMENT_ENDPOINT=management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com

# Secrets Manager シークレット名
ONTAP_CREDENTIALS_SECRET_NAME=TokyoRegion-permission-aware-rag-prod-OntapCredentials

# DynamoDB テーブル名
PERMISSION_TABLE=TokyoRegion-permission-aware-rag-prod-PermissionConfig
AUDIT_TABLE=TokyoRegion-permission-aware-rag-prod-AuditLogs

# AWS リージョン
AWS_REGION=ap-northeast-1
```

### オプション環境変数

```bash
# ボリュームUUID（推奨）
FSX_VOLUME_UUID=12345678-1234-1234-1234-123456789abc

# または ボリューム名
FSX_VOLUME_NAME=vol1

# リクエストタイムアウト（ミリ秒）
REQUEST_TIMEOUT=30000

# 自己署名証明書を許可（開発環境のみ）
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## IAMポリシー

Lambda実行ロールに以下の権限を付与します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:ACCOUNT_ID:secret:TokyoRegion-permission-aware-rag-prod-OntapCredentials-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-1:ACCOUNT_ID:table/TokyoRegion-permission-aware-rag-prod-PermissionConfig",
        "arn:aws:dynamodb:ap-northeast-1:ACCOUNT_ID:table/TokyoRegion-permission-aware-rag-prod-AuditLogs"
      ]
    }
  ]
}
```

## ネットワーク設定

### VPC設定

Lambda関数は、FSx for ONTAPと同じVPC内に配置する必要があります。

```
VPC: vpc-xxxxx
Subnets: subnet-xxxxx, subnet-yyyyy (プライベートサブネット)
Security Group: sg-xxxxx
```

### セキュリティグループルール

Lambda関数のセキュリティグループに以下のアウトバウンドルールを追加：

```
Type: HTTPS
Protocol: TCP
Port: 443
Destination: FSx for ONTAP Management Endpoint のセキュリティグループ
```

FSx for ONTAPのセキュリティグループに以下のインバウンドルールを追加：

```
Type: HTTPS
Protocol: TCP
Port: 443
Source: Lambda関数のセキュリティグループ
```

## ONTAP REST API エンドポイント

このPermission APIが使用する主なエンドポイント：

### 1. ボリューム一覧取得

```bash
GET /api/storage/volumes
```

### 2. ファイル/ディレクトリ一覧取得

```bash
GET /api/storage/volumes/{volume-uuid}/files/{path}
```

### 3. ACL取得

```bash
GET /api/storage/volumes/{volume-uuid}/files/{path}/acl
```

### 4. ヘルスチェック

```bash
GET /api/cluster
```

## テスト

### 1. ONTAP REST APIの接続テスト

```bash
# ヘルスチェック
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/cluster

# ボリューム一覧
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/storage/volumes

# ディレクトリ一覧
curl -k -u fsxadmin:PASSWORD \
  https://management.fs-xxxxx.fsx.ap-northeast-1.amazonaws.com/api/storage/volumes/VOLUME_UUID/files/%2F
```

### 2. Lambda関数のテスト

```bash
# Lambda関数を直接呼び出し
aws lambda invoke \
  --function-name TokyoRegion-permission-aware-rag-prod-PermissionAPI-Function \
  --payload '{
    "requestContext": {
      "requestId": "test-request-id",
      "authorizer": {
        "claims": {
          "sub": "user123",
          "name": "Test User",
          "email": "test@example.com"
        }
      },
      "identity": {
        "sourceIp": "192.168.1.100",
        "userAgent": "test-agent"
      }
    },
    "headers": {
      "Authorization": "Bearer test-token"
    }
  }' \
  response.json

# レスポンス確認
cat response.json | jq .
```

## トラブルシューティング

### エラー: "Failed to retrieve ONTAP credentials"

**原因**: Secrets Managerからの認証情報取得に失敗

**対処**:
1. Secrets Managerにシークレットが存在するか確認
2. Lambda実行ロールに`secretsmanager:GetSecretValue`権限があるか確認
3. シークレット名が正しいか確認

### エラー: "ONTAP API request failed: 401"

**原因**: ONTAP認証情報が無効

**対処**:
1. Secrets Managerのパスワードが正しいか確認
2. `fsxadmin`ユーザーが有効か確認

### エラー: "ONTAP API request failed: Network error"

**原因**: ネットワーク接続の問題

**対処**:
1. Lambda関数がFSxと同じVPCに配置されているか確認
2. セキュリティグループのルールを確認
3. FSx Management Endpointが正しいか確認

### エラー: "Volume not found"

**原因**: 指定されたボリュームが存在しない

**対処**:
1. `FSX_VOLUME_UUID`または`FSX_VOLUME_NAME`が正しいか確認
2. ONTAP REST APIでボリューム一覧を確認

## 参考資料

- [ONTAP REST APIでAmazon FSx for NetApp ONTAPの操作をしてみた](https://dev.classmethod.jp/articles/amazon-fsx-for-netapp-ontap-operation-with-ontap-rest-api/)
- [ONTAP REST API Documentation](https://library.netapp.com/ecmdocs/ECMLP2858435/html/index.html)
- [FSx for ONTAP User Guide](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/what-is-fsx-ontap.html)

## 次のステップ

1. CDKスタックに統合
2. API Gatewayエンドポイント設定
3. Cognitoオーソライザー設定
4. 統合テスト実装
