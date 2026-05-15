# Audit Event Candidates

**作成日**: 2026-05  
**ステータス**: 設計候補（未実装）  
**目的**: Permission-aware RAG システムの監査証跡設計

---

## 概要

規制業界やエンタープライズ環境では、以下の監査要件が求められる:
1. **誰が** どのドキュメントをアップロードしたか
2. **どの権限メタデータ** が生成されたか
3. **いつ** Knowledge Base に取り込まれたか
4. **なぜ** 特定のドキュメントが検索結果から除外されたか
5. **音声セッション** のトランスクリプト保持ポリシー

---

## 監査イベント一覧

### Document Ingestion Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `UploadReceived` | Transfer Family CloudWatch Logs | パートナーがSFTP経由でファイルをアップロード | `userName`, `fileKey`, `fileSize`, `timestamp` |
| `MetadataGenerated` | Metadata Generator Lambda | 権限メタデータ `.metadata.json` が生成された | `fileKey`, `metadataKey`, `uploadedBy`, `allowed_sids`, `allowed_uids`, `allowed_gids` |
| `MetadataGenerationFailed` | Metadata Generator Lambda | メタデータ生成に失敗 | `fileKey`, `uploadedBy`, `error`, `snsNotified` |
| `MetadataValidationFailed` | (将来実装) | メタデータが不正または改ざんされている | `fileKey`, `metadataKey`, `validationError` |
| `KbIngestionStarted` | Ingestion Trigger Lambda | Bedrock KB StartIngestionJob が開始された | `ingestionJobId`, `knowledgeBaseId`, `dataSourceId`, `detectedFiles`, `changedFiles` |
| `KbIngestionCompleted` | (将来: ジョブ完了監視) | Bedrock KB インジェスションジョブが完了 | `ingestionJobId`, `status` (SUCCEEDED/FAILED), `duration` |
| `InventoryUpdated` | KB Auto-Sync Lambda | DynamoDB インベントリが更新された | `jobId`, `fileCount`, `status` (pending/committed) |

### RAG Retrieval Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `DocumentRetrieved` | Next.js API Route (KB Retrieve) | ドキュメントがRAG検索結果に含まれた | `userId`, `queryHash`, `documentKey`, `relevanceScore` |
| `DocumentSuppressedByPermission` | Permission Filter | 権限不足によりドキュメントが除外された | `userId`, `documentKey`, `userSids`, `requiredSids`, `reason` |
| `PermissionCheckFailed` | Permission Filter | 権限チェック自体が失敗（fail-closed: ドキュメント除外） | `userId`, `documentKey`, `error` |
| `RetrievalDecision` | (将来実装) | 検索結果の最終判断ログ | `userId`, `queryHash`, `totalRetrieved`, `totalSuppressed`, `totalReturned` |

### Voice Session Pipeline

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `VoiceSessionStarted` | Voice API Route | 音声セッションが開始された | `userId`, `sessionId`, `connectionMode` (webrtc/rest), `timestamp` |
| `VoiceSessionEnded` | Voice API Route | 音声セッションが終了した | `userId`, `sessionId`, `duration`, `fallbackOccurred` |
| `VoiceTranscriptGenerated` | (将来実装) | 音声がテキストに変換された | `sessionId`, `transcriptHash`, `retentionPolicy` |

### Capacity Guardrails

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `GuardrailCheckPassed` | Guardrails Module | ガードレールチェックを通過 | `resourceId`, `actionName`, `mode`, `dailyCount`, `dailyCap` |
| `GuardrailCheckRejected` | Guardrails Module | ガードレールにより操作が拒否された | `resourceId`, `actionName`, `mode`, `reason`, `dailyCount`, `dailyCap` |
| `GuardrailBreakGlass` | (将来実装) | Break-glass モードで全ガードレールをバイパス | `resourceId`, `actionName`, `operator`, `justification` |

### Smart Routing

| Event | Source | Description | Key Fields |
|-------|--------|-------------|------------|
| `RoutingDecision` | Smart Router (EMF) | モデルルーティング判断 | `queryHash`, `classification`, `selectedModel`, `confidence`, `isAutoRouted` |
| `RoutingFallback` | Smart Router | モデル不可時のフォールバック | `originalModel`, `fallbackModel`, `reason` |
| `ManualModelSelection` | Smart Router | ユーザーが手動でモデルを選択 | `userId`, `selectedModel`, `isPreviewModel` |

---

## 実装方針（将来）

### Phase 1: 構造化ログベース
- 既存の CloudWatch Logs 構造化ログを監査イベントとして活用
- Lambda 関数の JSON ログに上記フィールドを含める
- CloudWatch Logs Insights でクエリ可能

### Phase 2: 専用監査テーブル
- DynamoDB 監査テーブル（TTL付き）
- EventBridge による監査イベント発行
- S3 への長期保存（Glacier移行）

### Phase 3: 統合監査ダッシュボード
- CloudWatch Dashboard に監査ウィジェット追加
- 異常検知アラーム（大量 Suppression、Break-glass 使用等）
- コンプライアンスレポート自動生成

---

## データ保持ポリシー（推奨）

| データ種別 | 保持期間 | 保存先 | 備考 |
|-----------|---------|--------|------|
| Upload ログ | 1年 | CloudWatch Logs | Transfer Family 構造化ログ |
| Metadata 生成ログ | 1年 | CloudWatch Logs | Lambda ログ |
| KB Ingestion ログ | 90日 | CloudWatch Logs | Lambda ログ |
| Retrieval Decision ログ | 90日 | CloudWatch Logs / DynamoDB | 高頻度 |
| Voice Transcript | 保存しない（デフォルト） | — | 規制要件に応じて変更 |
| Voice Audio | 保存しない（デフォルト） | — | 規制要件に応じて変更 |
| Guardrail 判断ログ | 30日 | CloudWatch Logs + DynamoDB TTL | |
| Routing Decision | 30日 | CloudWatch Logs (EMF) | メトリクスとして集約 |

---

## セキュリティ考慮事項

### Permission Metadata は Security-Critical Control Data

```
Permission metadata should be treated as security-critical control data,
not application metadata. Changes to permission mappings, metadata generation
logic, or retrieval filtering rules should require the same change management
process as IAM policy changes.
```

### Fail-Closed の責任境界

```
Fail-closed enforcement happens in the retrieval filtering layer:
documents without valid, trusted permission metadata are excluded
before the model receives context.

Responsibility chain:
1. Metadata Generator Lambda → generates .metadata.json
2. Bedrock KB Ingestion → indexes document + metadata
3. KB Retrieve API → returns documents with metadata
4. Permission Filter (Next.js) → excludes unauthorized documents
5. LLM → receives only authorized context
```

---

## 関連ドキュメント

- [Transfer Family Networking Prerequisites](transfer-family-networking-prerequisites.md)
- [Transfer Family E2E Verification](transfer-family-e2e-verification.md)
- [Voice Chat WebRTC Remaining Issues](voice-chat-webrtc-remaining-issues.md)
- [Deployment Troubleshooting](deployment-troubleshooting.md)
