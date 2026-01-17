# Windows AD FSxN統合環境 トラブルシューティングガイド

## 概要

このガイドでは、Windows AD FSxN統合環境で発生する可能性のある問題と解決方法を説明します。

## 一般的なトラブルシューティング手順

### 1. 基本情報収集
```bash
# スタック状況確認
aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod

# スタックイベント確認
aws cloudformation describe-stack-events --stack-name windows-ad-fsxn-prod --max-items 20

# リソース状況確認
aws cloudformation describe-stack-resources --stack-name windows-ad-fsxn-prod
```

### 2. ログ確認
```bash
# CloudWatch Logs確認
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/windows-ad-fsxn"

# Systems Manager ログ確認
aws ssm describe-instance-information --filters "Key=tag:Project,Values=windows-ad-fsxn"
```

## デプロイメント関連の問題

### 問題1: CloudFormationスタック作成失敗

#### 症状
- スタック作成が `CREATE_FAILED` または `ROLLBACK_COMPLETE` 状態
- エラーメッセージ: "Resource creation cancelled"

#### 原因と解決方法

**原因1: IAM権限不足**
```bash
# 解決方法: IAM権限確認
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::ACCOUNT:user/USERNAME \
    --action-names cloudformation:CreateStack ec2:CreateVpc \
    --resource-arns "*"
```

**原因2: リソース制限**
```bash
# 解決方法: サービス制限確認
aws service-quotas get-service-quota \
    --service-code ec2 \
    --quota-code L-1216C47A  # Running On-Demand instances

# VPC制限確認
aws ec2 describe-vpcs --query 'length(Vpcs)'
```

**原因3: パラメータ検証エラー**
```bash
# 解決方法: パラメータファイル検証
jq . parameters/prod-environment-parameters.json

# テンプレート構文確認
aws cloudformation validate-template --template-body file://windows-ad-fsxn-environment.yaml
```

### 問題2: ネストされたスタック失敗

#### 症状
- 子スタックが `CREATE_FAILED` 状態
- エラーメッセージ: "Template format error"

#### 解決方法
```bash
# S3バケット確認
aws s3 ls s3://windows-ad-fsxn-prod-cfn-templates/nested-stacks/

# テンプレートアップロード確認
aws s3 cp nested-stacks/ s3://windows-ad-fsxn-prod-cfn-templates/nested-stacks/ --recursive

# 個別テンプレート検証
aws cloudformation validate-template --template-url https://windows-ad-fsxn-prod-cfn-templates.s3.ap-northeast-1.amazonaws.com/nested-stacks/network-stack.yaml
```

### 問題3: タイムアウトエラー

#### 症状
- スタック作成が長時間実行後にタイムアウト
- 特定のリソースで停止

#### 解決方法
```bash
# タイムアウト時間延長
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --use-previous-template \
    --parameters ParameterKey=TimeoutInMinutes,ParameterValue=120

# 問題リソース特定
aws cloudformation describe-stack-events \
    --stack-name windows-ad-fsxn-prod \
    --query 'StackEvents[?ResourceStatus==`CREATE_IN_PROGRESS`]'
```

## Windows AD関連の問題

### 問題4: Active Directory セットアップ失敗

#### 症状
- Windows インスタンスは起動するがADが構成されない
- CloudFormation シグナルタイムアウト

#### 診断手順
```bash
# インスタンス状況確認
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`WindowsADInstanceId`].OutputValue' --output text)

aws ec2 describe-instances --instance-ids $INSTANCE_ID

# Systems Manager接続確認
aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$INSTANCE_ID"

# PowerShellスクリプト実行状況確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=["Get-WindowsFeature -Name AD-Domain-Services","Get-ADDomain -ErrorAction SilentlyContinue"]'
```

#### 解決方法
```bash
# 手動ADセットアップ
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools",
        "Import-Module ADDSDeployment",
        "Install-ADDSForest -DomainName corp.local -SafeModeAdministratorPassword (ConvertTo-SecureString \"YourPassword\" -AsPlainText -Force) -Force"
    ]'

# ログ確認
aws logs filter-log-events \
    --log-group-name "/aws/ec2/windows" \
    --filter-pattern "ERROR"
```

### 問題5: DNS解決問題

#### 症状
- ドメイン名が解決されない
- クライアントからADサーバーに接続できない

#### 診断手順
```bash
# DNS設定確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-DnsServerSetting",
        "Get-DnsServerZone",
        "nslookup corp.local"
    ]'

# Route 53 Resolver確認
aws route53resolver list-resolver-endpoints

# VPC DNS設定確認
VPC_ID=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)
aws ec2 describe-vpcs --vpc-ids $VPC_ID --query 'Vpcs[0].DhcpOptionsId'
```

#### 解決方法
```bash
# DNS転送設定修正
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Add-DnsServerConditionalForwarderZone -Name amazonaws.com -MasterServers 169.254.169.253",
        "Restart-Service DNS"
    ]'

# DHCP Options更新
aws ec2 create-dhcp-options \
    --dhcp-configurations Key=domain-name-servers,Values=$AD_IP,169.254.169.253 Key=domain-name,Values=corp.local

aws ec2 associate-dhcp-options --dhcp-options-id dhcp-12345678 --vpc-id $VPC_ID
```

