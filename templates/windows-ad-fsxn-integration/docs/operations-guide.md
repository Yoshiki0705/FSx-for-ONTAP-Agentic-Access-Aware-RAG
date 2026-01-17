# Windows AD FSxN統合環境 運用ガイド

## 概要

このガイドでは、Windows AD FSxN統合環境の日常運用、メンテナンス、監視について説明します。

## 日常運用タスク

### 毎日の確認事項

#### システム状況確認
```bash
# インスタンス状況確認
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`WindowsADInstanceId`].OutputValue' --output text)

aws ec2 describe-instances --instance-ids $INSTANCE_ID \
    --query 'Reservations[].Instances[].[State.Name,StatusChecks.SystemStatus.Status,StatusChecks.InstanceStatus.Status]' \
    --output table

# Active Directory サービス確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Service ADWS,DNS,KDC,NETLOGON | Format-Table Name,Status",
        "Get-ADDomain | Select-Object Name,DomainMode,PDCEmulator"
    ]'
```

#### FSx状況確認
```bash
# FSx ファイルシステム状況
FSX_ID=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`FSxFileSystemId`].OutputValue' --output text)

aws fsx describe-file-systems --file-system-ids $FSX_ID \
    --query 'FileSystems[].[FileSystemId,Lifecycle,StorageCapacity,ThroughputCapacity]' \
    --output table

# SVM状況確認
aws fsx describe-storage-virtual-machines \
    --filters "Name=file-system-id,Values=$FSX_ID" \
    --query 'StorageVirtualMachines[].[StorageVirtualMachineId,Lifecycle,Name]' \
    --output table
```

#### アラート・ログ確認
```bash
# CloudWatch アラーム状況
aws cloudwatch describe-alarms \
    --alarm-name-prefix "windows-ad-fsxn-prod" \
    --state-value ALARM \
    --query 'MetricAlarms[].[AlarmName,StateValue,StateReason]' \
    --output table

# 過去24時間のエラーログ
aws logs filter-log-events \
    --log-group-name "/aws/ec2/windows/system" \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --filter-pattern "ERROR"
```

### 週次タスク

#### パフォーマンス分析
```bash
# CPU使用率トレンド（過去7日）
aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID \
    --start-time $(date -d '7 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Maximum

# メモリ使用率確認
aws cloudwatch get-metric-statistics \
    --namespace CWAgent \
    --metric-name "Memory % Committed Bytes In Use" \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID \
    --start-time $(date -d '7 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Maximum

# FSx IOPS使用状況
aws cloudwatch get-metric-statistics \
    --namespace AWS/FSx \
    --metric-name TotalIOPS \
    --dimensions Name=FileSystemId,Value=$FSX_ID \
    --start-time $(date -d '7 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Maximum
```

#### セキュリティ確認
```bash
# GuardDuty検出結果確認
aws guardduty list-findings \
    --detector-id $(aws guardduty list-detectors --query 'DetectorIds[0]' --output text) \
    --finding-criteria '{"CreatedAt":{"Gte":"'$(date -d '7 days ago' -u +%Y-%m-%dT%H:%M:%S.000Z)'"}}'

# CloudTrail異常アクティビティ確認
aws logs filter-log-events \
    --log-group-name "CloudTrail/windows-ad-fsxn-prod" \
    --start-time $(date -d '7 days ago' +%s)000 \
    --filter-pattern "{ $.errorCode = * }"

# パッチ適用状況確認
aws ssm describe-instance-patch-states \
    --instance-ids $INSTANCE_ID
```

### 月次タスク

#### 容量計画
```bash
# EBSボリューム使用状況
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace,@{Name=\"UsedPercent\";Expression={[math]::Round((($.Size-$.FreeSpace)/$.Size)*100,2)}}"
    ]'

# FSx容量使用状況
aws cloudwatch get-metric-statistics \
    --namespace AWS/FSx \
    --metric-name StorageUtilization \
    --dimensions Name=FileSystemId,Value=$FSX_ID \
    --start-time $(date -d '30 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Maximum
```

#### コスト分析
```bash
# 月次コスト確認
aws ce get-cost-and-usage \
    --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-01) \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE \
    --filter '{"Tags":{"Key":"Project","Values":["windows-ad-fsxn"]}}'

# リソース使用率レポート
aws ce get-rightsizing-recommendation \
    --service EC2-Instance \
    --filter '{"Tags":{"Key":"Project","Values":["windows-ad-fsxn"]}}'
```

## メンテナンス手順

### 定期メンテナンス

