# デモスタック・統合スタック 統一計画

**作成日**: 2026-03-26  
**目的**: デモスタック（`lib/stacks/demo/`）と統合スタック（`lib/stacks/integrated/`）の差分を解消し、デモスタックに統合スタックの自動化機能を組み込む

---

## 現状の差分サマリー

| 機能 | 統合スタック | デモスタック | 差分 |
|------|-----------|-----------|------|
| 認証 | Windows AD + Cognito | Cognito のみ | AD統合なし |
| SID自動取得 | AD Sync Lambda (SSM→PowerShell→DynamoDB) | 手動スクリプト (`setup-user-access.sh`) | 自動化なし |
| NTFS ACL取得 | FSx Permission Service (SSM→Get-Acl) | 手動 `.metadata.json` | 自動化なし |
| 権限フィルタリング | Permission Filter Lambda (サーバーサイド) | Next.js API Route (アプリ内) | 実装箇所が異なる |
| DynamoDBテーブル | 6テーブル（権限+セッション+設定） | 2テーブル（権限キャッシュ+ユーザーアクセス） | テーブル不足 |
| Embedding | Bedrock Agent + メタデータ自動生成 | EC2サーバー + 手動メタデータ | 自動化なし |
| Lambda関数 | 7関数（権限/ID管理含む） | 0関数（Next.js API内で処理） | Lambda未使用 |
| セキュリティ | AD + Guardrails + KMS | Cognito + WAF | エンタープライズ機能なし |

---

## 統一計画（フェーズ別）

### Phase 1: AD Sync Lambda のデモスタック統合（優先度: 高）

**目的**: `setup-user-access.sh`の手動SID登録を、AD Sync Lambdaによる自動取得に置き換え

**既存実装**: `lambda/agent-core-ad-sync/index.ts`（SSM→PowerShell→Get-ADUser方式）

**デモ環境の制約**:
- AWS Managed Microsoft AD（`demo.local`）を使用（Windows EC2なし）
- SSM方式はWindows AD EC2が必要
- 代替案: LDAP直接クエリ方式（Lambda→VPC→AD LDAPエンドポイント）

**実装オプション**:

| オプション | 方式 | 前提条件 | 複雑度 |
|-----------|------|---------|--------|
| A | 既存AD Sync Lambda（SSM方式） | Windows AD EC2を追加 | 中 |
| B | LDAP直接クエリ Lambda（新規） | VPC Lambda + AD DNS IP | 高 |
| C | 既存AD Sync + フォールバック | Windows EC2あれば自動、なければ手動 | 低 |

**推奨**: オプションC（段階的統合）
1. DemoSecurityStackにAD Sync Lambda関数を追加（オプション）
2. Windows AD EC2がある場合はSSM方式で自動SID取得
3. Windows AD EC2がない場合は`setup-user-access.sh`で手動登録（現状維持）
4. 将来的にLDAP方式に拡張可能

---

### Phase 2: .metadata.json 自動生成 + S3 Access Point統合（優先度: 高）

**目的**: ONTAP REST APIでACLを自動取得し、`.metadata.json`をFSx ONTAPボリュームに格納。S3 Access Points経由でBedrock KBに取り込む

**方式**:
```
FSx ONTAP Volume
  ├── public/company-overview.md
  ├── public/company-overview.md.metadata.json  ← ONTAP REST APIで自動生成
  ├── confidential/financial-report.md
  ├── confidential/financial-report.md.metadata.json  ← ONTAP REST APIで自動生成
  └── ...
      │
      ▼ S3 Access Point
      │
      ▼ Bedrock KB データソース（S3 APエイリアス）
```

**実装内容**:
1. Embeddingサーバーの`processFile()`にONTAP REST API ACL取得を追加
2. 取得したACL（SID情報）から`.metadata.json`を自動生成
3. `.metadata.json`をFSx ONTAPボリュームに書き込み（CIFSマウント経由）
4. Bedrock KBデータソースをS3 Access Pointエイリアスに設定
5. KBデータソース同期で`.metadata.json`付きドキュメントを取り込み

**検証項目**:
- Bedrock KBがS3 Access Point経由で`.metadata.json`を認識するか
- S3 AP経由のKB同期でメタデータがRetrieve APIに含まれるか

---

### Phase 3: Permission Filter Lambda の統合（優先度: 中）

**目的**: Next.js API Route内のSIDフィルタリングを、専用のPermission Filter Lambdaに移行

**対象ファイル**:
- `lambda/permissions/permission-filter-handler.ts` — 既存のPermission Filter Lambda
- `lib/stacks/demo/demo-webapp-stack.ts` — Permission Filter Lambda呼び出しを追加
- `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` — Lambda呼び出しに変更

**実装内容**:
1. Permission Filter LambdaをWebAppStackにデプロイ
2. KB Retrieve API RouteからPermission Filter Lambdaを呼び出し
3. 権限キャッシュテーブルのTTLを5分に設定

**注意**: 現在のNext.js API Route内のSIDフィルタリングは正常に動作しているため、Phase 3は機能的な改善ではなくアーキテクチャの統一が目的

---

### Phase 4: セキュリティ強化（優先度: 低）

**目的**: エンタープライズセキュリティ機能の追加

**実装内容**:
1. Bedrock Guardrails（コンテンツ安全性）
2. KMS暗号化（DynamoDB、S3）
3. CloudTrail監査ログ
4. VPCエンドポイント（SSM、Bedrock）

---

## 実装の優先順位

```
Phase 1: AD Sync Lambda → DynamoDB自動SID登録
  ↓
Phase 2: .metadata.json自動生成 → ONTAP REST API ACL取得
  ↓
Phase 3: Permission Filter Lambda → アーキテクチャ統一
  ↓
Phase 4: セキュリティ強化 → エンタープライズ機能
```

---

## 統合スタックのコンポーネント対応表

| 統合スタックコンポーネント | デモスタック対応 | 統合状況 |
|------------------------|---------------|---------|
| `BedrockAgentCoreIdentityConstruct` | なし | Phase 1で追加 |
| `WindowsAdConstruct` | なし（AWS Managed AD使用） | Phase 1で代替 |
| `lambda/agent-core-ad-sync/` | `demo-data/scripts/setup-user-access.sh` | Phase 1で置換 |
| `lambda/agent-core-identity/` | なし | Phase 1で追加 |
| `lambda/permissions/permission-filter-handler.ts` | `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | Phase 3で移行 |
| `lambda/permissions/fsx-permission-service.ts` | なし | Phase 2で統合 |
| `EmbeddingBatchIntegration` | `DemoEmbeddingStack` | 既存で十分 |
| `BedrockAgentConstruct` | なし | 将来対応 |
| `BedrockGuardrails` | なし | Phase 4 |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [docs/embedding-server-design.md](embedding-server-design.md) | Embeddingサーバー設計 |
| [docs/SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SIDフィルタリング設計 |
| [docs/ui-specification.md](ui-specification.md) | UI仕様 |
| [docs/implementation-overview.md](implementation-overview.md) | 実装概要（7つの観点） |
