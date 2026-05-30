# パートナー FAQ（よくある質問）

**🌐 Language:** **日本語** | [English](en/partner-faq.md)

**作成日**: 2026-05-24  
**対象**: パートナー企業、SI、コンサルティングファーム向け

---

## 顧客提案時のよくある質問

### Q1. 既存のファイルサーバー（Windows Server）からの移行は可能ですか？

**A**: はい。FSx for ONTAP は Windows Server のファイルサーバーと同じ SMB/CIFS プロトコルをサポートし、NTFS ACL をそのまま維持できます。既存の Active Directory にドメイン参加させることで、ユーザーから見た操作感は変わりません。移行には AWS DataSync または robocopy が使用できます。

**関連ドキュメント**: [FSx for ONTAP サイジング・性能設計](fsxn-sizing-and-performance.md)

---

### Q2. 権限設定は誰が行いますか？追加の設定作業は必要ですか？

**A**: 既存の NTFS ACL / UNIX パーミッションがそのまま RAG 検索に反映されます。追加の権限設定は不要です。ファイルサーバー管理者が通常通りフォルダ権限を設定すれば、RAG 検索結果に自動的に反映されます。

**仕組み**: ファイルの `.metadata.json` に権限情報（SID/UID/GID）が記録され、検索時にユーザーの権限と照合してフィルタリングされます。

---

### Q3. どのくらいのファイル数に対応できますか？

**A**: 以下の規模別構成を推奨しています:

| 規模 | ファイル数 | FSx 構成 | 月額概算 |
|------|-----------|---------|---------|
| 小規模（PoC） | 〜10,000 | 128 MB/s, 1TB SSD | ~$430 |
| 中規模 | 〜100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| 大規模 | 〜1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**関連ドキュメント**: [コスト見積もりワークシート](cost-estimation-worksheet.md)

---

### Q4. 既存の認証基盤（Active Directory / Okta / Auth0）と連携できますか？

**A**: はい。以下の認証方式に対応しています:

| 認証方式 | 対応IdP | SID/権限取得方法 |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger で AD から SID 自動取得 |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC グループクレーム + LDAP クエリ |
| LDAP | OpenLDAP, FreeIPA | UID/GID 直接取得 |
| メール/パスワード | Cognito | DynamoDB に手動登録 |

**関連ドキュメント**: [認証・ユーザー管理ガイド](auth-and-user-management.md)

---

### Q5. PoC にどのくらいの期間とコストがかかりますか？

**A**: 

| フェーズ | 期間 | AWS コスト | 作業内容 |
|---------|------|-----------|---------|
| デプロイ | 1日 | — | CDK デプロイ + テストデータ投入 |
| 基本検証 | 1週間 | ~$100 | デモデータでの動作確認 |
| 顧客データ PoC | 2-4週間 | ~$430/月 | 実データ投入 + 評価 |

**90分ハンズオン**も用意しています → [PoC ワークショップガイド](poc-workshop-guide.md)

---

### Q6. セキュリティ要件が厳しい顧客（金融、医療、公共）に提案できますか？

**A**: はい。以下のセキュリティ機能を備えています:

- 6層防御（Geo制限 → WAF → OAC → IAM Auth → Cognito → SID フィルタリング）
- KMS 暗号化（S3, DynamoDB, FSx）
- VPC エンドポイント（インターネット非経由）
- 監査ログ（CloudTrail + DynamoDB 監査テーブル）
- Fail-Closed 設計（権限不明時はアクセス拒否）
- Bedrock Guardrails（コンテンツフィルタ、PII検出）

**ただし**: 本システムの技術的セキュリティ機能は、法的・コンプライアンス上の要件を自動的に満たすものではありません。規制対象ワークロードでは、顧客固有の法務・コンプライアンス評価が必要です。

**関連ドキュメント**: [本番化チェックリスト](production-readiness-checklist.md)、[脅威モデル](threat-model.md)

---

