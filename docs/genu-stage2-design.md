# 第 2 段の設計: Code Interpreter・動画の分析・議事録・動画の生成
**🌐 Language:** **日本語** | [English](en/genu-stage2-design.md)

---
## 結論
第 2 段の 4 機能は、いずれも東京リージョン（ap-northeast-1）で実装できます。例外は動画の生成で、動画を出力するモデルが東京になく、us-west-2 の 1 モデルだけが使えます。実装の順序は Code Interpreter、動画の分析、議事録、動画の生成です。4 機能とも CDK のコンテキストで切り替え、既定は無効にします。

この文書は実装前の設計で、実装済みの内容ではありません。数値は 2026-11-15 に AWS CLI と boto3 から実測した結果で、アプリケーションをデプロイした状態の測定ではありません。

| 機能 | 使うサービス | 処理リージョン | 実測 |
|------|------------|--------------|------|
| Code Interpreter | Amazon Bedrock AgentCore の組み込み Code Interpreter | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` Python 3.12（aarch64）が動作 |
| 動画の分析 | Amazon Bedrock Converse の `video` ブロック（`jp.amazon.nova-2-lite-v1:0`） | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` 画面上の文字を正しく読めた |
| 議事録 | Amazon Transcribe（`ja-JP`、話者ラベル）と Bedrock | ap-northeast-1 | `verified 2026-11-15 / ap-northeast-1` 日本語 1 文をほぼ逐語で文字起こし |
| 動画の生成 | Amazon Bedrock の `luma.ray-v2:0`（非同期呼び出し） | us-west-2（日本の外） | `verified 2026-11-15 / us-west-2` 5 秒・540p の 1 本が 36 秒で完成 |

## 用語
- **FSx for ONTAP S3 Access Points**: Amazon FSx for NetApp ONTAP のボリュームを、S3 の API で読み書きするための入口です。この文書ではエイリアス（`…-ext-s3alias` で終わる名前）を S3 のバケット名の代わりに渡します。
- **ファイルポータル**: FSx for ONTAP S3 Access Points 経由でファイルを読み書きする、別リポジトリの画面です（[FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)）。
- **RAG アプリ**: このリポジトリの Next.js アプリです。

---
## 機能ごとの設計
### Code Interpreter
- 組み込みの `aws.codeinterpreter.v1` を使います。`verified 2026-11-15 / ap-northeast-1` で、セッションを開始して Python を実行できました。呼び出しは boto3 の `bedrock-agentcore` クライアントの `invoke_code_interpreter(name='executeCode', arguments={language, code})` です。AWS CLI v2 には呼び出しのコマンドがありません。
- サンドボックスへ渡すのは、利用者本人が読める文書の内容だけです。許可の判定は、段階 1 のツールと同じ権限テストを通します。
- 実行は 1 回 60 秒まで、1 リクエストあたり 3 回まで、全体で 50 秒までです。全体の 50 秒は、CloudFront がオリジンの応答を待つ時間（60 秒に設定）から決めました。
- サンドボックスにネットワークはありません（`verified 2026-11-15 / ap-northeast-1`、外部サイトの名前解決が失敗）。pandas と numpy は入っています。文書の本文はサンドボックスのファイルに書き、モデルのプロンプトには入れません。
- 実行の部分は 1 つのモジュール（`code-executor.ts`）にまとめます。Code Interpreter が終了方向にあるという話は、別の Code 系サービス（CodeGuru Security など）の終了を取り違えたもので、AgentCore の Code Interpreter には当てはまりません。AgentCore のリリースノート（2026-11 まで）にも終了の記載はありません。なお、メンテナンスモードで新規受付を止めているのは Bedrock Agents Classic とその中のコード実行機能です（2026-07-30 以降、`documented`）。

### 動画の分析
- Converse の `video` ブロックに、バイト列または S3 の場所（`s3Location`）を渡します。`verified 2026-11-15 / ap-northeast-1` で、どちらも FSx for ONTAP S3 Access Points のエイリアスを含めて読めました。
- 公式の上限は、base64 で全体 25 MB、S3 の URI で 1 GB です（`documented`）。
- ファイルポータル: Lambda が自分でパスの境界を検査してから、`s3://<エイリアス>/<キー>` を Converse に渡します。中間のバケットは不要です。
- RAG アプリ: ブラウザから CloudFront と Function URL を通せる本体は約 6 MB までです。そのため、署名付き URL でステージング用バケットへ直接アップロードします。バケットは暗号化し、ライフサイクルは 1 日で削除します。

