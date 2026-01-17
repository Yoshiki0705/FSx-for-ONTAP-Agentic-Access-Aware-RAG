# MCP統合版 AWS Batch 負荷試験スイート

## 概要

このMCP（Model Context Protocol）統合版負荷試験スイートは、AWS Batchワークロードのパフォーマンステストにリアルタイムコスト監視と最適化機能を追加したものです。

## 主な機能

### 🔄 MCP統合機能
- **リアルタイムコスト監視**: テスト実行中の継続的なコスト追跡
- **自動コスト制限**: 設定した予算を超過する前に自動停止
- **最適化推奨事項**: AI駆動のコスト削減提案
- **予測的分析**: 将来のコスト予測とアラート

### 📊 拡張ダッシュボード
- **CloudWatch統合**: カスタムメトリクスとアラーム
- **HTMLレポート**: インタラクティブなコスト分析
- **リアルタイム更新**: 実行中のライブ監視
- **コスト内訳**: サービス別詳細分析

### 🎯 最適化機能
- **Spotインスタンス推奨**: 最大70%のコスト削減
- **オートスケーリング**: アイドル時間の最小化
- **リソース効率**: 適切なインスタンスタイプの提案

## ⚠️ 重要: リージョン設定について

このMCP統合版負荷試験スイートは、**FSx for ONTAPリソースがデプロイされているリージョン**で実行する必要があります。

### リージョン要件
- **推奨リージョン**: `ap-northeast-1` (東京) または `ap-northeast-3` (大阪)
- **理由**: FSx for ONTAPファイルシステムとの接続が必要
- **ネットワーク**: 同一リージョン内のVPC接続が必要

### リージョン不整合の場合
異なるリージョンで実行すると以下の問題が発生します：
- FSx for ONTAPファイルシステムにアクセスできない
- VPC間のネットワーク接続がない
- マウントテストが失敗する

**解決策**: `--simulation` オプションを使用してシミュレーションモードで実行

## FSx for ONTAPボリューム設定

### 自動検出機能
スクリプトは以下のFSx for ONTAPリソースを自動検出します：
- **ファイルシステムID**: 指定リージョンの最初のONTAPファイルシステム
- **SVM名**: ファイルシステム内の最初のSVM
- **ボリューム名**: SVM内の最初のボリューム
- **NFSエクスポートパス**: ボリューム名から自動構築

### 手動指定
特定のリソースを指定する場合：
```bash
# 特定のFSxリソースを指定
./scripts/load-test-aws-batch.sh \
  --fsx-filesystem-id fs-0123456789abcdef0 \
  --fsx-volume-name vol1 \
  --fsx-svm-name svm01 \
  --mount-path /mnt/fsx
```

### 設定ファイル
`config/batch-load-test.conf` で詳細設定が可能：
```bash
# FSx for ONTAP設定
FSX_FILESYSTEM_ID="fs-0123456789abcdef0"
FSX_VOLUME_NAME="vol1"
FSX_SVM_NAME="svm01"
FSX_MOUNT_PATH="/mnt/fsx"
NFS_VERSION="3"
NFS_OPTIONS="rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2"
```

## クイックスタート

### 1. 基本実行（推奨）
```bash
# デフォルト設定でMCP統合負荷試験を実行（東京リージョン、FSx for ONTAP使用）
./scripts/run-mcp-integrated-load-test.sh
```

### 2. カスタム設定での実行
```bash
# コスト制限を50ドルに設定して実行
./scripts/run-mcp-integrated-load-test.sh --max-cost 50.00

# 大阪リージョンで実行（FSx for ONTAPリソースがある場合）
./scripts/run-mcp-integrated-load-test.sh --region ap-northeast-3

# シミュレーションモード（FSxリソース不要）
./scripts/run-mcp-integrated-load-test.sh --simulation

# MCP統合を無効化して実行
./scripts/run-mcp-integrated-load-test.sh --disable-mcp
```

### 3. 個別コンポーネントの実行
```bash
# 負荷試験スイートのみ実行
./scripts/run-batch-load-test-suite.sh

# ダッシュボードのみ生成
./scripts/generate-batch-dashboard.sh --enable-mcp

# 個別の負荷試験実行
./scripts/load-test-aws-batch.sh
```

## 設定オプション

### 環境変数
```bash
# MCP統合の有効化/無効化
export MCP_ENABLED=true

# 最大コスト制限（USD）
export MAX_TOTAL_COST=100.00

# AWSリージョン（FSx for ONTAPリソースがあるリージョン）
export REGION=ap-northeast-1

# コスト監視間隔（秒）
export COST_CHECK_INTERVAL=60
```

### テストシナリオ設定
```bash
# 軽量テスト（開発用）
CONCURRENT_JOBS=2 TEST_DURATION=180 ./scripts/load-test-aws-batch.sh

# 中規模テスト（ステージング用）
CONCURRENT_JOBS=5 TEST_DURATION=300 ./scripts/load-test-aws-batch.sh

# 大規模テスト（本番検証用）
CONCURRENT_JOBS=10 TEST_DURATION=600 ./scripts/load-test-aws-batch.sh
```