### Q7. マルチテナント（複数顧客への展開）は可能ですか？

**A**: はい。3つの展開パターンを用意しています:

| パターン | 分離レベル | 適用条件 |
|---------|-----------|---------|
| A: アカウント分離 | 最高 | 厳格なデータ分離要件（金融、医療） |
| B: SVM分離 | 高 | 同一アカウント内で顧客データを分離 |
| C: プレフィックス分離 | 中 | コスト重視、小規模顧客 |

**関連ドキュメント**: [パートナー展開パターン](partner-deployment-patterns.md)

---

### Q8. 外部パートナー（法律事務所、監査法人）からのドキュメント受け取りは？

**A**: AWS Transfer Family による SFTP インジェスションに対応しています。パートナーは SFTP クライアントでファイルをアップロードするだけで、自動的に権限メタデータが付与され、RAG Knowledge Base に取り込まれます。

- パートナーは Web UI や AWS コンソールへのアクセス不要
- `.metadata.json` の上書きは IAM Deny で防止（信頼境界の保護）
- 5分以内に RAG 検索可能

**関連ドキュメント**: [Transfer Family パートナーオンボーディング](transfer-family-partner-onboarding.md)

---

### Q9. 音声での質問は可能ですか？

**A**: はい。2つの音声チャットモードを提供しています:

| モード | 技術 | レイテンシ | 状態 |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | 中 | GA、CDK デプロイ可能 |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | 低 | 実装済み、CLI デプロイ |

音声入力 → テキスト変換 → 権限付き RAG 検索 → 音声出力の全フローで権限フィルタリングが適用されます。

---

### Q10. 他のAWSサービスとの連携は？

**A**: 以下のサービスと統合済みです:

| サービス | 用途 |
|---------|------|
| Amazon Bedrock (KB + Agent) | RAG 検索 + マルチエージェント協調 |
| Amazon Cognito | 認証・ユーザー管理 |
| Amazon CloudFront + WAF | CDN + セキュリティ |
| Amazon S3 Vectors | ベクトルDB（低コスト） |
| Amazon EventBridge | KB 自動同期スケジューリング |
| AWS Transfer Family | SFTP インジェスション |
| Amazon CloudWatch | 監視・アラート・ダッシュボード |
| AWS Step Functions | FSx for ONTAP 運用自動化 |

---

## 技術的なよくある質問

### Q11. S3 Access Point と S3 バケットの違いは？

**A**: S3 Access Point は FSx for ONTAP のボリュームに対する S3 互換のアクセスインターフェースです。S3 バケットとは異なり:

- データは FSx for ONTAP 上に存在し続けます（S3 にコピーされません）
- NFS/SMB と S3 API の両方から同じデータにアクセスできます
- 5GB のアップロードサイズ制限があります
- rename / append 操作は未対応です

---

### Q12. デプロイに失敗した場合のロールバックは？

**A**: CDK は CloudFormation ベースのため、デプロイ失敗時は自動的にロールバックされます。手動でのロールバックが必要な場合:

```bash
# 特定スタックの削除
npx cdk destroy <stack-name>

# 全スタック削除
npx cdk destroy --all --force
```

**関連ドキュメント**: [デプロイトラブルシューティング](deployment-troubleshooting.md)

---

## 提案・ワークショップで使えるリソース

| リソース | 用途 | リンク |
|---------|------|--------|
| 業種別デモデータ | 顧客業種に合わせたデモ | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90分ワークショップ | ハンズオン体験 | [PoC ワークショップガイド](poc-workshop-guide.md) |
| コスト見積もり | 提案書添付用 | [コスト見積もりワークシート](cost-estimation-worksheet.md) |
| PoC 成功基準 | 顧客合意用 | [PoC 成功基準テンプレート](poc-success-criteria-template.md) |
| 本番化チェックリスト | 移行計画用 | [本番化チェックリスト](production-readiness-checklist.md) |
| アーキテクチャ図 | 提案書添付用 | README.md の Architecture セクション |
