# FSx for ONTAP Embedding 負荷試験ガイド

このガイドでは、SQLite UNIQUE制約エラー（`SQLITE_CONSTRAINT_UNIQUE`）の課題に対する負荷試験の実行方法について説明します。

## 概要

### 対象となる課題

以前に発生していた以下の問題に対する負荷試験を実行します：

```
SqliteError: UNIQUE constraint failed: files.ino
    at PreparedQuery.values (file:///opt/netapp/ai/node_modules/drizzle-orm/better-sqlite3/session.js:100:28)
```

この問題は、複数ファイルを一度にアップロードした際に、ファイルのinode（`files.ino`）が重複することで発生していました。

### 試験目的

1. **修正の検証**: コードレベルでの対処が有効かを確認
2. **負荷耐性**: 大量ファイルの同時処理に対する耐性を測定
3. **パフォーマンス**: スループットとレスポンス時間の測定
4. **安定性**: 長時間の連続処理での安定性確認

## 環境準備

### 1. EC2 Windowsインスタンスの準備

#### インスタンス要件
- **インスタンスタイプ**: t3.large以上（推奨: m5.xlarge）
- **OS**: Windows Server 2019/2022
- **ストレージ**: 100GB以上の空き容量
- **ネットワーク**: 既存のVPC内に配置

#### 必要なソフトウェア
- PowerShell 5.1以上
- AWS CLI
- .NET Framework 4.7.2以上

### 2. FSx for ONTAP新ボリュームの作成

#### AWS CLIでの作成例

```bash
# FSx for ONTAPファイルシステム情報の確認
aws fsx describe-file-systems --query 'FileSystems[?FileSystemType==`ONTAP`]'

# 新ボリュームの作成
aws fsx create-volume \
    --volume-type ONTAP \
    --name embedding-load-test \
    --ontap-configuration '{
        "SizeInMegabytes": 102400,
        "StorageVirtualMachineId": "svm-xxxxxxxxx",
        "JunctionPath": "/embedding-load-test",
        "SecurityStyle": "MIXED",
        "StorageEfficiencyEnabled": true
    }'
```

#### NetApp ONTAP CLIでの作成例

```bash
# SVMにログイン
ssh fsxadmin@your-fsx-dns-name

# ボリューム作成
volume create -vserver your-svm-name -volume embedding_load_test -aggregate aggr1 -size 100GB -junction-path /embedding_load_test

# NFSエクスポート設定
vserver export-policy rule create -vserver your-svm-name -policyname default -clientmatch 0.0.0.0/0 -rorule any -rwrule any -superuser any
```

### 3. FSxマウント設定

#### Windows EC2での自動設定

```powershell
# FSxマウント設定スクリプトの実行
.\setup-fsx-mount-windows.ps1 -FSxDNSName "your-fsx-dns-name" -SVMName "your-svm-name" -VolumeName "embedding_load_test" -CreateVolume

# 手動マウント（設定済みの場合）
mount -o anon your-fsx-dns-name:/embedding_load_test Z:
```

## 負荷試験の実行

### 1. 基本的な負荷試験

#### 小規模テスト（20ファイル、バッチサイズ20）

```powershell
# 問題が発生していた条件での試験
.\load-test-fsx-embedding.ps1 -FileCount 20 -BatchSize 20 -FSxMountPath "Z:\" -Verbose
```

#### 中規模テスト（100ファイル、バッチサイズ50）

```powershell
# 中規模での安定性確認
.\load-test-fsx-embedding.ps1 -FileCount 100 -BatchSize 50 -DelayBetweenBatches 2 -Verbose
```

#### 大規模テスト（500ファイル、バッチサイズ100）

```powershell
# 大規模での性能確認
.\load-test-fsx-embedding.ps1 -FileCount 500 -BatchSize 100 -DelayBetweenBatches 1 -Verbose
```

### 2. 段階的負荷試験

#### ステップ1: 問題再現テスト

```powershell
# 以前の問題条件を再現
.\load-test-fsx-embedding.ps1 -FileCount 20 -BatchSize 20 -DelayBetweenBatches 0 -Verbose
```

#### ステップ2: 修正効果確認

```powershell
# バッチサイズを段階的に増加
foreach ($batchSize in @(10, 20, 50, 100)) {
    Write-Host "バッチサイズ $batchSize でテスト実行中..."
    .\load-test-fsx-embedding.ps1 -FileCount 100 -BatchSize $batchSize -DelayBetweenBatches 1 -Verbose
    Start-Sleep -Seconds 30
}
```

#### ステップ3: 限界値測定

```powershell
# 最大処理能力の測定
.\load-test-fsx-embedding.ps1 -FileCount 1000 -BatchSize 200 -DelayBetweenBatches 0 -Verbose
```

### 3. Linux/macOSでの実行

