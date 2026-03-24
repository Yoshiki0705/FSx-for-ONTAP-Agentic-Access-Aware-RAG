# 検証結果レポート

検証日: 2026-03-24
リージョン: ap-northeast-1（東京）

---

## 1. CDKデプロイ結果

6スタック全てデプロイ成功。

| Stack | Status | 主要リソース |
|-------|--------|-------------|
| WafStack (us-east-1) | ✅ | WebACL（6ルール）、IP Set |
| NetworkingStack | ✅ | VPC、Public/Private Subnets、Security Groups |
| SecurityStack | ✅ | Cognito User Pool、Client |
| StorageStack | ✅ | FSx ONTAP、S3、DynamoDB×2 |
| AIStack | ✅ | Bedrock KB、OpenSearch Serverless |
| WebAppStack | ✅ | Lambda、CloudFront |

---

## 2. 7つの仕様に対する検証状況

| # | 仕様 | 状態 | 備考 |
|---|------|------|------|
| 1 | Next.js RAG Chatbot on Lambda | ✅ | Lambda Web Adapter + CloudFront構成で動作確認 |
| 2 | AWS WAF（IP/Geo保護） | ✅ | 6ルール（Rate Limit、IP Reputation、Common Rule Set、Bad Inputs、SQLi、IP Allow List）+ Geo制限（JP） |
| 3 | API IAM認証 | ⚠️ | Lambda Function URL IAM Auth + CloudFront OACで構築。POSTリクエストのSigV4署名問題（InvalidSignatureException）のため、検証環境ではFunction URL AuthType=NONEに変更。WAF + Geo制限で保護。CDKコード上はIAM Auth構成を維持 |
| 4 | ベクトルDB選択可能（Aurora/AOSS） | ⚠️ | 現在はAOSS（OpenSearch Serverless）のみ実装。Aurora Serverless v2は未実装 |
| 5 | Embedding（Bedrock KB経由） | ✅ | Bedrock KBがS3データソースからTitan Embeddings v2でベクトル化を実行 |
| 6 | Amazon Titan Text Embeddings v2 | ✅ | Bedrock KB設定で`amazon.titan-embed-text-v2:0`を使用 |
| 7 | SIDベース権限フィルタリング | ✅ | DynamoDB user-accessテーブル + メタデータSID照合で動作確認済み（詳細は後述） |

---

## 3. SIDフィルタリング検証結果

### 3.1 テストユーザー

| ユーザー | 個人SID | グループSID | 期待アクセス |
|---------|---------|------------|------------|
| admin@example.com | `...-500` (Administrator) | `...-512` (Domain Admins), `S-1-1-0` (Everyone) | 全ドキュメント |
| user@example.com | `...-1001` (Regular User) | `S-1-1-0` (Everyone) | publicのみ |

### 3.2 テスト結果

#### テスト1: 管理者 — 「会社の売上はいくらですか？」

- 結果: ✅ 成功
- 検索ドキュメント数: 1、許可: 1、拒否: 0
- フィルタ方式: SID_MATCHING
- `financial-report.md`: ALLOW（ドキュメントSID `...-512` がユーザーのDomain Admins SIDにマッチ）
- 回答: 財務レポートの売上情報を含む回答が返却

#### テスト2: 一般ユーザー — 「会社の売上はいくらですか？」

- 結果: ✅ SIDフィルタリング正常動作
- 検索ドキュメント数: 1、許可: 0、拒否: 1
- フィルタ方式: SID_MATCHING
- `financial-report.md`: DENY（ドキュメントSID `...-512` がユーザーのSIDリスト `[-1001, S-1-1-0]` にマッチしない）
- citation（参照ドキュメント）は空で返却

#### テスト3: 一般ユーザー — 「製品の概要を教えてください」

- 結果: ✅ 成功
- 検索ドキュメント数: 2、許可: 2、拒否: 0
- フィルタ方式: SID_MATCHING
- `product-catalog.md`: ALLOW（ドキュメントSID `S-1-1-0` がユーザーのEveryoneグループにマッチ）
- 回答: 製品情報が正しく返却

#### テスト4: 管理者 — 「製品の概要を教えてください」

- 結果: ✅ 成功
- 検索ドキュメント数: 2、許可: 2、拒否: 0
- `product-catalog.md`: ALLOW（`S-1-1-0`マッチ）

### 3.3 SIDフィルタリングの制約事項

Bedrock KB `RetrieveAndGenerate` APIは回答生成とドキュメント取得を一体で実行するため、回答テキスト自体のフィルタリングはAPI応答後に行えない。現在の実装ではcitation（参照ドキュメント情報）のフィルタリングを行い、アクセス権のないドキュメントのcitationを除外している。

完全な回答フィルタリングを実現するには、`Retrieve` API（検索のみ）でドキュメントを取得 → SIDフィルタリング → フィルタ済みドキュメントでLLMに回答生成、という2段階処理が必要。

---

## 4. デプロイ中に発生した問題と対処

### 4.1 CloudFront OAC + Lambda Function URL POSTリクエスト署名エラー

