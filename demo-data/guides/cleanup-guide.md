# 環境クリーンアップガイド

このガイドでは、Permission-aware RAG 環境の全リソースを削除する手順を説明します。

---

## 方法1: 自動クリーンアップ（推奨）

ターミナル（Mac の場合はターミナル.app）を開いて、以下のコマンドを順番に実行してください。

### Step 1: プロジェクトフォルダに移動

```bash
cd ~/path/to/FSx-for-ONTAP-Agentic-Access-Aware-RAG
```

> 💡 `~/path/to/` の部分は、実際にプロジェクトをダウンロードした場所に置き換えてください。

### Step 2: まず何が削除されるか確認（安全）

```bash
bash demo-data/scripts/cleanup-all.sh --dry-run
```

このコマンドは実際には何も削除しません。削除対象のリソース一覧が表示されます。

### Step 3: 削除を実行

```bash
bash demo-data/scripts/cleanup-all.sh
```

「続行しますか？」と聞かれたら `yes` と入力して Enter を押してください。

確認プロンプトをスキップする場合:
```bash
bash demo-data/scripts/cleanup-all.sh --force
```

> ⏱ 所要時間: 約30〜60分
> 
> 主なボトルネック:
> - CloudFront Distribution 削除: 5-15分（エッジロケーション伝播）
> - VPC内Lambda関数のENI解放: 最大20-40分（AWS仕様）
> - FSx for ONTAP削除: Volume → SVM → FileSystem で各5-15分

### Step 4: 結果を確認

スクリプト終了時に「✅ 全リソース削除完了」と表示されれば成功です。

「⚠️ 一部リソースが残っています」と表示された場合は、画面に表示されるエラー一覧を確認し、下記の「方法2」を参照してください。

---

## 削除順序と依存関係

スクリプトは以下の順序でリソースを削除します。依存関係を考慮した順序になっています。

```
Step 1:  FSx S3 Access Point 削除（Volume削除の前提条件）
Step 2:  手動作成リソース削除（ECR, CodeBuild, Secrets Manager等）
Step 3:  Bedrock KB データソース + 孤立KB 削除
Step 4:  動的 Bedrock Agent 削除
Step 5:  Embedding スタック削除
Step 6:  CDK destroy（全スタック一括削除を試行）
Step 7:  FSx リソース強制削除（CDK失敗時フォールバック）
         → S3AP → Volume → SVM → FileSystem の順
Step 8:  残留スタック個別削除（WebApp → AI → Security → Storage）
Step 9:  孤立リソース削除（OpenLDAP, ENI, SG等）
Step 10: Networking スタック削除（VPC削除）
Step 11: S3 Vectors + CloudWatch Logs 削除
Step 12: CDKToolkit 削除
```

> ⚠️ **重要**: FSx S3 Access Point が残っていると Volume 削除が `BadRequest` で失敗し、
> Storage スタック削除が失敗 → Networking スタック削除もブロックされます。
> スクリプトは Step 1 で S3AP を先に削除し、Step 7 でフォールバック削除も行います。

---

## 方法2: AWSコンソールから手動削除

自動スクリプトで削除できなかったリソースがある場合、AWSコンソール（ブラウザ）から手動で削除できます。

### 確認すべきサービス一覧

以下のAWSサービスを順番に確認してください。リージョンは **東京 (ap-northeast-1)** です。

