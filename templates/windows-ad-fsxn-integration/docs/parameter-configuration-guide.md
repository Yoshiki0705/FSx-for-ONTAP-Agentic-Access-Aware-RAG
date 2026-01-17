# パラメータ設定ガイド

## 概要

このガイドでは、Windows AD FSxN統合環境のCloudFormationテンプレートで使用するパラメータファイルの設定方法を詳しく説明します。

## 📋 事前準備チェックリスト

デプロイ前に以下の情報を準備してください：

### 必須情報
- [ ] **EC2キーペア名**: Windows インスタンスへのアクセス用
- [ ] **FSx for ONTAP ファイルシステムID**: 既存のFSxファイルシステム
- [ ] **管理者パスワード**: Active Directory管理者用（8文字以上、複雑性要件）
- [ ] **セーフモードパスワード**: AD復旧用（8文字以上、複雑性要件）

### オプション情報
- [ ] **通知メールアドレス**: アラート受信用
- [ ] **カスタムドメイン名**: デフォルト以外のドメインを使用する場合
- [ ] **追加タグ**: コスト管理・組織管理用

## 🔧 パラメータファイル設定手順

### ステップ 1: ベースファイルのコピー

```bash
# 開発環境用
cp parameters/dev-environment-parameters.json parameters/my-dev-parameters.json

# ステージング環境用
cp parameters/staging-environment-parameters.json parameters/my-staging-parameters.json

# 本番環境用
cp parameters/prod-environment-parameters.json parameters/my-prod-parameters.json
```

### ステップ 2: 必須パラメータの設定

#### 2.1 セキュリティ関連パラメータ

```json
{
  "ParameterKey": "AdminPassword",
  "ParameterValue": "YourSecureP@ssw0rd2024!"
},
{
  "ParameterKey": "SafeModePassword", 
  "ParameterValue": "YourSafeM0deP@ssw0rd2024!"
},
{
  "ParameterKey": "KeyPairName",
  "ParameterValue": "your-ec2-keypair-name"
}
```

**パスワード要件**:
- 最小8文字以上
- 大文字・小文字・数字・記号をそれぞれ1文字以上含む
- 辞書にある単語は避ける
- 推奨: 16文字以上のランダム生成パスワード

#### 2.2 AWS リソース関連パラメータ

```json
{
  "ParameterKey": "FSxFileSystemId",
  "ParameterValue": "fs-0123456789abcdef0"
}
```

**FSxファイルシステムIDの確認方法**:
```bash
# AWS CLI で確認
aws fsx describe-file-systems --query 'FileSystems[].FileSystemId' --output table

# 特定のファイルシステムの詳細確認
aws fsx describe-file-systems --file-system-ids fs-0123456789abcdef0
```

### ステップ 3: 環境別設定の調整

#### 3.1 開発環境設定例

```json
{
  "ParameterKey": "Environment",
  "ParameterValue": "dev"
},
{
  "ParameterKey": "InstanceType",
  "ParameterValue": "t3.medium"
},
{
  "ParameterKey": "EnableGuardDuty",
  "ParameterValue": "false"
},
{
  "ParameterKey": "BackupRetentionDays",
  "ParameterValue": "7"
}
```

#### 3.2 本番環境設定例

```json
{
  "ParameterKey": "Environment",
  "ParameterValue": "prod"
},
{
  "ParameterKey": "InstanceType",
  "ParameterValue": "m5.large"
},
{
  "ParameterKey": "EnableGuardDuty",
  "ParameterValue": "true"
},
{
  "ParameterKey": "BackupRetentionDays",
  "ParameterValue": "90"
}
```

### ステップ 4: ネットワーク設定

#### 4.1 VPC CIDR設定

環境別にCIDRを分離することを推奨：

```json
// 開発環境
{
  "ParameterKey": "VpcCidr",
  "ParameterValue": "10.0.0.0/16"
}

// ステージング環境  
{
  "ParameterKey": "VpcCidr",
  "ParameterValue": "10.2.0.0/16"
}

// 本番環境
{
  "ParameterKey": "VpcCidr", 
  "ParameterValue": "10.1.0.0/16"
}
```

#### 4.2 セキュリティ設定

```json
{
  "ParameterKey": "AllowedCidrForRDP",
  "ParameterValue": "10.0.0.0/16"  // VPC内部のみに制限
}
```

**セキュリティ推奨事項**:
- RDPアクセスは最小限のCIDR範囲に制限
- 本番環境では特定のIPアドレスのみ許可を検討
- 必要に応じてVPN経由のアクセスを設定

### ステップ 5: 監視・通知設定

```json
{
  "ParameterKey": "NotificationEmail",
  "ParameterValue": "admin@yourcompany.com"
},
{
  "ParameterKey": "EnableCloudWatch",
  "ParameterValue": "true"
},
{
  "ParameterKey": "EnableSystemsManager",
  "ParameterValue": "true"
}
```

### ステップ 6: タグ設定

```json
{
  "ParameterKey": "AdditionalTags",
  "ParameterValue": "CostCenter=IT,Owner=InfraTeam,Purpose=Production,Compliance=Required"
}
```