- 症状: POSTリクエスト（サインインAPI等）で`InvalidSignatureException`
- 原因: CloudFront OACはPOSTボディのSHA256ハッシュを自動計算しない。Lambda Function URLのIAM認証はPOSTボディの署名を要求する
- 対処: 検証環境でFunction URL AuthType=NONEに変更。WAF + Geo制限で保護
- 参考: [AWS re:Post](https://repost.aws/questions/QUbHCI9AfyRdaUPCCo_3XKMQ)
- CDKコード上はIAM Auth構成を維持（本番環境ではクライアント側で`x-Amz-Content-Sha256`ヘッダーを付与する対応が必要）

### 4.2 Inference Profile解決エラー

- 症状: KB Retrieve APIで`ValidationException`（地域別inference profileが存在しない）
- 原因: inference-profile-resolverがモデルIDを地域別inference profileに変換するが、KB RetrieveAndGenerateではfoundation model ARNを直接使用する必要がある
- 対処: KB Retrieve APIでinference profile解決をスキップし、foundation model ARNを直接構築するよう修正

### 4.3 GitHub Private Repo — EC2からのgit clone失敗

- 症状: EC2上で`git clone`が認証エラー
- 原因: リポジトリがprivateのため、EC2からHTTPS cloneに認証が必要
- 対処: ローカルからrsyncでファイルを転送

### 4.4 Nova ProモデルでKB RetrieveAndGenerate APIが500エラー

- 症状: フロントエンドからKB検索を実行すると500エラー。Chat APIへのフォールバックが発生し、KB検索結果（citation）が返らない
- 原因: フロントエンドのデフォルトモデル`apac.amazon.nova-pro-v1:0`がBedrock KB `RetrieveAndGenerate` APIでサポートされていない。このAPIはAnthropicモデルのみ対応
- 対処: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` に以下の修正を実施
  1. Inference profileプレフィックス（`apac.`/`us.`/`eu.`）を自動除去
  2. Anthropic以外のモデルは`anthropic.claude-3-haiku-20240307-v1:0`に自動フォールバック
- コミット: `c7c0a3c`

### 4.5 DynamoDB SIDフィールド名の不一致

- 症状: SIDフィルタリングが`DENY_ALL_FALLBACK`になり、全ドキュメントが拒否される
- 原因: DynamoDB user-accessテーブルのSIDフィールド名が`sids`（小文字）だが、コードは`groupSIDs`と`SID`のみ参照していた
- 対処: `getUserSIDs()`関数のフィールドマッピングに`item.sids`を追加（`item.groupSIDs || item.sids || item.SID || []`）
- コミット: `c7c0a3c`

### 4.6 KB IDがフロントエンドに未設定

- 症状: KB Retrieve APIが呼ばれず、常にChat APIにフォールバック
- 原因: `localStorage`の`selectedKnowledgeBaseId`と`NEXT_PUBLIC_BEDROCK_KB_ID`環境変数が両方とも空。フロントエンドの`if (knowledgeBaseId)`条件でKB APIがスキップされていた
- 対処:
  1. `page.tsx`: `if (knowledgeBaseId)`条件を削除し、常にKB Retrieve APIを呼び出すよう変更。`knowledgeBaseId`はクライアント側で利用可能な場合のみ送信
  2. `route.ts`: サーバーサイドで`process.env.BEDROCK_KB_ID`環境変数にフォールバック
- コミット: `c7c0a3c`

---

## 5. デプロイ済みリソース一覧

デプロイ後、CloudFormation出力から各リソースのIDを取得可能。

| リソース | 取得方法 |
|---------|---------|
| CloudFront Distribution | WebAppStack出力 `CloudFrontUrl` |
| Lambda Function | WebAppStack出力 `LambdaFunctionUrl` |
| Cognito User Pool | SecurityStack出力 |
| Knowledge Base | AIStack出力 `KnowledgeBaseId` |
| FSx File System | StorageStack出力 |
| DynamoDB Tables | StorageStack出力 |
| WAF WebACL | WafStack出力 (us-east-1) |

---

## 6. GitHubコミット履歴

| コミット | 内容 |
|---------|------|
| `6df307f` | CDKスタック、KB-onlyフロントエンド、デプロイ基盤 |
| `451ebd2` | WAF、IAM Auth + OAC、SIDフィルタリング、S3 Access Point |
| `8694de0` | SIDベース権限フィルタリング実装（KB Retrieve API） |
| `17d979f` | README表現修正（デモ→テスト/検証） |
| `aca8c81` | KB RetrieveでFoundation Model ARN直接使用、デフォルトモデル変更 |
| `636762d` | README.mdにWAF & Geo制限の設定セクション追加 |
| `c7c0a3c` | KB Retrieve APIモデルフォールバック、SIDフィールドマッピング修正 |

---

## 8. WebAppコンテナ更新手順

フロントエンド（Next.js）のコード修正後、以下の手順でデプロイする。

### 8.1 EC2ビルド環境を使用する場合

EC2インスタンスでDockerイメージをビルドし、ECRにプッシュする方式。ローカルマシンにDocker環境がない場合に有効。

```bash
# 1. EC2インスタンスを起動（Amazon Linux 2023 or Ubuntu、t3.medium以上推奨）
#    Docker、Node.js 20、AWS CLIをインストール

# 2. 修正ファイルをEC2に同期
rsync -avz \
  -e "ssh -i /path/to/key.pem -o StrictHostKeyChecking=no" \
  docker/nextjs/src/ \
  ubuntu@<EC2_IP>:/home/ubuntu/nextjs-build/src/

# 3. EC2でDockerイメージをビルド
ssh -i /path/to/key.pem ubuntu@<EC2_IP> \
  "cd /home/ubuntu/nextjs-build && docker build --no-cache -t permission-aware-rag-webapp:<TAG> -f Dockerfile ."

# 4. ECR認証
ssh -i /path/to/key.pem ubuntu@<EC2_IP> \
  "aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com"

# 5. ECRにプッシュ
ssh -i /path/to/key.pem ubuntu@<EC2_IP> \
  "docker tag permission-aware-rag-webapp:<TAG> <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:<TAG> && docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:<TAG>"
```

### 8.2 Lambda関数のイメージ更新

```bash
# Lambda関数のイメージを更新
aws lambda update-function-code \
  --function-name <FUNCTION_NAME> \
  --image-uri <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:<TAG> \
  --region ap-northeast-1

# 更新完了を待機（約30秒）
aws lambda wait function-updated \
  --function-name <FUNCTION_NAME> \
  --region ap-northeast-1
```

### 8.3 コンテナリフレッシュ（キャッシュされた古いコンテナを強制更新）

```bash
FUNCTION_NAME="<FUNCTION_NAME>"
REGION="ap-northeast-1"

# Step 1: 環境変数を更新してコンテナキャッシュを無効化
# （現在の環境変数を取得し、FORCE_CONTAINER_REFRESHを追加）
aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" --region "$REGION" \
  --query 'Environment.Variables' --output json > /tmp/current-env.json

python3 -c "
import json
with open('/tmp/current-env.json') as f: env = json.load(f)
env['FORCE_CONTAINER_REFRESH'] = '$(date +%s)'
with open('/tmp/env-update.json', 'w') as f: json.dump({'Variables': env}, f)
"

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" --region "$REGION" \
  --environment file:///tmp/env-update.json

sleep 30

# Step 2: Reserved Concurrency = 0（全コンテナ停止）
aws lambda put-function-concurrency \
  --function-name "$FUNCTION_NAME" --region "$REGION" \
  --reserved-concurrent-executions 0

sleep 15

# Step 3: Reserved Concurrency削除（新コンテナ起動許可）
aws lambda delete-function-concurrency \
  --function-name "$FUNCTION_NAME" --region "$REGION"

# Step 4: ウォームアップ（10回以上推奨）
for i in $(seq 1 10); do
  aws lambda invoke \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --payload '{"rawPath": "/health", "requestContext": {"http": {"method": "GET"}}}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/warmup-$i.json > /dev/null 2>&1
  sleep 1
done

# Step 5: CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### 8.4 動作確認

```bash
# Lambda Function URLで直接確認
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nContent-Length: %{size_download}\n" \
  "https://<LAMBDA_FUNCTION_URL>/ja/signin"

# CloudFront経由で確認（キャッシュ無効化後2-3分待機）
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "https://<CLOUDFRONT_DOMAIN>/ja/signin"

# KB Retrieve APIの動作確認
curl -s -X POST "https://<LAMBDA_FUNCTION_URL>/api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"テスト","modelId":"anthropic.claude-3-haiku-20240307-v1:0","userId":"admin@example.com","region":"ap-northeast-1"}'
```

---

## 9. KB Retrieve APIモデル互換性修正（2026-03-24追記）

### 問題

フロントエンドのデフォルトモデル`amazon.nova-pro-v1:0`がBedrock KB `RetrieveAndGenerate` APIで500エラーを返す。Nova系モデルはこのAPIでサポートされていない。

### 修正内容

1. Inference profileプレフィックス除去: `apac.`/`us.`/`eu.`プレフィックスを自動除去
2. モデルフォールバック: Anthropic以外のモデル（Nova, Meta等）は`anthropic.claude-3-haiku-20240307-v1:0`に自動フォールバック
3. DynamoDB SIDフィールドマッピング: `sids`フィールド（小文字）のサポートを追加
4. メタデータネスト対応: Bedrock KBが`metadataAttributes`配下にメタデータを返す場合にも対応

### 修正後の検証結果

| テスト | ユーザー | クエリ | 送信モデル | 実行モデル | 結果 |
|--------|---------|--------|-----------|-----------|------|
| 1 | admin | 会社概要 | Nova Pro | Claude Haiku | ✅ Allowed (1/1) |
| 2 | admin | 財務レポート | Nova Pro | Claude Haiku | ✅ Allowed (1/1), citation: financial-report.md |
| 3 | user | 会社概要 | Nova Pro | Claude Haiku | ✅ Allowed (1/1), citation: company-overview.md |
| 4 | user | 財務レポート | Nova Pro | Claude Haiku | ✅ Denied (0/1), citation除外 |
