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

> ⏱ 所要時間: 約5〜15分（リソースの量によります）

### Step 4: 結果を確認

スクリプト終了時に「✅ 全リソース削除完了」と表示されれば成功です。

「⚠️ 一部リソースが残っています」と表示された場合は、画面に表示されるエラー一覧を確認し、下記の「方法2」を参照してください。

---

## 方法2: AWSコンソールから手動削除

自動スクリプトで削除できなかったリソースがある場合、AWSコンソール（ブラウザ）から手動で削除できます。

### 確認すべきサービス一覧

以下のAWSサービスを順番に確認してください。リージョンは **東京 (ap-northeast-1)** です。

| # | サービス | 確認場所 | 削除対象 |
|---|---------|---------|---------|
| 1 | CloudFormation | [スタック一覧](https://ap-northeast-1.console.aws.amazon.com/cloudformation/) | `perm-rag-` で始まるスタック |
| 2 | Bedrock | [ナレッジベース](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/knowledge-bases) | `perm-rag-` で始まるKB |
| 3 | Bedrock | [エージェント](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/agents) | `perm-rag-` で始まるAgent |
| 4 | S3 | [バケット一覧](https://s3.console.aws.amazon.com/s3/buckets) | `perm-rag-` で始まるバケット |
| 5 | ECR | [リポジトリ](https://ap-northeast-1.console.aws.amazon.com/ecr/repositories) | `permission-aware-rag-webapp` |
| 6 | EC2 | [インスタンス](https://ap-northeast-1.console.aws.amazon.com/ec2/home#Instances) | `perm-rag-` タグ付きインスタンス |

> ⚠️ WAFスタックは **バージニア北部 (us-east-1)** リージョンにあります。リージョンを切り替えて確認してください。

### Bedrock ナレッジベースが削除できない場合

「DELETE_UNSUCCESSFUL」と表示される場合は、以下の手順で対処してください:

1. ナレッジベースを開く
2. 「データソース」タブを選択
3. 各データソースの「編集」をクリック
4. 「データ削除ポリシー」を「保持（Retain）」に変更して保存
5. データソースを削除
6. データソースが全て消えたら、ナレッジベースを削除

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

`existingFileSystemId` を指定してデプロイした場合、FSx for ONTAP 自体は削除されません（CDK管理外のため）。FSx for ONTAP を削除する場合は、AWSコンソールから手動で削除してください。

### Q: CDKToolkit は削除すべきですか？

CDKToolkit は他のCDKプロジェクトでも共有されるリソースです。このプロジェクト専用のAWSアカウントであれば削除して問題ありません。他のCDKプロジェクトがある場合は、CDKToolkit の削除はスキップしてください。

### Q: 削除にかかるコストは？

削除操作自体にコストはかかりません。ただし、削除が完了するまでの間、リソースの稼働コストは発生し続けます。