```bash
# 実行権限の付与
chmod +x load-test-fsx-embedding.sh

# 基本テスト
./load-test-fsx-embedding.sh -c 100 -b 20 -m /mnt/fsx -v

# 大規模テスト
./load-test-fsx-embedding.sh -c 500 -b 100 -w 1 -v
```

## 結果の分析

### 1. 成功指標

#### 基本指標
- **成功率**: 95%以上
- **エラー発生率**: 5%未満
- **スループット**: 10ファイル/秒以上

#### 安定性指標
- **SQLite制約エラー**: 0件
- **ファイルシステムエラー**: 0件
- **タイムアウトエラー**: 5%未満

### 2. パフォーマンス分析

#### 生成されるレポート

```
=== 負荷試験結果分析 ===
総ファイル数: 100
成功: 98
失敗: 2
成功率: 98.00%
総実行時間: 45.67秒
平均バッチ時間: 9.13秒
スループット: 2.19 ファイル/秒
```

#### CSVレポートの活用

```powershell
# 結果CSVの分析
$results = Import-Csv "load-test-results-20241022-120000.csv"
$results | Measure-Object -Property Duration -Average -Maximum -Minimum
$results | Group-Object -Property SuccessCount | Select-Object Name, Count
```

### 3. 問題の特定

#### SQLite制約エラーの確認

```bash
# ログファイルでエラーを検索
grep -i "SQLITE_CONSTRAINT_UNIQUE" load-test-*.log
grep -i "files.ino" load-test-*.log
```

#### パフォーマンスボトルネックの特定

```powershell
# バッチ時間の分析
$results | Sort-Object Duration -Descending | Select-Object -First 5
```

## トラブルシューティング

### 1. よくある問題

#### FSxマウントエラー

```
エラー: FSxマウントパスに書き込み権限がありません
```

**解決方法:**
```powershell
# NFSクライアント機能の確認
Get-WindowsFeature -Name "NFS-Client"

# 管理者権限でマウント
mount -o anon your-fsx-dns-name:/volume_name Z:
```

#### 権限エラー

```
エラー: Access denied
```

**解決方法:**
```bash
# NFSエクスポートポリシーの確認
vserver export-policy rule show -vserver your-svm-name
```

#### パフォーマンス低下

```
スループット: 0.5 ファイル/秒 (期待値: 10ファイル/秒)
```

**解決方法:**
- バッチサイズの調整
- バッチ間隔の最適化
- ネットワーク帯域の確認
- FSxパフォーマンスモードの確認

### 2. 高度なトラブルシューティング

#### ネットワーク診断

```powershell
# FSxへの接続確認
Test-NetConnection -ComputerName your-fsx-dns-name -Port 2049

# 帯域幅テスト
iperf3 -c your-fsx-dns-name -t 30
```

#### システムリソース監視

```powershell
# CPU・メモリ使用率の監視
Get-Counter "\Processor(_Total)\% Processor Time", "\Memory\Available MBytes" -SampleInterval 5 -MaxSamples 60
```

## 継続的監視

### 1. 定期実行の設定

#### Windows タスクスケジューラ

```powershell
# 毎日の負荷試験タスク作成
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\load-test-fsx-embedding.ps1 -FileCount 50 -BatchSize 25"
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
Register-ScheduledTask -TaskName "FSx-LoadTest-Daily" -Action $action -Trigger $trigger
```

#### Linux cron

```bash
# 毎日午前2時に実行
echo "0 2 * * * /path/to/load-test-fsx-embedding.sh -c 50 -b 25" | crontab -
```

### 2. アラート設定

#### CloudWatch メトリクス

```bash
# カスタムメトリクスの送信
aws cloudwatch put-metric-data \
    --namespace "FSx/LoadTest" \
    --metric-data MetricName=SuccessRate,Value=98.5,Unit=Percent
```

#### SNS通知

```powershell
# 失敗率が閾値を超えた場合の通知
if ($failureRate -gt 5) {
    aws sns publish --topic-arn "arn:aws:sns:region:account:fsx-alerts" --message "FSx負荷試験で失敗率が閾値を超えました: $failureRate%"
}
```

## ベストプラクティス

### 1. 試験設計

- **段階的実行**: 小規模→中規模→大規模の順で実行
- **ベースライン確立**: 正常時の性能指標を記録
- **再現性確保**: 同じ条件で複数回実行
- **環境分離**: 本番環境への影響を避ける

### 2. データ管理

- **テストデータ**: 実際のファイルサイズ・形式を模擬
- **クリーンアップ**: 試験後のデータ削除を自動化
- **バックアップ**: 重要なテスト結果の保存

### 3. 監視・分析

- **リアルタイム監視**: 試験中のシステム状態監視
- **トレンド分析**: 長期的な性能変化の追跡
- **根本原因分析**: 問題発生時の詳細調査

これらの手順に従って負荷試験を実行することで、SQLite制約エラーの修正効果を検証し、システムの安定性とパフォーマンスを確認できます。