#### パッチ適用
```bash
# パッチベースライン確認
PATCH_BASELINE=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`WindowsPatchBaselineId`].OutputValue' --output text)

aws ssm describe-patch-baselines --filters "Key=Name,Values=$PATCH_BASELINE"

# パッチスキャン実行
aws ssm send-command \
    --document-name "AWS-RunPatchBaseline" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters "Operation=Scan"

# パッチインストール（メンテナンスウィンドウ内）
MAINTENANCE_WINDOW=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`MaintenanceWindowId`].OutputValue' --output text)

aws ssm register-task-with-maintenance-window \
    --window-id $MAINTENANCE_WINDOW \
    --task-arn "AWS-RunPatchBaseline" \
    --task-type "RUN_COMMAND" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --task-invocation-parameters 'RunCommand={Parameters={Operation=["Install"]}}'
```

#### Active Directory メンテナンス
```bash
# AD データベース整合性チェック
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "ntdsutil \"activate instance ntds\" \"files\" \"integrity\" quit quit",
        "dcdiag /v /c /d /e /s:localhost"
    ]'

# DNS スカベンジング設定
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "dnscmd /config /scavenginginterval 168",
        "dnscmd /config /defaultagingstate 1"
    ]'

# レプリケーション状況確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "repadmin /showrepl",
        "repadmin /replsummary"
    ]'
```

#### FSx メンテナンス
```bash
# FSx バックアップ作成
aws fsx create-backup \
    --file-system-id $FSX_ID \
    --tags Key=Name,Value="manual-backup-$(date +%Y%m%d)" \
           Key=Type,Value="maintenance"

# SVM 設定確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-SmbShare",
        "Get-SmbConnection",
        "Test-NetConnection -ComputerName $FSX_DNS_NAME -Port 445"
    ]'
```

### 緊急メンテナンス

#### インスタンス再起動
```bash
# 事前チェック
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Process | Where-Object {$_.ProcessName -eq \"lsass\" -or $_.ProcessName -eq \"winlogon\"}",
        "Get-Service | Where-Object {$_.Status -eq \"Running\" -and $_.StartType -eq \"Automatic\"}"
    ]'

# 安全な再起動
aws ec2 reboot-instances --instance-ids $INSTANCE_ID

# 再起動後確認
sleep 300
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Service ADWS,DNS,KDC,NETLOGON",
        "Test-ComputerSecureChannel -Verbose"
    ]'
```

#### サービス復旧
```bash
# Active Directory サービス再起動
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Restart-Service ADWS -Force",
        "Restart-Service DNS -Force", 
        "Restart-Service KDC -Force",
        "Restart-Service NETLOGON -Force"
    ]'

# サービス状況確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-Service ADWS,DNS,KDC,NETLOGON | Format-Table Name,Status,StartType",
        "Get-EventLog -LogName System -Newest 10 -EntryType Error"
    ]'
```

## 監視・アラート

### CloudWatch ダッシュボード

#### 主要メトリクス
- **CPU使用率**: 閾値 80%
- **メモリ使用率**: 閾値 85%
- **ディスク使用率**: 閾値 80%
- **ネットワーク I/O**: 異常値検出
- **FSx IOPS**: 閾値設定
- **FSx スループット**: 閾値設定

#### カスタムメトリクス
```bash
# Active Directory 固有メトリクス送信
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "$adUsers = (Get-ADUser -Filter *).Count",
        "$adComputers = (Get-ADComputer -Filter *).Count", 
        "aws cloudwatch put-metric-data --namespace \"Custom/ActiveDirectory\" --metric-data MetricName=UserCount,Value=$adUsers,Unit=Count",
        "aws cloudwatch put-metric-data --namespace \"Custom/ActiveDirectory\" --metric-data MetricName=ComputerCount,Value=$adComputers,Unit=Count"
    ]'
```

### アラート設定

#### 重要アラート
```bash
# CPU使用率アラート
aws cloudwatch put-metric-alarm \
    --alarm-name "windows-ad-fsxn-prod-high-cpu" \
    --alarm-description "High CPU utilization" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT:windows-ad-fsxn-prod-alerts \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID

# ディスク容量アラート
aws cloudwatch put-metric-alarm \
    --alarm-name "windows-ad-fsxn-prod-low-disk" \
    --alarm-description "Low disk space" \
    --metric-name "LogicalDisk % Free Space" \
    --namespace CWAgent \
    --statistic Average \
    --period 300 \
    --threshold 20 \
    --comparison-operator LessThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT:windows-ad-fsxn-prod-alerts \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID Name=instance,Value="C:" Name=objectname,Value="LogicalDisk"
```

### ログ監視