## FSx統合関連の問題

### 問題6: FSx ドメイン参加失敗

#### 症状
- FSx SVMがActive Directoryに参加できない
- Lambda関数でエラーが発生

#### 診断手順
```bash
# Lambda関数ログ確認
aws logs filter-log-events \
    --log-group-name "/aws/lambda/windows-ad-fsxn-prod-fsxn-domain-join" \
    --start-time $(date -d '1 hour ago' +%s)000

# FSx SVM状況確認
aws fsx describe-storage-virtual-machines \
    --filters "Name=file-system-id,Values=$FSX_FILESYSTEM_ID"

# ネットワーク接続確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Test-NetConnection -ComputerName $FSX_MANAGEMENT_IP -Port 443",
        "Test-NetConnection -ComputerName $FSX_MANAGEMENT_IP -Port 135"
    ]'
```

#### 解決方法
```bash
# 手動ドメイン参加
aws fsx create-storage-virtual-machine \
    --file-system-id $FSX_FILESYSTEM_ID \
    --name svm01 \
    --active-directory-configuration '{
        "NetBiosName": "CORP",
        "SelfManagedActiveDirectoryConfiguration": {
            "DomainName": "corp.local",
            "OrganizationalUnitDistinguishedName": "OU=Computers,DC=corp,DC=local",
            "FileSystemAdministratorsGroup": "Domain Admins",
            "UserName": "Administrator",
            "Password": "YourPassword",
            "DnsIps": ["10.0.1.10"]
        }
    }'

# セキュリティグループ確認
aws ec2 describe-security-groups \
    --filters "Name=tag:Project,Values=windows-ad-fsxn"
```

### 問題7: FSx パフォーマンス問題

#### 症状
- ファイルアクセスが遅い
- IOPS制限に達している

#### 診断手順
```bash
# FSx メトリクス確認
aws cloudwatch get-metric-statistics \
    --namespace AWS/FSx \
    --metric-name TotalIOPS \
    --dimensions Name=FileSystemId,Value=$FSX_FILESYSTEM_ID \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum

# スループット確認
aws cloudwatch get-metric-statistics \
    --namespace AWS/FSx \
    --metric-name TotalThroughput \
    --dimensions Name=FileSystemId,Value=$FSX_FILESYSTEM_ID \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum
```

#### 解決方法
```bash
# FSx設定確認・調整
aws fsx describe-file-systems --file-system-ids $FSX_FILESYSTEM_ID

# スループット容量増加（必要に応じて）
aws fsx modify-file-system \
    --file-system-id $FSX_FILESYSTEM_ID \
    --ontap-configuration ThroughputCapacity=256
```

## ネットワーク関連の問題

### 問題8: RDP接続できない

#### 症状
- Windows インスタンスにRDP接続できない
- 接続がタイムアウトする

#### 診断手順
```bash
# セキュリティグループ確認
aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=*windows-ad*" \
    --query 'SecurityGroups[].IpPermissions[?FromPort==`3389`]'

# インスタンス状況確認
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
    --query 'Reservations[].Instances[].[State.Name,PublicIpAddress,PrivateIpAddress]'

# ネットワークACL確認
aws ec2 describe-network-acls \
    --filters "Name=vpc-id,Values=$VPC_ID"
```

#### 解決方法
```bash
# セキュリティグループルール追加
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 3389 \
    --cidr 10.0.0.0/16

# Windows ファイアウォール確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-NetFirewallRule -DisplayName \"Remote Desktop*\"",
        "Enable-NetFirewallRule -DisplayGroup \"Remote Desktop\""
    ]'
```

### 問題9: VPC エンドポイント接続問題

#### 症状
- S3やSystems Managerへの接続が失敗
- プライベートサブネットからインターネットアクセスできない

#### 診断手順
```bash
# VPCエンドポイント確認
aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$VPC_ID"

# ルートテーブル確認
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID"

# DNS解決確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "nslookup s3.amazonaws.com",
        "nslookup ssm.ap-northeast-1.amazonaws.com"
    ]'
```

#### 解決方法
```bash
# VPCエンドポイント作成
aws ec2 create-vpc-endpoint \
    --vpc-id $VPC_ID \
    --service-name com.amazonaws.ap-northeast-1.s3 \
    --route-table-ids $ROUTE_TABLE_ID

# セキュリティグループ更新
aws ec2 authorize-security-group-ingress \
    --group-id $VPC_ENDPOINT_SG_ID \
    --protocol tcp \
    --port 443 \
    --source-group $INSTANCE_SG_ID
```

## 監視・ログ関連の問題

### 問題10: CloudWatch エージェント動作しない

#### 症状
- Windows メトリクスがCloudWatchに送信されない
- カスタムメトリクスが表示されない

