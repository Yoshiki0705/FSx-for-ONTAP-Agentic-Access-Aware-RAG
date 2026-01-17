# 実データ検証ガイド

このガイドでは、FSx for ONTAPに実データを配置し、Embedding→OpenSearch Serverlessへの全ワークフローを検証する方法について説明します。

## 概要

実データ検証では以下のプロセスを自動化・検証します：

1. **実データ準備**: 多様な形式のドキュメントを準備
2. **FSxアップロード**: データをFSx for ONTAPに配置
3. **ドキュメント処理**: Batchジョブでドキュメントを処理
4. **エンベディング生成**: Bedrock Titanでエンベディングを生成
5. **OpenSearch投入**: エンベディングをOpenSearch Serverlessに保存
6. **検索品質検証**: 実際のクエリで検索精度を測定
7. **品質分析**: エンベディング品質の定量評価

## 前提条件

### 必要なツール

- AWS CLI (設定済み)
- Python 3.8+
- jq
- bc (計算用)

### 必要なPythonライブラリ

```bash
pip install -r scripts/requirements-analysis.txt
```

### AWS権限

以下のAWS権限が必要です：

- CloudFormation: スタック情報の読み取り
- S3: バケットへの読み書き
- Batch: ジョブの投入・監視
- Bedrock: エンベディング生成
- OpenSearch: 検索実行
- Lambda: 関数の実行

## 実行方法

### 1. 基本的な実行

```bash
# 自動検出されたスタックで実行
./scripts/validate-real-data-workflow.sh

# 特定のスタックを指定
./scripts/validate-real-data-workflow.sh --stack-name my-embedding-stack

# 詳細ログ付きで実行
./scripts/validate-real-data-workflow.sh --verbose
```

### 2. 段階的実行

```bash
# データアップロードのみ
./scripts/validate-real-data-workflow.sh --skip-processing --skip-embedding --skip-search

# 処理とエンベディング生成のみ（アップロードスキップ）
./scripts/validate-real-data-workflow.sh --skip-upload --skip-search

# 検索テストのみ
./scripts/validate-real-data-workflow.sh --skip-upload --skip-processing --skip-embedding
```

### 3. カスタムデータでの実行

```bash
# カスタムデータディレクトリを指定
./scripts/validate-real-data-workflow.sh --data-dir /path/to/your/documents

# カスタムクエリファイルを指定
./scripts/validate-real-data-workflow.sh --queries /path/to/your/queries.json
```

## テストデータ

### 自動生成されるサンプルデータ

スクリプトは以下のサンプルドキュメントを自動生成します：

1. **machine_learning_basics.txt**: 機械学習の基礎概念
2. **deep_learning_guide.md**: ディープラーニングガイド
3. **ai_research_papers.json**: AI研究論文のメタデータ
4. **ml_algorithms_comparison.csv**: 機械学習アルゴリズムの比較
5. **system_architecture.txt**: システムアーキテクチャ仕様

### カスタムデータの準備

独自のテストデータを使用する場合：

```bash
# データディレクトリを作成
mkdir -p ./my-test-data

# ドキュメントを配置
cp /path/to/your/documents/* ./my-test-data/

# 実行時に指定
./scripts/validate-real-data-workflow.sh --data-dir ./my-test-data
```

### テストクエリの設定

`test-data/queries.json`ファイルでテストクエリを定義：

```json
{
  \"queries\": [
    {
      \"id\": \"q1\",
      \"text\": \"What is machine learning?\",
      \"expected_topics\": [\"machine learning\", \"artificial intelligence\"],
      \"category\": \"basic_concepts\"
    },
    {
      \"id\": \"q2\",
      \"text\": \"Explain neural networks\",
      \"expected_topics\": [\"neural networks\", \"deep learning\"],
      \"category\": \"deep_learning\"
    }
  ]
}
```

## エンベディング品質分析

### 基本的な品質分析

```bash
python scripts/analyze-embedding-quality.py \\
  --opensearch-endpoint https://your-opensearch-endpoint \\
  --s3-bucket your-s3-bucket \\
  --embedding-prefix embeddings/20241201-120000 \\
  --queries-file test-data/queries.json \\
  --output-dir ./analysis-results
```

### 分析項目

#### 1. エンベディング分布分析

- **基本統計**: 平均、標準偏差、ノルム分布
- **次元別統計**: 各次元の統計情報
- **ゼロ値比率**: スパース性の評価

#### 2. 意味的類似性分析

- **類似度統計**: コサイン類似度の分布
- **最類似ペア**: 最も類似したドキュメントペア
- **類似度行列**: ドキュメント間の類似度

#### 3. クラスタリング品質分析

- **K-meansクラスタリング**: 自動的なドキュメントグループ化
- **クラスタ内距離**: 各クラスタの凝集度
- **クラスタ構成**: 各クラスタに含まれるドキュメント

#### 4. 次元削減分析

- **PCA分析**: 主成分分析による次元削減
- **寄与率**: 各主成分の説明力
- **必要次元数**: 95%の分散を説明する次元数

#### 5. 検索品質分析

- **検索精度**: クエリに対する検索結果の関連性
- **レスポンス時間**: 検索処理時間
- **関連性スコア**: 期待トピックとの一致度

### 可視化レポート

分析結果は以下の可視化で提供されます：

1. **エンベディング分布**: 2D PCA可視化
2. **ノルム分布**: L2ノルムのヒストグラム
3. **次元別分散**: 各次元の分散プロット
4. **クラスタリング結果**: K-meansクラスタの可視化
5. **類似度行列**: ヒートマップ表示
6. **PCA寄与率**: 累積寄与率グラフ