**タグ設定例**:
- **CostCenter**: コストセンター識別
- **Owner**: 責任者・チーム名
- **Purpose**: 用途（Development/Staging/Production）
- **Compliance**: コンプライアンス要件
- **Project**: プロジェクト名

## 🔐 Secrets Manager統合設定

本番環境では、パスワードをSecrets Managerで管理することを強く推奨します。

### Secrets Manager使用時の設定

```json
{
  "ParameterKey": "UseSecretsManager",
  "ParameterValue": "true"
},
{
  "ParameterKey": "AdminPasswordSecretName",
  "ParameterValue": "windows-ad-fsxn/prod/admin-password"
},
{
  "ParameterKey": "SafeModePasswordSecretName",
  "ParameterValue": "windows-ad-fsxn/prod/safemode-password"
},
{
  "ParameterKey": "ConfigurationSource",
  "ParameterValue": "secrets-manager"
}
```

### Secrets Manager事前設定

```bash
# 管理者パスワード設定
aws secretsmanager create-secret \
    --name "windows-ad-fsxn/prod/admin-password" \
    --description "Windows AD administrator password" \
    --secret-string "YourSecureP@ssw0rd2024!"

# セーフモードパスワード設定
aws secretsmanager create-secret \
    --name "windows-ad-fsxn/prod/safemode-password" \
    --description "Windows AD safe mode password" \
    --secret-string "YourSafeM0deP@ssw0rd2024!"
```

## 📝 パラメータ検証

設定完了後、パラメータファイルを検証します：

### 構文検証

```bash
# JSON構文チェック
jq . parameters/my-dev-parameters.json

# パラメータ内容検証
./scripts/validate-templates.sh
```

### 必須項目チェック

以下のスクリプトで必須項目の設定を確認：

```bash
#!/bin/bash
PARAM_FILE="parameters/my-dev-parameters.json"

# 必須パラメータチェック
REQUIRED_PARAMS=(
    "AdminPassword"
    "SafeModePassword"
    "FSxFileSystemId"
    "KeyPairName"
)

echo "=== 必須パラメータチェック ==="
for param in "${REQUIRED_PARAMS[@]}"; do
    value=$(jq -r ".[] | select(.ParameterKey == \"$param\") | .ParameterValue" "$PARAM_FILE")
    if [[ "$value" == *"CHANGE_ME"* ]] || [[ -z "$value" ]]; then
        echo "❌ $param: 設定が必要です"
    else
        echo "✅ $param: 設定済み"
    fi
done
```

## 🌍 リージョン別設定

### 対応リージョン

| リージョン | リージョンコード | 推奨用途 |
|-----------|----------------|----------|
| 東京 | ap-northeast-1 | 日本国内本番環境 |
| 大阪 | ap-northeast-3 | 災害復旧・バックアップ |
| バージニア | us-east-1 | グローバル展開 |
| オレゴン | us-west-2 | 米国西海岸 |
| アイルランド | eu-west-1 | 欧州展開 |

### リージョン固有設定

```json
{
  "ParameterKey": "DeploymentRegion",
  "ParameterValue": "ap-northeast-1"
},
{
  "ParameterKey": "AvailabilityZone", 
  "ParameterValue": "ap-northeast-1a"
}
```

## 🔍 トラブルシューティング

### よくある設定エラー

#### 1. パスワード複雑性エラー

**エラー**: "Password does not meet complexity requirements"

**解決方法**:
- 8文字以上にする
- 大文字・小文字・数字・記号を含める
- 辞書にある単語を避ける

#### 2. FSxファイルシステムID不正

**エラー**: "Invalid FSx filesystem ID format"

**解決方法**:
```bash
# 正しいフォーマット確認
aws fsx describe-file-systems --query 'FileSystems[].[FileSystemId,FileSystemType]' --output table
```

#### 3. キーペア名エラー

**エラー**: "Key pair 'xxx' does not exist"

**解決方法**:
```bash
# 既存キーペア確認
aws ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output table

# 新しいキーペア作成
aws ec2 create-key-pair --key-name my-windows-keypair --query 'KeyMaterial' --output text > my-windows-keypair.pem
```

### 設定値の確認方法

```bash
# パラメータファイル内容確認
jq '.[] | select(.ParameterKey | contains("Password") | not)' parameters/my-dev-parameters.json

# 特定パラメータの値確認
jq -r '.[] | select(.ParameterKey == "FSxFileSystemId") | .ParameterValue' parameters/my-dev-parameters.json
```

## 📚 関連ドキュメント

- [デプロイメントガイド](deployment-guide.md)
- [設定管理ガイド](configuration-management.md)
- [セキュリティガイド](security-guide.md)
- [トラブルシューティングガイド](troubleshooting-guide.md)

## 🎯 次のステップ

パラメータ設定完了後：

1. **テンプレート検証**: `./scripts/validate-templates.sh`
2. **デプロイ実行**: `./scripts/deploy-stack.sh dev ap-northeast-1 your-profile`
3. **動作確認**: `./scripts/integration-test.sh dev ap-northeast-1 your-profile`

---

**重要**: 本番環境では必ずSecrets Managerを使用し、パスワードをパラメータファイルに直接記載しないでください。