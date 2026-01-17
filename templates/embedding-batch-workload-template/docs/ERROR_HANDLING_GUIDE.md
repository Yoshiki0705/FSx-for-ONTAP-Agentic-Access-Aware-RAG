# エラーハンドリングガイド

## 概要

このテンプレートは、包括的なエラーハンドリング機能を提供し、デプロイメント時の問題を迅速に特定・解決できるようにします。

## エラーハンドラーの機能

### 1. ユーザーフレンドリーなエラーメッセージ

従来の技術的なエラーメッセージを、理解しやすく実行可能な形式に変換します。

#### 例: リソース存在エラー

**従来のメッセージ**:
```
Error: Resource already exists
```

**改善後のメッセージ**:
```
❌ エラー: リソースが既に存在します
💡 解決方法: 既存のリソースを削除するか、別の名前を使用してください

詳細: Stack 'my-stack' already exists
```

### 2. トラブルシューティング情報の自動表示

エラーコードに基づいて、具体的なトラブルシューティング手順を表示します。

#### 例: アクセス拒否エラー

```typescript
ErrorHandler.displayTroubleshootingInfo('ACCESS_DENIED');
```

**出力**:
```
🔧 トラブルシューティング手順 [ACCESS_DENIED]:
   1. IAMポリシーを確認: aws iam get-user-policy
   2. 必要な権限を付与: AdministratorAccess または PowerUserAccess
   3. MFAが必要な場合: aws sts get-session-token --serial-number <mfa-device>
```

### 3. デプロイメント前の検証

デプロイメント前に設定を検証し、問題を事前に検出します。

```typescript
const isValid = ErrorHandler.validateDeploymentPrerequisites(config);
if (!isValid) {
  // エラーサマリーを表示
  ErrorHandler.displayErrorSummary();
  process.exit(1);
}
```

## エラーレベル

### INFO
情報メッセージ。正常な処理の進行状況を示します。

```typescript
ErrorHandler.info('リソースを作成中...', { resourceType: 'S3Bucket' });
```

### WARNING
警告メッセージ。処理は続行されますが、注意が必要です。

```typescript
ErrorHandler.warning(
  'プロジェクト名が8文字を超えています',
  'PROJECT_NAME_LENGTH',
  { projectName: 'very-long-project-name', length: 22 }
);
```

### ERROR
エラーメッセージ。処理が失敗しましたが、回復可能です。

```typescript
ErrorHandler.error(
  'リソースの作成に失敗しました',
  'RESOURCE_ERROR',
  { resourceType: 'VPC', resourceName: 'my-vpc' }
);
```

### CRITICAL
重大なエラー。即座の対応が必要です。

```typescript
ErrorHandler.critical(
  'アクセス権限がありません',
  'PERMISSION_ERROR',
  { action: 's3:CreateBucket', resource: 'my-bucket' }
);
```

## 使用例

### コンストラクトでの使用

```typescript
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string, props: MyProps) {
    super(scope, id);
    
    try {
      // 入力値検証
      this.validateProps(props);
      
      ErrorHandler.info('リソースを作成中...', {
        projectName: props.config.projectName
      });
      
      // リソース作成
      const bucket = this.createBucket(props);
      
      ErrorHandler.info('✅ リソースの作成が完了しました', {
        bucketName: bucket.bucketName
      });
      
    } catch (error) {
      ErrorHandler.handleCdkError(error as Error, {
        construct: 'MyConstruct',
        projectName: props.config.projectName
      });
      throw error;
    }
  }
  
  private validateProps(props: MyProps): void {
    ErrorHandler.info('設定を検証中...');
    
    if (!props.config) {
      const error = new Error(
        '❌ 設定が必要です\n' +
        '💡 解決方法: 設定ファイルを指定してください'
      );
      ErrorHandler.handleValidationError('config', props.config, 'Config');
      throw error;
    }
    
    ErrorHandler.info('✅ 設定の検証が完了しました');
  }
}
```

### リソース作成時のエラーハンドリング

```typescript
private createBucket(props: MyProps): s3.Bucket {
  try {
    ErrorHandler.info('S3バケットを作成中...');
    
    const bucket = new s3.Bucket(this, 'MyBucket', {
      bucketName: props.bucketName,
      // ... その他の設定
    });
    
    ErrorHandler.info('✅ S3バケットの作成が完了しました', {
      bucketName: bucket.bucketName
    });
    
    return bucket;
    
  } catch (error) {
    ErrorHandler.handleResourceError(
      'S3Bucket',
      'MyBucket',
      'create',
      error as Error
    );
    throw new Error(
      `❌ S3バケットの作成に失敗しました\n` +
      `💡 解決方法:\n` +
      `  1. バケット名が既に使用されていないか確認してください\n` +
      `  2. IAMポリシーでs3:CreateBucket権限があるか確認してください\n` +
      `  3. リージョンが正しく設定されているか確認してください\n\n` +
      `詳細: ${(error as Error).message}`
    );
  }
}
```

