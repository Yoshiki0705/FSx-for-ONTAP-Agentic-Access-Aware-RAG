# マイグレーションガイド: マルチモーダル RAG 検索

`titan-text-v2`（テキスト専用）から `nova-multimodal`（マルチモーダル）への移行手順を説明します。

## 前提条件

- 埋め込みモデルは Knowledge Base レベルのデプロイ時構成であり、ランタイムで切り替え不可
- モデル変更には KB の再作成と全データの完全な再インジェストが必要
- `nova-multimodal` は us-east-1, us-west-2 のみ対応

## 移行前チェックリスト

- [ ] 現在のデプロイリージョンが `nova-multimodal` 対応か確認（us-east-1 / us-west-2）
- [ ] 現在の KB のデータ量を確認（再インジェスト所要時間の見積もり用）
- [ ] マルチモーダルコンテンツ（画像・動画・音声）が S3 データソースに存在するか確認
- [ ] ダウンタイム許容範囲を確認

## 再インジェスト所要時間の目安

| データ量 | テキストのみ | マルチモーダル含む |
|---------|------------|-----------------|
| ~100 ドキュメント | 5-10 分 | 15-30 分 |
| ~1,000 ドキュメント | 30-60 分 | 1-3 時間 |
| ~10,000 ドキュメント | 3-6 時間 | 6-12 時間 |

※ マルチモーダルファイル（動画・音声）は BDA Parser による処理が追加されるため、テキストのみより時間がかかります。

---

## 方法 1: Dual KB による段階的移行（推奨）

既存のテキスト検索を中断せずに、マルチモーダル検索を並行テストできます。

### Step 1: Dual KB モードでデプロイ

```json
// cdk.context.json
{
  "embeddingModel": "nova-multimodal",
  "multimodalKbMode": "dual"
}
```

```bash
npx cdk deploy --all --require-approval never
```

これにより以下が作成されます:
- テキスト専用 KB（titan-text-v2）— 既存と同一
- マルチモーダル KB（nova-multimodal）— 新規

### Step 2: データインジェスト

両方の KB が同一の S3 データソースを共有します。KB インジェストを実行:

```bash
bash demo-data/scripts/sync-kb-datasource.sh
```

### Step 3: 動作確認

- UI のトグルスイッチでテキスト専用 / マルチモーダル検索を切り替えて比較
- マルチモーダル検索結果にメディアタイプアイコン（📄🖼️🎥🔊）が表示されることを確認
- 権限フィルタリングが両方の KB で正しく動作することを確認

### Step 4: 単一 KB への切り替え

マルチモーダル検索の動作確認後、単一 KB に切り替え:

```json
// cdk.context.json
{
  "embeddingModel": "nova-multimodal",
  "multimodalKbMode": "replace"
}
```

```bash
npx cdk deploy --all --require-approval never
```

### Step 5: 旧 KB のクリーンアップ

`multimodalKbMode` を `dual` → `replace` に変更した場合、不要になったテキスト専用 KB は自動削除されません。CfnOutput に「不要な KB の手動削除が必要です」通知が出力されます。

AWS コンソールまたは CLI で旧 KB を手動削除:

```bash
aws bedrock-agent delete-knowledge-base --knowledge-base-id <旧KB_ID>
```

---

## 方法 2: 直接切り替え

ダウンタイムを許容できる場合の簡易手順です。

### Step 1: cdk.context.json を更新

```json
{
  "embeddingModel": "nova-multimodal"
}
```

### Step 2: デプロイ

```bash
npx cdk deploy --all --require-approval never
```

⚠️ 既存の KB が再作成され、全データの再インジェストが必要です。再インジェスト完了まで検索機能は利用できません。

### Step 3: データインジェスト

```bash
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## ロールバック手順

マルチモーダルからテキスト専用に戻す場合:

```json
// cdk.context.json
{
  "embeddingModel": "titan-text-v2"
}
```

```bash
npx cdk deploy --all --require-approval never
```

⚠️ KB が再作成されるため、再度データの再インジェストが必要です。

---

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| Nova Multimodal がリージョン非対応 | us-east-1 または us-west-2 にデプロイ |
| インジェストが遅い | マルチモーダルファイル（動画・音声）は BDA Parser 処理のため時間がかかる。テキストファイルのみ先にインジェストすることを推奨 |
| Dual KB モードで片方が失敗 | CloudWatch ログで各 KB のインジェスト状況を確認。正常な KB で検索は継続される |
| マルチモーダル UI が表示されない | Lambda 環境変数 `MULTIMODAL_ENABLED=true` が設定されているか確認 |
