# PWAアイコン

このディレクトリには、PWA（Progressive Web App）用のアイコンファイルを配置します。

## 必要なアイコンサイズ

以下のサイズのアイコンを用意してください：

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## ショートカットアイコン

以下のショートカット用アイコンも用意してください：

- shortcut-new-chat.png (96x96)
- shortcut-history.png (96x96)

## アイコン生成方法

1. 512x512pxのマスターアイコンを作成
2. オンラインツール（例：https://realfavicongenerator.net/）を使用して各サイズを生成
3. または、ImageMagickを使用してコマンドラインで生成：

```bash
# 512x512のマスターアイコンから各サイズを生成
convert master-icon.png -resize 72x72 icon-72x72.png
convert master-icon.png -resize 96x96 icon-96x96.png
convert master-icon.png -resize 128x128 icon-128x128.png
convert master-icon.png -resize 144x144 icon-144x144.png
convert master-icon.png -resize 152x152 icon-152x152.png
convert master-icon.png -resize 192x192 icon-192x192.png
convert master-icon.png -resize 384x384 icon-384x384.png
convert master-icon.png -resize 512x512 icon-512x512.png
```

## デザインガイドライン

- シンプルで認識しやすいデザイン
- 背景は透明または単色
- ブランドカラー（#3B82F6）を使用
- マスカブルアイコン対応（セーフエリア内にロゴを配置）
