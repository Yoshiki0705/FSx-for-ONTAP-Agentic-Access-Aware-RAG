# よくある質問（FAQ）

## 📋 概要

Embedding Batch Workload Template に関するよくある質問と回答をまとめました。

## 📚 目次

1. [一般的な質問](#一般的な質問)
2. [デプロイメント](#デプロイメント)
3. [設定](#設定)
4. [パフォーマンス](#パフォーマンス)
5. [コスト](#コスト)
6. [セキュリティ](#セキュリティ)
7. [トラブルシューティング](#トラブルシューティング)
8. [運用](#運用)

---

## 一般的な質問

### Q1: このテンプレートは何に使用しますか？

**A**: Amazon FSx for NetApp ONTAP と AWS Batch を使用した大規模文書埋め込み処理ワークロードを構築するためのテンプレートです。以下のユースケースに適しています：

- 大量の文書からの埋め込みベクトル生成
- RAG（Retrieval-Augmented Generation）システムの構築
- 権限ベースの文書アクセス制御
- エンタープライズグレードの文書処理パイプライン

---

### Q2: CDK と CloudFormation のどちらを選ぶべきですか？

**A**: 以下の基準で選択してください：

**CDK を選ぶべき場合**:
- ✅ TypeScript/JavaScript 開発者がいる
- ✅ 継続的な開発・変更が必要
- ✅ プログラマティックな設定が必要
- ✅ テスト自動化を重視

**CloudFormation を選ぶべき場合**:
- ✅ インフラ運用者中心のチーム
- ✅ 安定した本番環境
- ✅ AWS コンソールでの管理を好む
- ✅ 厳格なガバナンス要件

詳細は[デプロイメント選択ガイド](./DEPLOYMENT_SELECTION_GUIDE.md)を参照してください。

---

### Q3: 最小限の構成で始めるには？

**A**: 以下の手順で最小構成から始められます：

1. 既存の VPC と FSx を使用
2. スポットインスタンスを有効化
3. 最小限の vCPU 設定（maxvCpus: 64）
4. 開発環境設定を使用

```json
{
  "projectName": "embedding-minimal",
  "environment": "dev",
  "vpc": { "mode": "existing" },
  "fsx": { "mode": "existing" },
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 64,
      "useSpotInstances": true
    }
  }
}
```

---

### Q4: 本番環境に移行する際の注意点は？

**A**: 以下の点に注意してください：

1. **セキュリティ強化**
   - KMS 暗号化を有効化
   - GuardDuty、CloudTrail を有効化
   - WAF を設定

2. **高可用性**
   - Multi-AZ 構成を使用
   - バックアップを有効化
   - 複数のアベイラビリティゾーンを使用

3. **監視・アラート**
   - 詳細監視を有効化
   - 複数の通知チャネルを設定
   - ログ保持期間を延長（90 日以上）

4. **コスト管理**
   - 予算アラートを設定
   - リソースタグを適切に設定
   - 定期的なコストレビュー

---

## デプロイメント

### Q5: デプロイにどのくらい時間がかかりますか？

**A**: 環境によって異なりますが、一般的な所要時間：

- **初回デプロイ**: 20-30 分
- **更新デプロイ**: 10-15 分
- **削除**: 10-15 分

新規 VPC や FSx を作成する場合は、さらに 10-20 分追加されます。

---

### Q6: デプロイが失敗した場合、どうすればよいですか？

**A**: 以下の手順で対処してください：

1. **エラーメッセージを確認**
   ```bash
   # CloudFormation イベントを確認
   aws cloudformation describe-stack-events \
     --stack-name EmbeddingWorkloadStack \
     --max-items 10
   ```

2. **ロールバック**
   ```bash
   # スタックを削除
   cdk destroy
   ```

3. **設定を修正**
   - エラーメッセージに基づいて設定を修正
   - 設定検証スクリプトを実行

4. **再デプロイ**
   ```bash
   ./scripts/deploy.sh --config config/my-config.json --env dev
   ```

詳細は[トラブルシューティングガイド](./TROUBLESHOOTING_GUIDE.md)を参照してください。

---

### Q7: 既存の VPC を使用する必要がありますか？

**A**: いいえ、必須ではありません。以下の 2 つの選択肢があります：

**既存 VPC を使用**:
```json
{
  "vpc": {
    "mode": "existing",
    "existing": {
      "vpcId": "vpc-xxx",
      "privateSubnetIds": ["subnet-xxx", "subnet-yyy"]
    }
  }
}
```

**新規 VPC を作成**:
```json
{
  "vpc": {
    "mode": "create",
    "create": {
      "cidrBlock": "10.0.0.0/16",
      "availabilityZones": ["ap-northeast-1a", "ap-northeast-1c"],
      "enableNatGateway": true
    }
  }
}
```

---

### Q8: 複数の環境（dev/staging/prod）をデプロイできますか？

**A**: はい、可能です。環境ごとに設定ファイルを作成してください：

```bash
# 開発環境
./scripts/deploy.sh --config config/dev.json --env dev

# ステージング環境
./scripts/deploy.sh --config config/staging.json --env staging

# 本番環境
./scripts/deploy.sh --config config/prod.json --env prod
```

各環境で異なる AWS アカウントやリージョンを使用することも可能です。

---

## 設定

### Q9: 設定ファイルの必須項目は何ですか？

**A**: 以下の項目が必須です：

```json
{
  "projectName": "必須",
  "environment": "必須",
  "region": "必須",
  "vpc": {
    "mode": "必須",
    "existing": {
      "vpcId": "mode=existing の場合必須",
      "privateSubnetIds": "mode=existing の場合必須"
    }
  },
  "fsx": {
    "mode": "必須",
    "existing": {
      "fileSystemId": "mode=existing の場合必須",
      "volumePath": "mode=existing の場合必須",
      "mountPoint": "mode=existing の場合必須"
    }
  }
}
```

---

### Q10: 設定ファイルを検証する方法は？

**A**: 設定検証スクリプトを使用してください：

```bash
# 基本検証
./scripts/validate-config.sh -f config/my-config.json

# 詳細検証
./scripts/validate-config.sh -f config/my-config.json --verbose

# 自動修正付き検証
./scripts/validate-config.sh -f config/my-config.json --fix
```

---

### Q11: Bedrock のリージョンを変更できますか？

**A**: はい、可能です。ただし、Bedrock が利用可能なリージョンに限られます：

```json
{
  "bedrock": {
    "region": "us-east-1"  // または us-west-2
  }
}
```

**利用可能なリージョン**:
- `us-east-1` (バージニア) - 推奨
- `us-west-2` (オレゴン)
- その他の Bedrock 対応リージョン

---

### Q12: インスタンスタイプを変更するには？

**A**: 設定ファイルの `batch.computeEnvironment.instanceTypes` を編集してください：

```json
{
  "batch": {
    "computeEnvironment": {
      "instanceTypes": ["m5.large", "m5.xlarge", "m5.2xlarge"]
    }
  }
}
```

**推奨インスタンスタイプ**:
- 軽量処理: `t3.large`, `t3.xlarge`
- 標準処理: `m5.large`, `m5.xlarge`
- 重量処理: `m5.2xlarge`, `m5.4xlarge`
- メモリ集約: `r5.xlarge`, `r5.2xlarge`

---

## パフォーマンス

### Q13: 処理速度を向上させるには？

**A**: 以下の方法で処理速度を向上できます：

1. **vCPU 数を増やす**
   ```json
   {
     "batch": {
       "computeEnvironment": {
         "maxvCpus": 256  // 64 → 256 に増加
       }
     }
   }
   ```

2. **大きなインスタンスタイプを使用**
   ```json
   {
     "instanceTypes": ["m5.2xlarge", "m5.4xlarge"]
   }
   ```

3. **ジョブ定義のリソースを増やす**
   ```json
   {
     "jobDefinitions": {
       "documentProcessing": {
         "vcpus": 8,  // 2 → 8 に増加
         "memoryMiB": 16384  // 4096 → 16384 に増加
       }
     }
   }
   ```

4. **FSx スループットを増やす**
   ```json
   {
     "fsx": {
       "create": {
         "throughputCapacity": 256  // 128 → 256 に増加
       }
     }
   }
   ```

---

### Q14: 同時実行数を増やすには？

**A**: `maxvCpus` を増やしてください：

```json
{
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 512  // より多くのジョブを同時実行
    }
  }
}
```

**計算例**:
- ジョブあたり 4 vCPU 使用
- maxvCpus = 512
- 同時実行可能ジョブ数 = 512 / 4 = 128 ジョブ

---

### Q15: ジョブがタイムアウトする場合は？

**A**: タイムアウト時間を延長してください：

```json
{
  "jobDefinitions": {
    "documentProcessing": {
      "timeoutSeconds": 7200  // 3600 → 7200 に延長（2 時間）
    }
  }
}
```

**推奨値**:
- 小規模文書: 1800 秒（30 分）
- 中規模文書: 3600 秒（1 時間）
- 大規模文書: 7200 秒（2 時間）
- 画像・動画: 14400 秒（4 時間）

---

## コスト

### Q16: 月額コストはどのくらいですか？

**A**: 処理量によって異なりますが、概算：

| 構成 | 処理量 | 月額コスト |
|---|---|---|
| Small | ~1,000 文書/月 | $50-100 |
| Medium | ~10,000 文書/月 | $200-400 |
| Large | ~100,000 文書/月 | $800-1,500 |
| Enterprise | ~1,000,000 文書/月 | $3,000-6,000 |

**コスト内訳**:
- AWS Batch (EC2): 60-70%
- FSx for NetApp ONTAP: 15-20%
- Bedrock API: 10-15%
- その他（S3、DynamoDB、CloudWatch）: 5-10%

---

### Q17: コストを削減する方法は？

**A**: 以下の方法でコストを削減できます：

1. **スポットインスタンスを使用**
   ```json
   {
     "batch": {
       "computeEnvironment": {
         "useSpotInstances": true,
         "spotBidPercentage": 70
       }
     }
   }
   ```
   **削減効果**: 最大 90%

2. **自動スケーリングを活用**
   ```json
   {
     "batch": {
       "computeEnvironment": {
         "minvCpus": 0,
         "desiredvCpus": 0
       }
     }
   }
   ```
   **削減効果**: 未使用時のコストゼロ

3. **S3 ライフサイクル管理**
   ```json
   {
     "storage": {
       "s3": {
         "lifecycleRules": {
           "transitionToIA": 30,
           "transitionToGlacier": 90,
           "deleteAfter": 365
         }
       }
     }
   }
   ```
   **削減効果**: ストレージコスト 50-70% 削減

4. **予算アラートを設定**
   ```json
   {
     "costOptimization": {
       "budgets": {
         "monthlyBudgetUSD": 1000,
         "alertThreshold": 80
       }
     }
   }
   ```

---

### Q18: スポットインスタンスは安全ですか？

**A**: はい、以下の理由で安全です：

1. **自動リトライ機能**
   - スポットインスタンスが中断されても自動的に再実行

2. **適切な入札率**
   - 70% の入札率で中断リスクは低い

3. **複数のインスタンスタイプ**
   - 複数のインスタンスタイプを指定することで可用性向上

4. **オンデマンドへのフォールバック**
   - スポットが利用できない場合、オンデマンドを使用

**推奨設定**:
```json
{
  "batch": {
    "computeEnvironment": {
      "useSpotInstances": true,
      "spotBidPercentage": 70,
      "instanceTypes": ["m5.large", "m5.xlarge", "m5.2xlarge"]
    }
  }
}
```

---

## セキュリティ

### Q19: データは暗号化されますか？

**A**: はい、以下のレベルで暗号化されます：

1. **保存時の暗号化**
   - S3: デフォルトで暗号化
   - DynamoDB: デフォルトで暗号化
   - FSx: KMS 暗号化（オプション）

2. **転送時の暗号化**
   - 全ての AWS サービス間通信は TLS で暗号化

3. **KMS 暗号化（推奨）**
   ```json
   {
     "security": {
       "encryption": {
         "enableKMSEncryption": true,
         "kmsKeyId": "arn:aws:kms:..."
       }
     }
   }
   ```

---

### Q20: 権限ベースのアクセス制御はどのように機能しますか？

**A**: FSx ファイルパスベースのアクセス制御を実装しています：

1. **ファイルパスの保存**
   - 埋め込み生成時に FSx 上の元ファイルパスを OpenSearch に保存

2. **検索時の権限チェック**
   - RAG 検索時にユーザーの権限を確認
   - アクセス権のある文書のみを結果に含める

3. **実装例**
   ```javascript
   // 検索結果のフィルタリング
   const filteredResults = searchResults.filter(result => {
     const filePath = result._source['x-amz-bedrock-kb-source-uri'];
     return checkUserPermission(userId, filePath);
   });
   ```

詳細は[FSx ファイルパス追跡システムガイド](./FSX_FILE_PATH_TRACKING_SYSTEM.md)を参照してください。

---

### Q21: コンプライアンス要件に対応していますか？

**A**: はい、以下のコンプライアンス機能を提供しています：

| 規制 | 対応状況 | 機能 |
|---|---|---|
| GDPR | ✅ 対応 | データ主権・削除権 |
| HIPAA | ✅ 対応 | 暗号化・監査ログ |
| SOX | ✅ 対応 | 変更管理・監査 |
| PCI DSS | ⚠️ 部分対応 | 暗号化・ネットワーク分離 |

**有効化方法**:
```json
{
  "security": {
    "compliance": {
      "enableGuardDuty": true,
      "enableCloudTrail": true,
      "enableConfig": true
    }
  }
}
```

---

## トラブルシューティング

### Q22: ジョブが RUNNABLE で止まる場合は？

**A**: 以下を確認してください：

1. **コンピュート環境の状態**
   ```bash
   aws batch describe-compute-environments \
     --compute-environments my-project-dev-compute-env
   ```

2. **サブネットの設定**
   - プライベートサブネットを使用しているか
   - NAT Gateway が設定されているか

3. **セキュリティグループ**
   - 必要なポートが開いているか
   - FSx への接続が許可されているか

4. **サービスクォータ**
   - vCPU 制限に達していないか
   - インスタンス制限に達していないか

---

### Q23: FSx に接続できない場合は？

**A**: 以下を確認してください：

1. **セキュリティグループ**
   ```bash
   # FSx のセキュリティグループを確認
   aws fsx describe-file-systems \
     --file-system-ids fs-xxx \
     --query 'FileSystems[0].NetworkInterfaceIds'
   ```

2. **NFS ポート（2049）**
   - セキュリティグループで 2049 ポートが開いているか

3. **ネットワーク接続**
   - Batch コンピュート環境と FSx が同じ VPC にあるか
   - サブネットのルーティングが正しいか

4. **マウント設定**
   - マウントポイントが正しいか
   - ボリュームパスが正しいか

---

### Q24: Bedrock API エラーが発生する場合は？

**A**: 以下を確認してください：

1. **リージョン**
   - Bedrock が利用可能なリージョンか
   - 設定ファイルのリージョンが正しいか

2. **モデル ID**
   - 正しいモデル ID を使用しているか
   - モデルがそのリージョンで利用可能か

3. **権限**
   - IAM ロールに Bedrock の権限があるか
   - モデルアクセスが有効化されているか

4. **クォータ**
   - API レート制限に達していないか
   - リクエストサイズが制限内か

---

## 運用

### Q25: 監視はどのように行いますか？

**A**: 以下の方法で監視できます：

1. **CloudWatch ダッシュボード**
   - 自動作成されるダッシュボードを使用
   - カスタムメトリクスを追加

2. **CloudWatch Alarms**
   ```json
   {
     "monitoring": {
       "alerting": {
         "enableAlerts": true,
         "emailEndpoints": ["ops-team@company.com"]
       }
     }
   }
   ```

3. **X-Ray トレーシング**
   ```json
   {
     "monitoring": {
       "xray": {
         "enableTracing": true,
         "samplingRate": 0.1
       }
     }
   }
   ```

4. **ログ分析**
   ```bash
   # CloudWatch Logs Insights でクエリ
   aws logs start-query \
     --log-group-name /aws/batch/job \
     --start-time $(date -d '1 hour ago' +%s) \
     --end-time $(date +%s) \
     --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
   ```

---

### Q26: バックアップはどのように行いますか？

**A**: 以下の方法でバックアップできます：

1. **S3 バージョニング**
   ```json
   {
     "storage": {
       "s3": {
         "enableVersioning": true
       }
     }
   }
   ```

2. **DynamoDB ポイントインタイムリカバリ**
   ```json
   {
     "storage": {
       "dynamodb": {
         "enablePointInTimeRecovery": true
       }
     }
   }
   ```

3. **FSx 自動バックアップ**
   - FSx コンソールで自動バックアップを設定
   - 日次バックアップを推奨

4. **クロスリージョンレプリケーション**
   - S3 クロスリージョンレプリケーションを設定
   - 災害復旧用

---

### Q27: アップデートはどのように行いますか？

**A**: 以下の手順でアップデートできます：

1. **設定ファイルの更新**
   ```bash
   # 設定ファイルを編集
   vim config/my-config.json
   ```

2. **変更の確認**
   ```bash
   # 差分を確認
   cdk diff
   ```

3. **デプロイ**
   ```bash
   # 更新をデプロイ
   ./scripts/deploy.sh --config config/my-config.json --env dev
   ```

4. **検証**
   ```bash
   # デプロイ結果を確認
   ./scripts/validate.sh --env dev
   ```

---

### Q28: 削除はどのように行いますか？

**A**: 以下の手順で削除できます：

1. **CDK を使用した削除**
   ```bash
   cd cdk
   cdk destroy
   ```

2. **CloudFormation を使用した削除**
   ```bash
   aws cloudformation delete-stack \
     --stack-name EmbeddingWorkloadStack
   ```

3. **手動リソースの削除**
   - S3 バケット内のオブジェクトを削除
   - FSx ファイルシステムを削除（必要な場合）

**注意事項**:
- データは完全に削除されます
- 削除前に必ずバックアップを取得
- 本番環境では慎重に実行

---

## 🔗 関連ドキュメント

- [初心者向けステップバイステップガイド](./BEGINNER_STEP_BY_STEP_GUIDE.md)
- [使用例とベストプラクティス](./USAGE_EXAMPLES_BEST_PRACTICES.md)
- [トラブルシューティングガイド](./TROUBLESHOOTING_GUIDE.md)
- [設定パラメータリファレンス](./CONFIGURATION_PARAMETERS_REFERENCE.md)

---

## 💬 さらにサポートが必要な場合

質問が解決しない場合:

1. [GitHub Issues](https://github.com/your-org/embedding-batch-workload/issues)で検索
2. 新しい Issue を作成
3. [GitHub Discussions](https://github.com/your-org/embedding-batch-workload/discussions)で質問

---

**最終更新**: 2025年11月9日  
**バージョン**: 2.0.0
