# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | [한국어](../ko/transfer-family-networking-prerequisites.md) | [简体中文](../zh-CN/transfer-family-networking-prerequisites.md) | **繁體中文** | [Français](../fr/transfer-family-networking-prerequisites.md) | [Deutsch](../de/transfer-family-networking-prerequisites.md) | [Español](../es/transfer-family-networking-prerequisites.md)

**建立日期**: 2026-05  
**適用範圍**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## 端點類型選擇指南

Transfer Family 伺服器支援兩種端點類型。

| 項目 | PUBLIC | VPC |
|------|--------|-----|
| 存取來源 | 透過網際網路 | VPC 內 / VPN / Direct Connect |
| IP 限制 | 原生不支援(需要 NLB) | 可透過 Security Group 控制 |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| 成本 | 端點免費 | VPC Endpoint 按小時計費 |
| 建議使用案例 | PoC、外部合作夥伴(不需 IP 限制時) | 生產、受監管產業、必須 IP 限制時 |

### CDK 參數

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` 指定時: 發出 CDK Warning(IP 限制需要 VPC 端點)
- `VPC` + `transferFamilyAllowedCidrs` 指定時: 向 Security Group 新增基於 CIDR 的 Ingress Rule

---

## VPC 端點配置

選擇 VPC 端點類型時的需求:

### 必要資源
- VPC(`vpc` prop)
- Private Subnets(`privateSubnets` prop) — 用於放置 Transfer Family VPC Endpoint
- Security Group — 由 CDK 自動建立(`TransferSg`)

### Security Group 規則

| 通訊協定 | 連接埠 | 用途 |
|-----------|--------|------|
| SFTP | TCP 22 | SFTP 連線 |
| FTPS (選用) | TCP 21 | FTPS 控制 |
| FTPS (選用) | TCP 8192-8200 | FTPS 被動資料 |

指定 `transferFamilyAllowedCidrs` 時，上述連接埠僅允許來自指定 CIDR 的存取。
未指定時，允許來自 `0.0.0.0/0` 的存取。

### 合作夥伴存取路徑

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
│ FSx for ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## PUBLIC 端點配置

### 限制事項
- Transfer Family PUBLIC 端點在沒有 NLB 的情況下不原生支援基於 IP 位址的存取限制
- 需要合作夥伴 IP 限制時，請使用 VPC 端點類型

### 合作夥伴存取路徑

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
│ FSx for ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## DNS 需求

### S3 Access Point Alias
- Transfer Family 的 HomeDirectoryMappings 使用 S3 AP **alias**
- Alias 格式: `{ap-name}-{hash}-s3alias` (例: `my-ap-ext-s3alias`)
- DNS 解析由 AWS 內部自動完成(不需自訂 DNS 設定)

### Transfer Family 端點
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: VPC Endpoint 的 Private DNS(透過 Route 53 Resolver)

---

## S3 Access Point 路徑

Transfer Family → FSx for ONTAP S3 Access Point 之間的通訊:
- 透過 AWS 內部網路(不經過網際網路)
- 不需要 VPC Endpoint for S3(Transfer Family 直接存取 S3 AP)
- 基於 IAM 角色的驗證(SFTP 使用者角色)

### 完整資料流程圖

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
│  │ • データは FSx for ONTAP 上に存在（S3 にコピーされない）                 │    │
│  └──────────────────────────────┬───────────────────────────────────┘    │
│                                  │ FSx for ONTAP Data Plane                   │
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

### Lambda → S3 AP 通訊需求

| 需求 | 設定 |
|------|------|
| Lambda VPC 部署 | 與 FSx for ONTAP 相同 VPC 的私有子網 |
| S3 Gateway VPC Endpoint | 關聯至 Lambda 子網的路由表 |
| Lambda Security Group | 輸出全部允許(S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | 允許來自 Lambda SG 的 HTTPS (443) 輸入 |
| IAM | Lambda 角色具有 `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## 檢查清單

### PoC / 示範環境
- [ ] 確認 PUBLIC 端點是否足夠
- [ ] 確認合作夥伴的 SFTP 用戶端能否連線至 `{server-id}.server.transfer.{region}.amazonaws.com`
- [ ] 準備 SSH 金鑰對
- [ ] 確認 Lambda 是否部署在與 FSx for ONTAP 相同的 VPC 中
- [ ] 確認 S3 Gateway VPC Endpoint 是否包含在 Lambda 子網的路由表中

### 生產環境
- [ ] 選擇 VPC 端點類型
- [ ] 確認合作夥伴 IP CIDR 並設定 `transferFamilyAllowedCidrs`
- [ ] 最小化 FSx Security Group 的輸入規則
- [ ] 最小化 Lambda Security Group 的輸出規則
- [ ] 確認 VPN / Direct Connect 路徑
- [ ] 審查 Security Group 規則
- [ ] 確認 DNS 解析(合作夥伴端)
- [ ] 如需 FTPS，確認連接埠開放