## 結果の解釈

### 良好な品質指標

#### エンベディング分布
- **平均ノルム**: 0.8-1.2の範囲
- **標準偏差**: 0.1-0.3の範囲
- **ゼロ値比率**: 10%未満

#### 類似性分析
- **平均類似度**: 0.3-0.7の範囲
- **類似度分散**: 0.1-0.3の範囲
- **最大類似度**: 0.9未満（過度な類似を避ける）

#### 検索品質
- **平均関連性スコア**: 0.7以上
- **Top-1精度**: 0.8以上
- **レスポンス時間**: 1秒未満

### 問題のある指標

#### 品質低下の兆候
- **極端に高い類似度**: 全ドキュメントが類似（0.9以上）
- **極端に低い類似度**: 関連性が検出されない（0.1未満）
- **高いゼロ値比率**: スパース性が高すぎる（30%以上）
- **低い検索精度**: 関連性スコア0.5未満

#### 対処方法
1. **前処理の改善**: テキスト正規化、ノイズ除去
2. **チャンクサイズ調整**: ドキュメント分割方法の最適化
3. **モデル変更**: 異なるエンベディングモデルの検討
4. **パラメータ調整**: 検索パラメータの最適化

## トラブルシューティング

### よくある問題

#### 1. エンベディングデータが見つからない

```bash
# S3バケットの確認
aws s3 ls s3://your-bucket/embeddings/ --recursive

# 正しいプレフィックスを指定
python scripts/analyze-embedding-quality.py --embedding-prefix embeddings/correct-path/
```

#### 2. Bedrockアクセスエラー

```bash
# Bedrockサービスの有効化確認
aws bedrock list-foundation-models --region us-east-1

# IAM権限の確認
aws iam get-user
```

#### 3. メモリ不足エラー

```bash
# 大きなデータセットの場合、サンプリングを使用
python scripts/analyze-embedding-quality.py --sample-size 1000
```

#### 4. 可視化エラー

```bash
# 必要なライブラリのインストール
pip install matplotlib seaborn

# ディスプレイ設定（サーバー環境）
export MPLBACKEND=Agg
```

### ログの確認

```bash
# 実行ログの確認
tail -f cdk/test/logs/real-data-validation-*.log

# エラーログの検索
grep -i error cdk/test/logs/real-data-validation-*.log

# 詳細ログの有効化
./scripts/validate-real-data-workflow.sh --verbose
```

## パフォーマンス最適化

### 大規模データセットの処理

#### バッチサイズの調整

```bash
# 小さなバッチで処理
export BATCH_SIZE=100
./scripts/validate-real-data-workflow.sh
```

#### 並列処理の活用

```bash
# 複数のBatchジョブを並列実行
export PARALLEL_JOBS=4
./scripts/validate-real-data-workflow.sh
```

#### メモリ使用量の最適化

```python
# 分析スクリプトでのメモリ最適化
python scripts/analyze-embedding-quality.py \\
  --batch-analysis \\
  --max-memory-gb 8
```

### 処理時間の短縮

#### キャッシュの活用

```bash
# 中間結果のキャッシュ
export USE_CACHE=true
./scripts/validate-real-data-workflow.sh
```

#### 段階的処理

```bash
# 1. データアップロードのみ
./scripts/validate-real-data-workflow.sh --skip-processing --skip-embedding --skip-search

# 2. 処理とエンベディング生成
./scripts/validate-real-data-workflow.sh --skip-upload --skip-search

# 3. 検索テスト
./scripts/validate-real-data-workflow.sh --skip-upload --skip-processing --skip-embedding
```

## CI/CD統合

### GitHub Actions

```yaml
name: Real Data Validation
on:
  schedule:
    - cron: '0 2 * * 1'  # 毎週月曜日2時
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Install dependencies
        run: |
          pip install -r scripts/requirements-analysis.txt
      - name: Run validation
        run: |
          ./scripts/validate-real-data-workflow.sh --verbose
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: cdk/test/logs/
```

### 定期実行の設定

```bash
# crontabに追加
0 2 * * 1 /path/to/validate-real-data-workflow.sh --stack-name production-stack
```

## ベストプラクティス

### データ品質の確保

1. **多様性**: 異なる形式・長さ・トピックのドキュメント
2. **代表性**: 実際の使用ケースを反映したデータ
3. **品質**: ノイズの少ない高品質なテキスト
4. **バランス**: 各カテゴリの適切な分散

### 検証の継続性

1. **定期実行**: 週次または月次での自動検証
2. **閾値監視**: 品質指標の閾値設定とアラート
3. **トレンド分析**: 品質の経時変化の追跡
4. **改善サイクル**: 結果に基づく継続的改善

### セキュリティ考慮事項

1. **データ保護**: 機密データの適切な処理
2. **アクセス制御**: 最小権限の原則
3. **ログ管理**: 機密情報のログ出力回避
4. **暗号化**: 保存時・転送時の暗号化

## まとめ

実データ検証により、以下の価値を得られます：

- **品質保証**: エンベディング品質の定量的評価
- **性能検証**: 実際の使用条件でのパフォーマンス測定
- **問題発見**: 潜在的な問題の早期発見
- **改善指針**: データ駆動による改善方向の特定

定期的な実データ検証により、システムの品質と信頼性を継続的に向上させることができます。