#### 重要ログパターン
```bash
# Active Directory エラー監視
aws logs put-metric-filter \
    --log-group-name "/aws/ec2/windows/system" \
    --filter-name "AD-Errors" \
    --filter-pattern "[timestamp, request_id, ERROR]" \
    --metric-transformations \
        metricName=ADErrors,metricNamespace=Custom/ActiveDirectory,metricValue=1

# DNS エラー監視
aws logs put-metric-filter \
    --log-group-name "/aws/ec2/windows/dns" \
    --filter-name "DNS-Errors" \
    --filter-pattern "[timestamp, request_id, ERROR]" \
    --metric-transformations \
        metricName=DNSErrors,metricNamespace=Custom/DNS,metricValue=1
```

## バックアップ・復旧

### 自動バックアップ

#### EBS スナップショット
```bash
# 自動スナップショット設定
aws dlm create-lifecycle-policy \
    --execution-role-arn arn:aws:iam::ACCOUNT:role/AWSDataLifecycleManagerDefaultRole \
    --description "Daily EBS snapshots for Windows AD" \
    --state ENABLED \
    --policy-details '{
        "PolicyType": "EBS_SNAPSHOT_MANAGEMENT",
        "ResourceTypes": ["VOLUME"],
        "TargetTags": [{"Key": "Project", "Value": "windows-ad-fsxn"}],
        "Schedules": [{
            "Name": "DailySnapshots",
            "CreateRule": {"Interval": 24, "IntervalUnit": "HOURS", "Times": ["03:00"]},
            "RetainRule": {"Count": 7},
            "TagsToAdd": [{"Key": "Type", "Value": "AutoSnapshot"}]
        }]
    }'
```

#### FSx バックアップ
```bash
# 自動バックアップ設定確認
aws fsx describe-file-systems --file-system-ids $FSX_ID \
    --query 'FileSystems[0].OntapConfiguration.AutomaticBackupRetentionDays'

# 手動バックアップ作成
aws fsx create-backup \
    --file-system-id $FSX_ID \
    --tags Key=Name,Value="weekly-backup-$(date +%Y%m%d)" \
           Key=Schedule,Value="weekly"
```

### 復旧手順

#### システム復旧
```bash
# 1. 最新スナップショットから復旧
LATEST_SNAPSHOT=$(aws ec2 describe-snapshots \
    --owner-ids self \
    --filters "Name=tag:Project,Values=windows-ad-fsxn" \
    --query 'Snapshots | sort_by(@, &StartTime) | [-1].SnapshotId' \
    --output text)

# 2. 新しいボリューム作成
aws ec2 create-volume \
    --snapshot-id $LATEST_SNAPSHOT \
    --availability-zone ap-northeast-1a \
    --volume-type gp3 \
    --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=windows-ad-recovery}]'

# 3. インスタンス停止・ボリューム交換
aws ec2 stop-instances --instance-ids $INSTANCE_ID
aws ec2 detach-volume --volume-id $OLD_VOLUME_ID
aws ec2 attach-volume --volume-id $NEW_VOLUME_ID --instance-id $INSTANCE_ID --device /dev/sda1
aws ec2 start-instances --instance-ids $INSTANCE_ID
```

#### データ復旧
```bash
# FSx バックアップからの復旧
aws fsx restore-volume-from-snapshot \
    --volume-id $VOLUME_ID \
    --snapshot-id $BACKUP_ID

# Active Directory データベース復旧
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Stop-Service ADWS,DNS,KDC,NETLOGON -Force",
        "ntdsutil \"activate instance ntds\" \"authoritative restore\" \"restore database\" quit quit",
        "Start-Service ADWS,DNS,KDC,NETLOGON"
    ]'
```

## セキュリティ運用

### 定期セキュリティチェック

#### アクセス監査
```bash
# 管理者ログイン確認
aws logs filter-log-events \
    --log-group-name "/aws/ec2/windows/security" \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --filter-pattern "{ $.EventID = 4624 && $.LogonType = 10 }"

# 特権アカウント使用確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-ADUser -Filter {AdminCount -eq 1} -Properties LastLogonDate,PasswordLastSet",
        "Get-EventLog -LogName Security -InstanceId 4672 -Newest 10"
    ]'
```

#### 設定変更監査
```bash
# CloudTrail 設定変更確認
aws logs filter-log-events \
    --log-group-name "CloudTrail/windows-ad-fsxn-prod" \
    --start-time $(date -d '7 days ago' +%s)000 \
    --filter-pattern "{ $.eventName = Put* || $.eventName = Create* || $.eventName = Delete* }"

# Active Directory 設定変更確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-EventLog -LogName \"Directory Service\" -InstanceId 5136,5137,5138,5139 -Newest 20"
    ]'
```

### 脆弱性管理

#### パッチ管理
```bash
# 未適用パッチ確認
aws ssm describe-instance-patch-states \
    --instance-ids $INSTANCE_ID \
    --query 'InstancePatchStates[0].[MissingCount,FailedCount,NotApplicableCount]'

# セキュリティパッチ優先適用
aws ssm send-command \
    --document-name "AWS-RunPatchBaseline" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters "Operation=Install,RebootOption=RebootIfNeeded"
```

