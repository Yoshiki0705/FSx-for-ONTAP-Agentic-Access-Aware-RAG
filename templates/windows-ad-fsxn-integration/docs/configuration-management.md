# 設定管理ガイド

## 概要

Windows AD FSxN統合環境では、以下の3つの方法で設定を管理できます：

1. **パラメータファイル** - CloudFormationパラメータファイルによる設定
2. **Systems Manager Parameter Store** - AWS SSMによる設定管理
3. **Secrets Manager** - 機密情報の安全な管理

## 設定ソース別の使用方法

### 1. パラメータファイル（推奨：開発・テスト環境）

最もシンプルな設定方法です。環境別のJSONファイルで設定を管理します。

#### 利用可能なパラメータファイル
- `dev-environment-parameters.json` - 開発環境用
- `staging-environment-parameters.json` - ステージング環境用  
- `prod-environment-parameters.json` - 本番環境用
- `prod-secrets-manager-parameters.json` - 本番環境（Secrets Manager統合）用

#### デプロイ例
```bash
# 開発環境
./scripts/deploy-stack.sh dev ap-northeast-1 user01

# ステージング環境
./scripts/deploy-stack.sh staging ap-northeast-1 staging-profile

# 本番環境
./scripts/deploy-stack.sh prod ap-northeast-1 production-profile
```

### 2. Systems Manager Parameter Store（推奨：本番環境）

設定値をAWS SSMで一元管理します。設定の変更履歴や暗号化に対応しています。

#### セットアップ
```bash
# SSM Parameter Store設定
./scripts/setup-environment-config.sh prod ssm ap-northeast-1 production-profile
```

#### パラメータ構造
```
/windows-ad-fsxn/{environment}/
├── domain-name                    # ドメイン名
├── netbios-name                   # NetBIOS名
├── vpc-cidr                       # VPC CIDR
├── instance-type                  # インスタンスタイプ
└── security/
    ├── enable-cloudtrail          # CloudTrail有効化（暗号化）
    └── enable-guardduty           # GuardDuty有効化（暗号化）
```

#### 設定取得例
```bash
# 環境設定取得
aws ssm get-parameter --name "/windows-ad-fsxn/prod/domain-name" --region ap-northeast-1

# セキュリティ設定取得（復号化）
aws ssm get-parameter --name "/windows-ad-fsxn/prod/security/enable-cloudtrail" --with-decryption --region ap-northeast-1
```

### 3. Secrets Manager（推奨：機密情報）

パスワードやAPIキーなどの機密情報を安全に管理します。

#### セットアップ
```bash
# Secrets Manager設定
./scripts/setup-environment-config.sh prod secrets-manager ap-northeast-1 production-profile
```

#### シークレット構造
```
windows-ad-fsxn/{environment}/
├── admin-password                 # 管理者パスワード
├── safemode-password             # セーフモードパスワード
└── configuration                 # 統合設定（JSON）
```

#### シークレット取得例
```bash
# 管理者パスワード取得
aws secretsmanager get-secret-value --secret-id "windows-ad-fsxn/prod/admin-password" --region ap-northeast-1

# 統合設定取得
aws secretsmanager get-secret-value --secret-id "windows-ad-fsxn/prod/configuration" --region ap-northeast-1
```

## 環境別設定値

### 開発環境（dev）
- **VPC CIDR**: 10.0.0.0/16
- **インスタンスタイプ**: t3.medium
- **GuardDuty**: 無効
- **バックアップ保持**: 7日

### ステージング環境（staging）
- **VPC CIDR**: 10.2.0.0/16
- **インスタンスタイプ**: t3.large
- **GuardDuty**: 有効
- **バックアップ保持**: 14日

### 本番環境（prod）
- **VPC CIDR**: 10.1.0.0/16
- **インスタンスタイプ**: m5.large
- **GuardDuty**: 有効
- **バックアップ保持**: 90日

## 設定パラメータ一覧

### 基本設定
| パラメータ名 | 説明 | デフォルト値 |
|-------------|------|-------------|
| ProjectName | プロジェクト識別子 | windows-ad-fsxn |
| Environment | 環境名 | dev |
| DeploymentRegion | デプロイメントリージョン | ap-northeast-1 |

### Active Directory設定
| パラメータ名 | 説明 | デフォルト値 |
|-------------|------|-------------|
| DomainName | ADドメイン名 | corp.local |
| NetBiosName | NetBIOS名 | CORP |
| AdminPassword | 管理者パスワード | - |
| SafeModePassword | セーフモードパスワード | - |

### 外部設定統合
| パラメータ名 | 説明 | デフォルト値 |
|-------------|------|-------------|
| UseSecretsManager | Secrets Manager使用 | false |
| ConfigurationSource | 設定取得元 | parameters |
| ConfigurationPrefix | 設定プレフィックス | - |

### 高度な設定
| パラメータ名 | 説明 | デフォルト値 |
|-------------|------|-------------|
| AdditionalTags | 追加タグ | - |
| CustomDomainSuffix | カスタムドメインサフィックス | - |
| BackupRetentionDays | バックアップ保持日数 | 30 |

## 設定変更手順

### 1. パラメータファイルの変更
1. 対象環境のパラメータファイルを編集
2. デプロイスクリプトを実行
3. CloudFormationスタックが更新される

### 2. SSM Parameter Storeの変更
```bash
# パラメータ更新
aws ssm put-parameter \
    --name "/windows-ad-fsxn/prod/instance-type" \
    --value "m5.xlarge" \
    --type "String" \
    --overwrite

# CloudFormationスタック更新
aws cloudformation update-stack \
    --stack-name "windows-ad-fsxn-prod" \
    --use-previous-template \
    --parameters ParameterKey=ConfigurationSource,ParameterValue=ssm
```

### 3. Secrets Managerの変更
```bash
# シークレット更新
aws secretsmanager update-secret \
    --secret-id "windows-ad-fsxn/prod/admin-password" \
    --secret-string "新しいパスワード"

# CloudFormationスタック更新
aws cloudformation update-stack \
    --stack-name "windows-ad-fsxn-prod" \
    --use-previous-template \
    --parameters ParameterKey=UseSecretsManager,ParameterValue=true
```

## セキュリティベストプラクティス

### 1. 機密情報の管理
- **パスワード**: 必ずSecrets Managerを使用
- **APIキー**: Secrets Managerで暗号化保存
- **設定値**: 機密性に応じてSSM Parameter Store（SecureString）を使用

### 2. アクセス制御
- **IAMポリシー**: 最小権限の原則を適用
- **リソースベースポリシー**: 特定のリソースのみアクセス許可
- **タグベースアクセス制御**: 環境別のアクセス制御

### 3. 監査とログ
- **CloudTrail**: 設定変更の監査ログ
- **Config**: 設定変更の追跡
- **CloudWatch**: 設定アクセスの監視

## トラブルシューティング

### よくある問題

#### 1. パラメータが見つからない
```bash
# パラメータ存在確認
aws ssm describe-parameters --filters "Key=Name,Values=/windows-ad-fsxn/prod/"
```

#### 2. シークレットアクセス権限エラー
```bash
# IAMポリシー確認
aws iam get-role-policy --role-name windows-ad-fsxn-prod-lambda-execution-role --policy-name FSxDomainJoinPolicy
```

#### 3. 設定値の不整合
```bash
# CloudFormationパラメータ確認
aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Parameters'
```

## 関連ドキュメント

- [デプロイメントガイド](deployment-guide.md)
- [セキュリティガイド](security-guide.md)
- [トラブルシューティングガイド](troubleshooting-guide.md)
- [運用ガイド](operations-guide.md)