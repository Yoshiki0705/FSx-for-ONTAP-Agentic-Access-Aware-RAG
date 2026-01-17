# NetApp Main Image Setup Instructions

## 画像ファイルの配置

ダウンロードした `main-image.jpg` を以下の場所に配置してください：

```
frontend/public/images/main-image.jpg
```

## 配置方法

### 方法1: コマンドライン
```bash
# ダウンロードした画像ファイルをコピー
cp /path/to/your/downloaded/main-image.jpg frontend/public/images/main-image.jpg
```

### 方法2: ファイルマネージャー
1. ダウンロードした `main-image.jpg` ファイルを見つける
2. `frontend/public/images/` フォルダに移動またはコピー
3. ファイル名が `main-image.jpg` であることを確認

## 確認方法

画像が正しく配置されたかを確認：

```bash
ls -la frontend/public/images/main-image.jpg
```

## 期待される結果

画像が正しく配置されると：
- サインイン画面の左側にNetAppの建物の写真が表示される
- 青い「DATA INFRASTRUCTURE INTELLIGENT」の看板が見える
- フォールバック（NetAppロゴ）は表示されない

## トラブルシューティング

画像が表示されない場合：
1. ファイルパスが正しいか確認
2. ファイル名が `main-image.jpg` であることを確認
3. ファイルの権限を確認
4. ブラウザのキャッシュをクリア
5. 開発サーバーを再起動

```bash
# 開発サーバー再起動
cd frontend
npm run dev
```