#### 診断手順
```bash
# CloudWatch エージェント状況確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Service AmazonCloudWatchAgent",
        "Get-Content \"C:\\ProgramData\\Amazon\\AmazonCloudWatchAgent\\Logs\\amazon-cloudwatch-agent.log\" -Tail 20"
    ]'

# IAMロール確認
aws iam get-role --role-name windows-ad-fsxn-prod-windows-ec2-role
```

#### 解決方法
```bash
# CloudWatch エージェント再起動
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Restart-Service AmazonCloudWatchAgent",
        "& \"C:\\Program Files\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent-ctl.ps1\" -a fetch-config -m ec2 -s -c ssm:AmazonCloudWatch-windows"
    ]'
```

### 問題11: ログが収集されない

#### 症状
- Windows イベントログがCloudWatch Logsに送信されない
- アプリケーションログが見つからない

#### 解決方法
```bash
# ログ設定確認
aws logs describe-log-groups --log-group-name-prefix "/aws/ec2/windows"

# ログエージェント設定更新
aws ssm put-parameter \
    --name "AmazonCloudWatch-windows" \
    --type "String" \
    --value '{
        "logs": {
            "logs_collected": {
                "windows_events": {
                    "collect_list": [
                        {
                            "event_name": "System",
                            "event_levels": ["ERROR", "WARNING"],
                            "log_group_name": "/aws/ec2/windows/system",
                            "log_stream_name": "{instance_id}"
                        }
                    ]
                }
            }
        }
    }' \
    --overwrite
```

## セキュリティ関連の問題

### 問題12: Secrets Manager アクセスエラー

#### 症状
- パスワード取得時にアクセス拒否エラー
- Lambda関数でSecrets Managerにアクセスできない

#### 解決方法
```bash
# IAMポリシー確認
aws iam get-role-policy \
    --role-name windows-ad-fsxn-prod-lambda-execution-role \
    --policy-name SecretsManagerAccess

# シークレット確認
aws secretsmanager describe-secret \
    --secret-id "windows-ad-fsxn/prod/admin-password"

# リソースベースポリシー確認
aws secretsmanager get-resource-policy \
    --secret-id "windows-ad-fsxn/prod/admin-password"
```

### 問題13: KMS暗号化エラー

#### 症状
- EBS暗号化に失敗
- KMSキーアクセス拒否

#### 解決方法
```bash
# KMSキー確認
aws kms describe-key --key-id alias/windows-ad-fsxn-prod-encryption

# キーポリシー確認
aws kms get-key-policy \
    --key-id alias/windows-ad-fsxn-prod-encryption \
    --policy-name default

# IAMロールにKMS権限追加
aws iam put-role-policy \
    --role-name windows-ad-fsxn-prod-windows-ec2-role \
    --policy-name KMSAccess \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "kms:Decrypt",
                    "kms:GenerateDataKey"
                ],
                "Resource": "*"
            }
        ]
    }'
```

## パフォーマンス関連の問題

### 問題14: 高CPU使用率

#### 症状
- Windows インスタンスのCPU使用率が継続的に高い
- レスポンスが遅い

#### 診断・解決方法
```bash
# CPU使用率確認
aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum

# プロセス確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10",
        "Get-Counter \"\\Processor(_Total)\\% Processor Time\""
    ]'

# インスタンスタイプ変更（必要に応じて）
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --use-previous-template \
    --parameters ParameterKey=InstanceType,ParameterValue=m5.xlarge
```

## 緊急時対応

### 完全復旧手順
```bash
# 1. 現在の状況確認
aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod

# 2. バックアップからの復旧
aws ec2 create-image --instance-id $INSTANCE_ID --name "emergency-backup-$(date +%Y%m%d)"

# 3. 新しいインスタンス起動
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --use-previous-template \
    --parameters ParameterKey=InstanceType,ParameterValue=m5.large

# 4. データ復旧
aws fsx restore-volume-from-snapshot \
    --volume-id $VOLUME_ID \
    --snapshot-id $SNAPSHOT_ID
```

### エスカレーション手順
1. **レベル1**: 基本的なトラブルシューティング実行
2. **レベル2**: AWSサポートケース作成
3. **レベル3**: 緊急時対応チーム招集

### 連絡先情報
- **技術サポート**: support@yourcompany.com
- **緊急連絡先**: emergency@yourcompany.com
- **AWSサポート**: AWSコンソールからケース作成

## 予防策

### 定期メンテナンス
- 月次パッチ適用
- 四半期セキュリティ監査
- 年次災害復旧テスト

### 監視設定
- CloudWatchアラーム設定
- ログ監視自動化
- パフォーマンス閾値設定

### バックアップ戦略
- 日次EBSスナップショット
- 週次FSxバックアップ
- 月次設定バックアップ

## 関連ドキュメント

- [デプロイメントガイド](deployment-guide.md)
- [設定管理ガイド](configuration-management.md)
- [セキュリティガイド](security-guide.md)
- [運用ガイド](operations-guide.md)