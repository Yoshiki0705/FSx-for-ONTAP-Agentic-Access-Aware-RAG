# 音声チャット（Nova Sonic）アーキテクチャ概要

## 通信フロー

```
ブラウザ (Web Audio API)
  ↕ WebSocket (PCM 16kHz mono, 100ms chunks)
Lambda (Next.js API Route: /api/voice/stream)
  ↕ HTTP/2 双方向ストリーム (SigV4 認証)
Amazon Nova Sonic (InvokeModelWithBidirectionalStream)
```

## WebSocket メッセージプロトコル

### クライアント → サーバー
- `sessionConfig`: モード(kb/agent)、言語、セッションID
- `audioInput`: base64 PCM 音声データ + シーケンス番号
- `contentEnd`: 録音終了シグナル

### サーバー → クライアント
- `sessionReady`: セッション確立完了
- `transcription`: 音声→テキスト変換結果
- `textOutput`: RAG 検索回答テキスト（ストリーミング）
- `audioOutput`: 音声合成レスポンス（base64 PCM 24kHz）
- `error`: エラー通知

## エラーハンドリング

1. マイク非対応 → VoiceButton 非表示
2. マイク拒否 → エラーメッセージ + テキストフォールバック
3. WebSocket 接続失敗 → 最大3回再接続 → テキストフォールバック
4. Nova Sonic エラー → テキスト検索パイプラインにフォールバック
5. 無音30秒 → 自動録音停止
6. 8分接続制限 → 7分警告 + graceful 終了

## CDK パラメータ

`enableVoiceChat=true` で有効化。Lambda に `bedrock:InvokeModelWithBidirectionalStream` 権限を付与。