| # | サービス | 確認場所 | 削除対象 |
|---|---------|---------|---------|
| 1 | CloudFormation | [スタック一覧](https://ap-northeast-1.console.aws.amazon.com/cloudformation/) | `perm-rag-` で始まるスタック |
| 2 | FSx | [ファイルシステム](https://ap-northeast-1.console.aws.amazon.com/fsx/home#file-systems) | `perm-rag-` タグ付きFS |
| 3 | Bedrock | [ナレッジベース](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/knowledge-bases) | `perm-rag-` で始まるKB |
| 4 | Bedrock | [エージェント](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/agents) | `perm-rag-` で始まるAgent |
| 5 | S3 | [バケット一覧](https://s3.console.aws.amazon.com/s3/buckets) | `perm-rag-` で始まるバケット |
| 6 | ECR | [リポジトリ](https://ap-northeast-1.console.aws.amazon.com/ecr/repositories) | `permission-aware-rag-webapp` |
| 7 | EC2 | [インスタンス](https://ap-northeast-1.console.aws.amazon.com/ec2/home#Instances) | `perm-rag-` タグ付きインスタンス |
| 8 | EC2 | [ネットワークインターフェース](https://ap-northeast-1.console.aws.amazon.com/ec2/home#NIC) | VPC内の残留ENI |

> ⚠️ WAFスタックは **バージニア北部 (us-east-1)** リージョンにあります。リージョンを切り替えて確認してください。

### FSx for ONTAP が削除できない場合

FSx リソースは以下の順序で削除する必要があります:

1. **S3 Access Point** を先に削除
   ```bash
   # S3AP一覧確認
   aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
     --query 'S3AccessPointAttachments[?contains(Name, `perm-rag`)].Name' --output text
   
   # 各S3APを削除
   aws fsx detach-and-delete-s3-access-point --name <S3AP名> --region ap-northeast-1
   ```

2. **非ルートボリューム** を削除
   ```bash
   aws fsx delete-volume --volume-id <ボリュームID> \
     --ontap-configuration '{"SkipFinalBackup":true}' --region ap-northeast-1
   ```

3. **SVM** を削除（ルートボリュームは自動削除）
   ```bash
   aws fsx delete-storage-virtual-machine --storage-virtual-machine-id <SVM-ID> --region ap-northeast-1
   ```

4. **ファイルシステム** を削除
   ```bash
   aws fsx delete-file-system --file-system-id <FS-ID> \
     --ontap-configuration '{"SkipFinalBackup":true}' --region ap-northeast-1
   ```

### Bedrock ナレッジベースが削除できない場合

「DELETE_UNSUCCESSFUL」と表示される場合は、以下の手順で対処してください:

1. ナレッジベースを開く
2. 「データソース」タブを選択
3. 各データソースの「編集」をクリック
4. 「データ削除ポリシー」を「保持（Retain）」に変更して保存
5. データソースを削除
6. データソースが全て消えたら、ナレッジベースを削除

### CloudFormation スタックが DELETE_FAILED の場合

```bash
# 失敗リソースを確認
aws cloudformation describe-stack-resources --stack-name <スタック名> --region ap-northeast-1 \
  --query "StackResources[?ResourceStatus=='DELETE_FAILED'].LogicalResourceId" --output text

# 失敗リソースをスキップして再削除
aws cloudformation delete-stack --stack-name <スタック名> \
  --retain-resources <リソースID1> <リソースID2> --region ap-northeast-1
```

---

## 削除後の確認

全てのリソースが削除されたことを確認するには:

```bash
bash demo-data/scripts/cleanup-all.sh --dry-run
```

何も表示されなければ、全リソースが正常に削除されています。

---

## よくある質問

### Q: FSx for ONTAP は削除されますか？

CDKで作成されたFSx for ONTAPは自動削除されます。`existingFileSystemId` を指定してデプロイした場合、FSx for ONTAP 自体は削除されません（CDK管理外のため）。

### Q: CDKToolkit は削除すべきですか？

CDKToolkit は他のCDKプロジェクトでも共有されるリソースです。このプロジェクト専用のAWSアカウントであれば削除して問題ありません。他のCDKプロジェクトがある場合は、CDKToolkit の削除はスキップしてください。

### Q: 削除にかかるコストは？

削除操作自体にコストはかかりません。ただし、削除が完了するまでの間、リソースの稼働コストは発生し続けます。

### Q: 所要時間が長い理由は？

主なボトルネックは以下の3つです（いずれもAWS側の仕様）:
- **CloudFront Distribution**: エッジロケーションからの無効化伝播に5-15分
- **VPC内Lambda関数**: ENI（Elastic Network Interface）の解放に最大20-40分
- **FSx for ONTAP**: Volume → SVM → FileSystem の順序削除で各5-15分
