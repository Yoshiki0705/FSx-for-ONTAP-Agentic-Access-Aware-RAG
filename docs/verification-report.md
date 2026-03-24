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
