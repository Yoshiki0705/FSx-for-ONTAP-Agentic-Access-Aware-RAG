# テスト結果

このファイルは `demo-data/scripts/verify-deployment.sh` の実行時に自動生成されます。

デプロイ後に以下のコマンドで検証を実行してください:

```bash
bash demo-data/scripts/verify-deployment.sh
```

検証項目:
- スタック状態（6スタック全て CREATE/UPDATE_COMPLETE）
- リソース存在（Lambda URL, KB, Agent）
- アプリケーション応答（サインインページ HTTP 200）
- KBモード Permission-aware（admin: 全ドキュメント許可、user: 公開のみ）
- Agentモード Permission-aware（Action Group SIDフィルタリング）
- S3 Access Point（AVAILABLE）