## 出力ファイル

### レポート構造
```
reports/mcp-integrated-test-YYYYMMDD-HHMMSS/
├── mcp-integrated-test-report.md          # 最終レポート
├── final_cost_analysis.json               # コスト分析詳細
├── dashboard/
│   ├── batch-load-test-report.html        # HTMLダッシュボード
│   └── metrics-summary.json               # メトリクス概要
├── test-results/
│   ├── test-summary.txt                   # テスト結果概要
│   ├── light-test-*.log                   # 軽量テストログ
│   ├── medium-test-*.log                  # 中規模テストログ
│   └── heavy-test-*.log                   # 大規模テストログ
└── metrics/
    ├── cost_metrics.json                  # MCPコストデータ
    ├── cost_optimization_report.html      # 最適化レポート
    ├── performance-stats.json             # パフォーマンス統計
    └── throughput-analysis.json           # スループット分析
```

### CloudWatchダッシュボード
- **URL**: `https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#dashboards:name=EmbeddingBatchLoadTest`
- **メトリクス**: ジョブ状況、成功率、実行時間、コスト推移
- **アラーム**: コスト制限、失敗率、パフォーマンス劣化

## MCP統合の詳細

### コスト監視アーキテクチャ
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Load Test     │───▶│   MCP Server     │───▶│  Cost Explorer │
│   Scripts       │    │   Integration    │    │     API         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Real-time     │    │   Optimization   │    │   CloudWatch    │
│   Monitoring    │    │   Recommendations│    │   Metrics       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### コスト最適化フロー
1. **初期評価**: 現在のコスト状況を分析
2. **リアルタイム監視**: テスト実行中の継続的な追跡
3. **閾値チェック**: 設定した制限に対する監視
4. **自動停止**: 予算超過時の自動的なテスト停止
5. **最適化提案**: AI駆動の改善推奨事項

## トラブルシューティング

### よくある問題

#### 1. MCP統合が動作しない
```bash
# MCP設定の確認
echo "MCP_ENABLED: $MCP_ENABLED"

# 必要なツールの確認
command -v bc || echo "bc が必要です: brew install bc"
command -v jq || echo "jq が必要です: brew install jq"
```

#### 2. コスト制限が機能しない
```bash
# 現在のコスト確認
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity DAILY \
  --metrics BlendedCost
```

#### 3. ダッシュボード生成エラー
```bash
# CloudWatch権限の確認
aws cloudwatch describe-dashboards --region us-east-1

# HTMLレポート生成の確認
ls -la reports/*/dashboard/
```

### ログの確認
```bash
# 実行ログの確認
tail -f reports/mcp-integrated-test-*/test-results/*.log

# コストログの確認
grep "COST" reports/mcp-integrated-test-*/test-results/*.log

# エラーログの確認
grep "ERROR" reports/mcp-integrated-test-*/test-results/*.log
```

## 高度な使用方法

### カスタムコスト制限の設定
```bash
# シナリオ別コスト制限
export LIGHT_SCENARIO_COST=5.00
export MEDIUM_SCENARIO_COST=15.00
export HEAVY_SCENARIO_COST=30.00

# 実行
./scripts/run-batch-load-test-suite.sh
```

### 複数リージョンでの実行
```bash
# 複数リージョンでの並列実行
for region in us-east-1 ap-northeast-1 eu-west-1; do
  REGION=$region ./scripts/run-mcp-integrated-load-test.sh &
done
wait
```

### CI/CD統合
```yaml
# GitHub Actions例
- name: Run MCP Integrated Load Test
  run: |
    ./scripts/run-mcp-integrated-load-test.sh \
      --max-cost 25.00 \
      --region us-east-1 \
      --no-cleanup
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## ベストプラクティス

### 1. コスト管理
- 開発環境では低いコスト制限を設定
- 本番検証では段階的にコスト制限を上げる
- 定期的なコスト分析レポートの確認

### 2. パフォーマンス最適化
- Spotインスタンスの積極的な活用
- オートスケーリング設定の調整
- 適切なインスタンスタイプの選択

### 3. 監視とアラート
- CloudWatchアラームの設定
- コスト異常の早期検出
- パフォーマンス劣化の監視

## サポート

### ドキュメント
- [AWS Batch ユーザーガイド](https://docs.aws.amazon.com/batch/)
- [AWS Cost Explorer API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/)
- [CloudWatch メトリクス](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)

### 問題報告
問題や改善提案がある場合は、以下の情報を含めてご報告ください：
- 実行環境（OS、AWSリージョン）
- エラーメッセージ
- 実行時のログファイル
- 使用した設定値

---

*このMCP統合版負荷試験スイートは、コスト効率的なAWS Batchワークロードの開発と運用を支援します。*