#### セキュリティ設定確認
```bash
# Windows セキュリティ設定確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "secedit /export /cfg C:\\temp\\security_config.inf",
        "Get-Content C:\\temp\\security_config.inf"
    ]'

# ファイアウォール設定確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Get-NetFirewallProfile",
        "Get-NetFirewallRule | Where-Object {$_.Enabled -eq \"True\"} | Select-Object DisplayName,Direction,Action"
    ]'
```

## 容量管理

### ストレージ監視
```bash
# ディスク使用量トレンド分析
aws cloudwatch get-metric-statistics \
    --namespace CWAgent \
    --metric-name "LogicalDisk % Free Space" \
    --dimensions Name=InstanceId,Value=$INSTANCE_ID Name=instance,Value="C:" \
    --start-time $(date -d '30 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Minimum

# FSx 容量使用状況
aws cloudwatch get-metric-statistics \
    --namespace AWS/FSx \
    --metric-name StorageUtilization \
    --dimensions Name=FileSystemId,Value=$FSX_ID \
    --start-time $(date -d '30 days ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --statistics Average,Maximum
```

### 容量拡張
```bash
# EBS ボリューム拡張
aws ec2 modify-volume --volume-id $VOLUME_ID --size 300

# Windows 側でのパーティション拡張
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=InstanceIds,Values=$INSTANCE_ID" \
    --parameters 'commands=[
        "Resize-Partition -DriveLetter C -Size (Get-PartitionSupportedSize -DriveLetter C).SizeMax"
    ]'

# FSx 容量拡張
aws fsx modify-file-system \
    --file-system-id $FSX_ID \
    --storage-capacity 2048
```

## 運用自動化

### 定期タスクの自動化
```bash
# Lambda 関数による定期ヘルスチェック
aws lambda create-function \
    --function-name windows-ad-fsxn-health-check \
    --runtime python3.9 \
    --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
    --handler index.lambda_handler \
    --zip-file fileb://health-check.zip \
    --description "Daily health check for Windows AD FSxN environment"

# EventBridge による定期実行設定
aws events put-rule \
    --name "windows-ad-fsxn-daily-check" \
    --schedule-expression "cron(0 9 * * ? *)" \
    --description "Daily health check at 9 AM JST"

aws events put-targets \
    --rule "windows-ad-fsxn-daily-check" \
    --targets "Id=1,Arn=arn:aws:lambda:ap-northeast-1:ACCOUNT:function:windows-ad-fsxn-health-check"
```

### レポート自動生成
```bash
# 週次レポート生成
aws ssm create-document \
    --name "WindowsAD-WeeklyReport" \
    --document-type "Command" \
    --content '{
        "schemaVersion": "2.2",
        "description": "Generate weekly report for Windows AD environment",
        "parameters": {},
        "mainSteps": [{
            "action": "aws:runPowerShellScript",
            "name": "generateReport",
            "inputs": {
                "runCommand": [
                    "$report = @()",
                    "$report += \"=== Windows AD Weekly Report ===\"",
                    "$report += \"Generated: $(Get-Date)\"",
                    "$report += \"Domain: $(Get-ADDomain | Select-Object -ExpandProperty Name)\"",
                    "$report += \"Users: $((Get-ADUser -Filter *).Count)\"",
                    "$report += \"Computers: $((Get-ADComputer -Filter *).Count)\"",
                    "$report | Out-File C:\\temp\\weekly-report.txt",
                    "aws s3 cp C:\\temp\\weekly-report.txt s3://windows-ad-fsxn-reports/weekly-$(Get-Date -Format yyyyMMdd).txt"
                ]
            }
        }]
    }'
```

## 災害復旧

### DR 計画
1. **RTO (Recovery Time Objective)**: 4時間
2. **RPO (Recovery Point Objective)**: 1時間
3. **バックアップ頻度**: 日次（EBS）、週次（FSx）

### DR 手順
```bash
# 1. 災害発生時の初期対応
aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --region ap-northeast-3

# 2. 別リージョンでの復旧
aws cloudformation create-stack \
    --stack-name windows-ad-fsxn-dr \
    --template-body file://windows-ad-fsxn-environment.yaml \
    --parameters file://parameters/dr-environment-parameters.json \
    --region ap-northeast-3

# 3. データ復旧
aws fsx create-file-system-from-backup \
    --backup-id $BACKUP_ID \
    --region ap-northeast-3
```

## 関連ドキュメント

- [デプロイメントガイド](deployment-guide.md)
- [設定管理ガイド](configuration-management.md)
- [セキュリティガイド](security-guide.md)
- [トラブルシューティングガイド](troubleshooting-guide.md)
- [アーキテクチャ設計書](architecture-design.md)