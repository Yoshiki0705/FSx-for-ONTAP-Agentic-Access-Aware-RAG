# Voice Chat WebRTC (Phase 2) — 残課題チェックリスト

**作成日**: 2026-06  
**ステータス**: 実装完了・デプロイ検証未完了

---

## 🔴 ブロッカー（E2E テスト不可）

- [ ] **AgentCore Runtime Voice Agent 未デプロイ**
  - AgentCore Runtime は CloudFormation 未サポート
  - CLI/SDK で手動デプロイが必要
  - 手順: `docs/deployment-troubleshooting.md` Section 19 参照
  - 依存: Pipecat Agent Docker イメージのビルド

- [ ] **Pipecat Agent Docker イメージ未ビルド/未プッシュ**
  - `docker/pipecat-agent/` ディレクトリのイメージをビルドして ECR にプッシュ
  - `docker buildx build --provenance=false --sbom=false --platform linux/amd64 --push` を使用すること
  - AgentCore Runtime エージェント作成の前提条件
  - **本番前に対応必須**: 認証、rate limiting、CORS tightening、sanitized logging、input validation
    - 参考: [Pipecat AgentCore WebRTC KVS Example](https://github.com/pipecat-ai/pipecat-examples/tree/main/deployment/aws-agentcore-webrtc-kvs)

---

## 🟡 検証待ち（AgentCore Runtime デプロイ後に実施）

- [ ] **WebRTC E2E フロー検証**
  - ブラウザ → KVS Signaling → AgentCore Runtime → Pipecat → RAG → 音声応答
  - 前提: AgentCore Runtime エージェントが稼働していること

- [ ] **KVS TURN リレー検証**
  - NAT/ファイアウォール環境での TURN リレー経由接続テスト
  - 企業ネットワーク環境でのテストが必要

- [ ] **Fallback メカニズム検証**
  - WebRTC 接続失敗時に REST ベース（Phase 1）に自動フォールバックすることを確認
  - テスト方法: AgentCore Runtime を停止した状態で音声チャットを開始

- [ ] **音声 → 文字起こし → RAG 検索 → 音声応答フロー検証**
  - エンドツーエンドの音声 RAG パイプライン
  - Permission Filter が音声経由でも正しく適用されることを確認

---

## 🟢 改善項目（機能は動作するが品質向上のため）

- [ ] **CloudWatch Dashboard 音声メトリクス追加**
  - MonitoringConstruct に Voice Chat 関連ウィジェットを追加
  - メトリクス: WebRTC 接続成功率、フォールバック発生率、音声レイテンシ、セッション時間

- [ ] **useVoiceCapability ユニットテスト追加**
  - `canUseVoice` が "prompt" 状態で `true` を返すことを検証するテスト
  - "denied" 状態で `false` を返すことを検証するテスト
  - ブラウザ API 非対応時のフォールバック動作テスト

- [ ] **MessageInput.tsx にコメント追加**
  - VoiceButton は `genai/page.tsx` で直接レンダリングされている旨のコメント
  - MessageInput は現在メインページで使用されていない旨の注記

- [ ] **pre-deploy-setup.sh CodeBuild buildspec 検証**
  - 修正済みの `docker buildx build --provenance=false --sbom=false --push` が CodeBuild 環境で正常動作することを確認
  - `docker buildx create --use` が CodeBuild Standard 7.0 で利用可能であることを確認

---

## 📋 修正済み項目

- [x] **Docker イメージ OCI 形式問題** — `docker buildx build --provenance=false --sbom=false --push` に修正
- [x] **pre-deploy-setup.sh ローカルビルド** — Apple Silicon セクションも buildx + provenance=false に修正
- [x] **pre-deploy-setup.sh CodeBuild buildspec** — `DOCKER_BUILDKIT=0` + `docker build` → `docker buildx build --provenance=false --sbom=false --push` に修正
- [x] **マニフェスト検証ステップ追加** — プッシュ後に `imageManifestMediaType` を確認するステップを追加
- [x] **useVoiceCapability "prompt" 状態バグ** — "prompt" → `null` マッピング、`canUseVoice` 条件修正
- [x] **VoiceButton ページ統合** — `genai/page.tsx` に直接レンダリング
- [x] **CDK イメージタグキャッシュ** — 明示的タグ使用をドキュメント化
- [x] **AgentCore Runtime CFn 制限** — CDK テンプレートから削除、CLI/SDK 手動デプロイ手順を文書化

---

## 🔗 関連ドキュメント

- [デプロイメント トラブルシューティング](deployment-troubleshooting.md) — Section 16-19
- [CHANGELOG](../CHANGELOG.md) — [4.2.0] Voice Chat Phase 2 セクション
- [README 実装概要](../README.md) — Row 18.1

## 🔗 外部リファレンス

- [Pipecat AgentCore WebRTC KVS Example](https://github.com/pipecat-ai/pipecat-examples/tree/main/deployment/aws-agentcore-webrtc-kvs) — KVS managed TURN、production-readiness concerns（認証、rate limiting、CORS、ログ、入力検証）
- [Deploy voice agents with Pipecat and Amazon Bedrock AgentCore Runtime – Part 1](https://aws.amazon.com/blogs/machine-learning/deploy-voice-agents-with-pipecat-and-amazon-bedrock-agentcore-runtime-part-1/) — WebSocket/WebRTC/telephony transport の解説
- [AWS Transfer Family + FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html) — 前提条件、制限事項