### 議事録
- Transcribe の `ja-JP` で話者ラベルを付けて文字起こしし、Bedrock で議事録の形に整えます。`MediaFileUri` に `s3://<エイリアス>/<キー>` を渡せることは、FSx for ONTAP の公式チュートリアルに記載があり（`documented`）、同日に実測でも確認しました。
- Transcribe を使う理由は、Converse の `audio` ブロックで試した Voxtral のうち、mini が文の意味を逆にしたためです。small は意味を保ちました。いずれも 1 文の実測で、一般化はしません。
- ステージング用バケットの扱いは動画の分析と同じです。ファイルポータルには不要です。

### 動画の生成
- 動画を出力するモデルは、ap-northeast-1 のほか us-east-1、eu-west-1、eu-central-1、ap-southeast-1、ap-south-1 でも見つかりませんでした。us-west-2 の `luma.ray-v2:0` だけが使えます（`verified 2026-11-15`）。
- `bedrock-runtime` の `start_async_invoke` で、出力先の S3 バケット（us-west-2）を指定します。動いた入力は `prompt`、`aspect_ratio`、`resolution`、`duration`（`'5s'`）、`loop` です。出力は 960×544 の h264 で 311 KB でした。
- 機能は既定で無効です。有効にした画面と README に、「動画は日本の外（us-west-2）で処理されます」と表示します。この点はユーザーが承認済みです。
- モデルの利用可否の API は契約を `NOT_AVAILABLE` と返しましたが、呼び出しは成功しました。可否の判定にはこの API を使いません。呼び出しの結果で判定します。

---
## FSx for ONTAP S3 Access Points のエイリアスを受け付けるサービス
`verified 2026-11-15 / ap-northeast-1`（Internet オリジン、UNIX の root ユーザー、アクセスポイントの ARN だけを許可したロールで確認）。

| サービス | 結果 |
|---------|------|
| Transcribe（`MediaFileUri`） | 受け付ける |
| Bedrock Converse（動画の `s3Location`） | 受け付ける |
| Textract（同期 `DetectDocumentText`、非同期 `StartDocumentTextDetection`、東京のエンドポイント） | 受け付ける |
| Comprehend（非同期ジョブ） | 受け付ける |
| Rekognition（`DetectText`、`DetectLabels`、`StartLabelDetection`） | 受け付けない。同じ呼び出しは通常のバケットでは成功 |
| Translate（`StartTextTranslationJob`） | 受け付けない。同じ呼び出しは通常のバケットでは成功 |

Rekognition と Translate は、それぞれ AWS サポートへ機能改善の要望を出しました。第 2 段はこの 2 つを使いません。

Textract は、バケットと別のリージョンから呼ぶと、エイリアスでも通常のバケットでも `InvalidS3ObjectException` になりました（`verified 2026-11-15`、us-east-1 から東京のバケットを指定）。2026-08 に「Textract は失敗する」と記録された原因は、この別リージョンからの呼び出しだった可能性がありますが、当時の呼び出しリージョンの記録がないため `hypothesis` です。

---
## よくある質問
**Q. 動画の生成だけ日本の外で処理されるのはなぜですか。**
A. 東京と、調べた他の 5 リージョン（us-east-1、eu-west-1、eu-central-1、ap-southeast-1、ap-south-1）で、動画を出力するモデルが見つからなかったためです。us-west-2 の `luma.ray-v2:0` だけが使えました。

**Q. Code Interpreter は将来使えなくなりますか。**
A. 終了の記載は見つかっていません（AgentCore のリリースノート、2026-11 まで）。取り違えの原因は別の Code 系サービスの終了でした。実行を 1 つのモジュールに分けているのは、将来差し替える場合に備えるためです。

**Q. 議事録の精度は十分ですか。**
A. 日本語 1 文の実測だけで、会議の録音での精度は測っていません。本番に近い録音での測定が必要です（`hypothesis`）。

## 次の手順
1. Code Interpreter を両アプリに追加する。RAG アプリは `/genai/tools` の「コードの実行」として実装済み（確認結果は [評価](evaluation.md) 3.8）。ファイルポータルは `functions/file-tools` に追加する。
2. 動画の分析と議事録は RAG アプリに実装済み（`enableMediaTools`、確認結果は [評価](evaluation.md) 3.9）。動画の生成も RAG アプリに実装済み（`enableVideoGeneration`、確認結果は [評価](evaluation.md) 3.10）。ファイルポータル側は、コードの実行が PR で確認待ち、残りは未実装。

## 関連ドキュメント
- [実装概要](implementation-overview.md)
- [証跡の区分ポリシー](evidence-policy.md)
- [評価](evaluation.md)