## エラーパターンと解決方法

### 1. リソース既存エラー

**エラー**: `Resource already exists`

**解決方法**:
1. 既存のリソースを確認: `aws cloudformation describe-stacks`
2. 不要なリソースを削除: `aws cloudformation delete-stack --stack-name <stack-name>`
3. 別のプロジェクト名を使用: `--context projectName=<new-name>`

### 2. リソース未検出エラー

**エラー**: `Resource not found`

**解決方法**:
1. リソース名を確認: 設定ファイルのリソース名が正しいか確認
2. リージョンを確認: `--context region=<region>`
3. VPC/サブネットIDを確認: `aws ec2 describe-vpcs`

### 3. アクセス拒否エラー

**エラー**: `Access Denied`

**解決方法**:
1. IAMポリシーを確認: `aws iam get-user-policy`
2. 必要な権限を付与: AdministratorAccess または PowerUserAccess
3. MFAが必要な場合: `aws sts get-session-token --serial-number <mfa-device>`

### 4. 権限エラー

**エラー**: `Permission denied`

**解決方法**:
1. IAMロールを確認: `aws iam get-role --role-name <role-name>`
2. 信頼関係を確認: `aws iam get-role --role-name <role-name> --query Role.AssumeRolePolicyDocument`
3. ポリシーをアタッチ: `aws iam attach-role-policy`

### 5. 検証エラー

**エラー**: `Validation error`

**解決方法**:
1. 設定ファイルを確認: `config/*.json`
2. 必須パラメータを確認: projectName, environment, region
3. サンプル設定を参照: `examples/*.json`

### 6. デプロイメント失敗

**エラー**: `Deployment failed`

**解決方法**:
1. CloudFormationイベントを確認: `aws cloudformation describe-stack-events`
2. ロールバック: `aws cloudformation cancel-update-stack`
3. スタックを削除して再デプロイ: `aws cloudformation delete-stack`

## ベストプラクティス

### 1. 早期検証

デプロイメント前に設定を検証します。

```typescript
// デプロイメント前
const isValid = ErrorHandler.validateDeploymentPrerequisites(config);
if (!isValid) {
  ErrorHandler.displayErrorSummary();
  process.exit(1);
}
```

### 2. 詳細なコンテキスト

エラーログに詳細なコンテキストを含めます。

```typescript
ErrorHandler.error('リソースの作成に失敗', 'RESOURCE_ERROR', {
  resourceType: 'VPC',
  resourceName: 'my-vpc',
  region: 'ap-northeast-1',
  accountId: '123456789012'
});
```

### 3. エラーサマリーの表示

デプロイメント後にエラーサマリーを表示します。

```typescript
// デプロイメント後
ErrorHandler.displayErrorSummary();
```

### 4. リソース制限の確認

リソース作成前に制限を確認します。

```typescript
ErrorHandler.checkResourceLimits('VPC', currentVpcCount);
```

### 5. デプロイメント結果の検証

デプロイメント後に結果を検証します。

```typescript
ErrorHandler.validateDeploymentResult(stackName, expectedResources);
```

## トラブルシューティングコマンド

### CloudFormation

```bash
# スタック一覧
aws cloudformation list-stacks

# スタック詳細
aws cloudformation describe-stacks --stack-name <stack-name>

# スタックイベント
aws cloudformation describe-stack-events --stack-name <stack-name>

# スタック削除
aws cloudformation delete-stack --stack-name <stack-name>
```

### IAM

```bash
# ユーザーポリシー確認
aws iam get-user-policy --user-name <user-name> --policy-name <policy-name>

# ロール確認
aws iam get-role --role-name <role-name>

# ポリシーアタッチ
aws iam attach-role-policy --role-name <role-name> --policy-arn <policy-arn>
```

### VPC

```bash
# VPC一覧
aws ec2 describe-vpcs

# サブネット一覧
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>"

# セキュリティグループ一覧
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=<vpc-id>"
```

## まとめ

エラーハンドリング機能により、以下が実現されます：

- ✅ ユーザーフレンドリーなエラーメッセージ
- ✅ 自動トラブルシューティング情報
- ✅ デプロイメント前の検証
- ✅ 詳細なエラーログとコンテキスト
- ✅ エラーサマリーの自動生成

問題が発生した場合は、エラーメッセージの指示に従って対処してください。
それでも解決しない場合は、トラブルシューティングガイドを参照してください。

## 関連ドキュメント

- [CDK Troubleshooting Guide](./CDK_TROUBLESHOOTING_GUIDE.md)
- [Deployment Guide](./CDK_DEPLOYMENT_GUIDE.md)
- [Configuration Guide](./CDK_CONFIGURATION_GUIDE.md)

---
最終更新: 2025-11-09  
バージョン: 1.0.0
