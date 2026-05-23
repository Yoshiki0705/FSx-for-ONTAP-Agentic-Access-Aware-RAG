# Transfer Family Networking Prerequisites

**作成日**: 2026-05  
**対象**: Transfer Family FSx ONTAP Ingestion (`enableTransferFamily=true`)

---

## Endpoint Type 選択ガイド

Transfer Family サーバーは2つのエンドポイントタイプをサポートします。

| 項目 | PUBLIC | VPC |
|------|--------|-----|
| アクセス元 | インターネット経由 | VPC内 / VPN / Direct Connect |
| IP制限 | ネイティブ非対応（NLB必要） | Security Group で制御可 |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| コスト | エンドポイント無料 | VPC Endpoint 時間課金 |
| 推奨ユースケース | PoC、外部パートナー（IP制限不要時） | 本番、規制業界、IP制限必須時 |

### CDK パラメータ

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` 指定時: CDK Warning が発行される（IP制限にはVPCエンドポイントが必要）
- `VPC` + `transferFamilyAllowedCidrs` 指定時: Security Group にCIDRベースのIngress Ruleが追加される

---

## VPC エンドポイント構成

VPCエンドポイントタイプを選択した場合の要件:

### 必須リソース
- VPC（`vpc` prop）
- Private Subnets（`privateSubnets` prop）— Transfer Family VPC Endpoint が配置される
- Security Group — CDKが自動作成（`TransferSg`）

### Security Group ルール

| プロトコル | ポート | 用途 |
|-----------|--------|------|
| SFTP | TCP 22 | SFTP接続 |
| FTPS (オプション) | TCP 21 | FTPS制御 |
| FTPS (オプション) | TCP 8192-8200 | FTPSパッシブデータ |

`transferFamilyAllowedCidrs` が指定された場合、上記ポートは指定CIDRからのみ許可されます。
未指定の場合は `0.0.0.0/0` から許可されます。

### パートナーアクセス経路

```
外部パートナー
    │
    ▼ (インターネット)
┌─────────────────────┐
│ AWS VPN / Direct    │  ← パートナーVPN接続
│ Connect             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ VPC Endpoint        │  ← Transfer Family
│ (Private Subnet)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ FSx ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## PUBLIC エンドポイント構成

### 制限事項
- Transfer Family PUBLIC エンドポイントは、NLBなしではIPアドレスベースのアクセス制限をネイティブサポートしない
- パートナーIP制限が必要な場合は VPC エンドポイントタイプを使用すること

### パートナーアクセス経路

```
外部パートナー
    │
    ▼ (インターネット)
┌─────────────────────┐
│ Transfer Family     │
│ PUBLIC Endpoint     │
│ ({server-id}.server │
│  .transfer.{region} │
│  .amazonaws.com)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ FSx ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## DNS 要件

### S3 Access Point Alias
- Transfer Family の HomeDirectoryMappings は S3 AP **alias** を使用
- Alias 形式: `{ap-name}-{hash}-s3alias` (例: `my-ap-ext-s3alias`)
- DNS解決は AWS 内部で自動的に行われる（カスタムDNS設定不要）

### Transfer Family エンドポイント
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: VPC Endpoint の Private DNS（Route 53 Resolver 経由）

---

## S3 Access Point 経路

Transfer Family → FSx ONTAP S3 Access Point 間の通信:
- AWS内部ネットワーク経由（インターネットを経由しない）
- VPC Endpoint for S3 は不要（Transfer Family が直接 S3 AP にアクセス）
- IAM ロールベースの認証（SFTP ユーザーロール）

### データフロー全体図

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                                         │
│                                                                            │
│  ┌─────────────┐                                                          │
│  │ Partner     │ SFTP (Port 22)                                           │
│  │ (External)  │─────────────────┐                                        │
│  └─────────────┘                 │                                        │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Transfer Family Server (PUBLIC or VPC Endpoint)                    │    │
│  │ • SecurityPolicy-2024-01                                          │    │
│  │ • HomeDirectoryMappings: /{s3-ap-alias}/uploads/{user}            │    │
│  └──────────────────────────────┬───────────────────────────────────┘    │
│                                  │ S3 API (PutObject)                     │
│                                  │ IAM Role: sftp-{user}-role            │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ S3 Access Point (v4testkbsync-...-ext-s3alias)                    │    │
│  │ • S3 互換 API インターフェース                                      │    │
│  │ • データは FSx ONTAP 上に存在（S3 にコピーされない）                 │    │
│  └──────────────────────────────┬───────────────────────────────────┘    │
│                                  │ FSx ONTAP Data Plane                   │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ FSx for ONTAP (VPC: vpc-xxx)                                      │    │
│  │ ┌────────────────────────────────────────────────────────────┐   │    │
│  │ │ SVM: FSxN_OnPre                                             │   │    │
│  │ │ Volume: /s3ap_headobj_test (UNIX security style)            │   │    │
│  │ │ ENI: 10.0.4.209, 10.0.12.245 (SG: sg-xxx)                  │   │    │
│  │ └────────────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Lambda Functions (同一 VPC 内に配置)                               │    │
│  │                                                                    │    │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐      │    │
│  │  │ Ingestion Trigger   │    │ Metadata Generator          │      │    │
│  │  │ • ListObjectsV2     │    │ • PutObject (.metadata.json)│      │    │
│  │  │ • StartIngestionJob │    │ • DynamoDB GetItem           │      │    │
│  │  └──────────┬──────────┘    └─────────────────────────────┘      │    │
│  │             │                                                      │    │
│  │             │ S3 Gateway VPC Endpoint (vpce-xxx)                   │    │
│  │             ▼                                                      │    │
│  │  ┌─────────────────────┐                                          │    │
│  │  │ Bedrock KB          │                                          │    │
│  │  │ StartIngestionJob   │                                          │    │
│  │  └─────────────────────┘                                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Lambda → S3 AP 通信要件

| 要件 | 設定 |
|------|------|
| Lambda VPC 配置 | FSx ONTAP と同じ VPC のプライベートサブネット |
| S3 Gateway VPC Endpoint | Lambda サブネットのルートテーブルに関連付け |
| Lambda Security Group | アウトバウンド全許可（S3 AP + DynamoDB + Bedrock） |
| FSx Security Group | Lambda SG からの HTTPS (443) インバウンド許可 |
| IAM | Lambda ロールに `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## チェックリスト

### PoC / デモ環境
- [ ] PUBLIC エンドポイントで十分か確認
- [ ] パートナーのSFTPクライアントが `{server-id}.server.transfer.{region}.amazonaws.com` に接続可能か確認
- [ ] SSH鍵ペアの準備
- [ ] Lambda が FSx ONTAP と同じ VPC に配置されているか確認
- [ ] S3 Gateway VPC Endpoint が Lambda サブネットのルートテーブルに含まれているか確認

### 本番環境
- [ ] VPC エンドポイントタイプの選択
- [ ] パートナーIP CIDR の確認と `transferFamilyAllowedCidrs` 設定
- [ ] FSx Security Group のインバウンドルール最小化
- [ ] Lambda Security Group のアウトバウンドルール最小化
- [ ] VPN / Direct Connect 経路の確認
- [ ] Security Group ルールのレビュー
- [ ] DNS解決の確認（パートナー側）
- [ ] FTPS が必要な場合のポート開放確認
