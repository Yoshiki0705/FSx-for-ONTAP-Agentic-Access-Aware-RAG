# Copilot PowerPoint 作成指示書

## プレゼンテーション概要

- タイトル: Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP
- 対象: AWSユーザー、エンタープライズIT担当者、ストレージ管理者、AI/ML開発者
- 言語: 英語（日本語併記可）
- スライド数: 15〜18枚
- デザイン: テック系、クリーンでモダン。NetAppブルー(#0067C5)とAWSオレンジ(#FF9900)をアクセントカラーに

---

## スライド構成

### Slide 1: タイトル

```
Agentic Access-Aware RAG
with Amazon FSx for NetApp ONTAP

— Where AI Respects File Permissions —

Yoshiki Fujiwara
Cloud Solutions Architect, NetApp
AWS Community Builder
```

### Slide 2: The Problem（課題提起）

```
見出し: When RAG Meets Enterprise File Servers

左側テキスト:
• Enterprise file servers have carefully configured access controls
  — NTFS ACLs, UNIX permissions, group memberships
• When documents are ingested into a vector store for RAG,
  those permissions vanish
• Result: AI answers questions using documents
  the user shouldn't have access to

右側イメージ:
  [図] Admin asks → gets confidential data ✅
       Intern asks → also gets confidential data ❌ ← Problem!

下部:
"How do we make AI respect existing file permissions?"
```

### Slide 3: The Solution（ソリューション概要）

```
見出し: Agentic Access-Aware RAG

3つのカラム:
[1] Permission-Aware
    File server permissions (NTFS ACL / UNIX)
    automatically applied to RAG search results

[2] Agentic AI
    Not just "answer questions" — AI agents
    autonomously plan, decide, and execute
    to optimize business processes

[3] Zero-Touch
    Users sign in once via AD/OIDC/LDAP,
    permissions auto-retrieved.
    No manual registration needed.

下部:
Open Source | AWS CDK One-Command Deploy | 8 Languages
```

### Slide 4: Architecture（アーキテクチャ）

```
見出し: System Architecture

[図] README.mdのASCIIアーキテクチャ図をビジュアル化:

Browser → AWS WAF → CloudFront → Lambda Web Adapter (Next.js)
                                        ↓
                    ┌───────────────────┼──────────────────┐
                    ↓                   ↓                  ↓
              Cognito            Bedrock KB           DynamoDB
              User Pool          + S3 Vectors         user-access
                                     ↓
                              FSx for ONTAP
                              (SVM + Volume)
                              + S3 Access Point

7 CDK Stacks: Waf | Networking | Security | Storage | AI | WebApp | Embedding(opt)
```

### Slide 5: How It Works — Data Ingestion（データ取り込み）

```
見出し: Data Ingestion via S3 Access Points

[図] フロー:
FSx ONTAP Volume (/data)
  ├── document.md
  └── document.md.metadata.json  ← Permission metadata
          ↓ S3 Access Point (S3-compatible API)
Bedrock KB Ingestion Job
  → Chunking → Titan Embed v2 (1024 dim) → Vector Store

ポイント:
• No ETL pipeline — S3 AP bridges file system to Bedrock KB directly
• .metadata.json carries permission info (SIDs) through the pipeline
• Incremental sync — only changed documents are reprocessed
```

### Slide 6: How It Works — Permission Filtering（権限フィルタリング）

```
見出し: Permission-Aware Search Flow

[図] シーケンス:
1. User sends query
2. Get user's SIDs from DynamoDB
3. Bedrock KB Retrieve API (vector search)
4. Each result includes permission metadata
5. Match user SIDs ∩ document SIDs
   → Match: ALLOW  → No match: DENY
6. Generate answer from allowed documents only

[図] 比較:
Admin user:  public ✅ | confidential ✅ | restricted ✅
Regular user: public ✅ | confidential ❌ | restricted ❌
```

### Slide 7: UI — KB Mode（UIスクリーンショット）

```
見出し: KB Mode — Card-Based Task-Oriented UI

[スクリーンショット: docs/screenshots/kb-mode-cards-full.png]

説明:
• 14 purpose-specific workflow cards (8 research + 6 output)
• Category filters, favorites, permission info banner
• Citation display with access level badges
```

### Slide 8: UI — Agent Mode（UIスクリーンショット）

```
見出し: Agent Mode — Autonomous Task Execution

[スクリーンショット: docs/screenshots/agent-mode-card-grid.png]

説明:
• Bedrock Agents for multi-step reasoning
• Agent Directory for catalog-style management
• One-click toggle between KB and Agent modes
• Both modes are permission-aware
```

### Slide 9: Authentication — 5 Modes（認証モード）

```
見出し: 5 Authentication Modes — Configuration-Driven

[テーブル]
Mode | Method | Permission Source
A    | Email/Password      | Manual SID registration
B    | SAML AD Federation  | AD Sync Lambda (auto)
C    | OIDC + LDAP         | LDAP Connector (auto)
D    | OIDC Claims Only    | OIDC token groups
E    | SAML + OIDC Hybrid  | AD Sync + OIDC (auto)

[スクリーンショット: docs/screenshots/signin-page-saml-oidc-hybrid.png]

ポイント:
• Just add config to cdk.context.json — no code changes
• Zero-touch: permissions auto-retrieved on first sign-in
```

### Slide 10: LDAP Integration（LDAP連携の仕組み）

```
見出し: Zero-Touch Provisioning with OIDC + LDAP

[図] フロー:
User clicks "Sign in with Keycloak"
  → OIDC IdP authenticates
  → Cognito Post-Auth Trigger
  → Identity Sync Lambda
  → LDAP Connector queries OpenLDAP/FreeIPA
  → UID/GID/groups saved to DynamoDB
  → RAG search uses these permissions

ポイント:
• LDAP handles permission retrieval, not authentication
• Users don't need to know LDAP exists
• Supports Auth0, Keycloak, Okta, Entra ID
```

### Slide 11: .metadata.json & Ingestion Job（メタデータと同期）

```
見出し: Permission Metadata & Ingestion Job

左側 — .metadata.json:
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public"
  }
}
• Naming: <document>.metadata.json
• Bedrock KB standard specification
• Auto-generation from ONTAP REST API available

右側 — Ingestion Job Quotas:
| Max data/job    | 100 GB |
| Max file size   | 50 MB  |
| Concurrent/KB   | 1      |
| Concurrent/acct | 5      |
| API rate        | 0.1/s  |

Workaround: Split into multiple data sources
```

### Slide 12: Scalability — Future Improvements（将来の改善）

```
見出し: Permission Metadata at Scale

[図] 現在 vs 将来:

Current:
  File Server → .metadata.json (manual) → Bedrock KB

Future (recommended):
  ONTAP REST API (ACL retrieval)
    → DynamoDB document-permissions (master)
    → Auto-generate .metadata.json
    → Bedrock KB Ingestion Job

Benefits:
• No manual .metadata.json management
• Permission changes = DB update → next sync auto-reflects
• DynamoDB as single source of truth for auditing
```

### Slide 13: Security — 6 Layers（セキュリティ）

```
見出し: 6-Layer Security Architecture

[図] 6層:
L1: CloudFront Geo Restriction (configurable per country)
L2: AWS WAF (6 rules: rate limit, OWASP, SQLi, IP reputation)
L3: CloudFront OAC (SigV4 origin authentication)
L4: Lambda Function URL IAM Auth
L5: Cognito JWT / SAML / OIDC Federation
L6: SID / UID+GID Document-Level Filtering
```

### Slide 14: 8-Language Support（多言語対応）

```
見出し: Global-Ready — 8 Languages

[図] 言語一覧（国旗アイコン付き）:
🇯🇵 Japanese | 🇺🇸 English | 🇰🇷 Korean
🇨🇳 Simplified Chinese | 🇹🇼 Traditional Chinese
🇫🇷 French | 🇩🇪 German | 🇪🇸 Spanish

• UI, sign-in page, error messages, documentation — all localized
• Users at global offices use AI search in their native language
• Geo restriction configurable: default ["JP"], change to your countries
```

### Slide 15: Built with Amazon Kiro（開発ツール）

```
見出し: Built with Amazon Kiro (AI IDE)

[図] 開発プロセス:
Specs: Requirements → Design → Tasks (traceability)
Hooks: Automated validation on file saves
Steering: Project-specific rules across sessions

Results:
• 130+ unit tests, 52 property-based tests
• 8-language documentation
• LDAP/ONTAP live environment verification
• Solo developer → enterprise-quality project
```

### Slide 16: Quick Start（クイックスタート）

```
見出し: Try It — 6 Commands

git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG && npm install
npx cdk bootstrap aws://ACCOUNT/ap-northeast-1
npx cdk bootstrap aws://ACCOUNT/us-east-1
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh

Prerequisites: Node.js 22+, Docker, AWS CLI, AdministratorAccess
Deploy time: ~30-40 minutes
```

### Slide 17: Cost（コスト）

```
見出し: Cost-Optimized by Default

[テーブル]
Component          | Cost
S3 Vectors (default) | A few $/month
FSx ONTAP (1TB)    | ~$200/month
Lambda Web Adapter | Pay per request
Bedrock (on-demand)| Pay per token
CloudFront         | Pay per request
Total (demo)       | ~$250/month

vs. OpenSearch Serverless: ~$700/month additional
→ Switch anytime with vectorStoreType parameter
```

### Slide 18: Call to Action（まとめ）

```
見出し: Get Started & Give Feedback

🔗 GitHub:
github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG

Looking for feedback on:
• Permission models — SID/UID-GID/hybrid sufficient?
• Authentication patterns — what IdP combinations?
• Document types — beyond markdown, what needs handling?
• Multi-region — cross-region KB replication useful?

⭐ Star the repo | 🐛 Open issues | 🔀 PRs welcome

Yoshiki Fujiwara
@antiberial (X) | AWS Community Builder
```

---

## スクリーンショット配置一覧

| スライド | ファイル | 説明 |
|---------|--------|------|
| 7 | `docs/screenshots/kb-mode-cards-full.png` | KBモード カードグリッド |
| 8 | `docs/screenshots/agent-mode-card-grid.png` | Agentモード カードグリッド |
| 9 | `docs/screenshots/signin-page-saml-oidc-hybrid.png` | サインイン画面（3方式） |

## デザインノート

- フォント: Segoe UI または Noto Sans（多言語対応）
- 背景: 白ベース、薄いグレーのグラデーション
- アクセントカラー: NetAppブルー(#0067C5)、AWSオレンジ(#FF9900)
- コードブロック: 暗い背景（#1E1E1E）にモノスペースフォント
- アイコン: AWS Architecture Icons を使用
