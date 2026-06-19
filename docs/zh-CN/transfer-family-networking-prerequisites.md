# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | [한국어](../ko/transfer-family-networking-prerequisites.md) | **简体中文** | [繁體中文](../zh-TW/transfer-family-networking-prerequisites.md) | [Français](../fr/transfer-family-networking-prerequisites.md) | [Deutsch](../de/transfer-family-networking-prerequisites.md) | [Español](../es/transfer-family-networking-prerequisites.md)

**创建日期**: 2026-05  
**适用范围**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## 端点类型选择指南

Transfer Family 服务器支持两种端点类型。

| 项目 | PUBLIC | VPC |
|------|--------|-----|
| 访问来源 | 通过互联网 | VPC 内 / VPN / Direct Connect |
| IP 限制 | 原生不支持(需要 NLB) | 可通过 Security Group 控制 |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| 成本 | 端点免费 | VPC Endpoint 按小时计费 |
| 推荐使用场景 | PoC、外部合作伙伴(无需 IP 限制时) | 生产、受监管行业、必须 IP 限制时 |

### CDK 参数

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` 指定时: 发出 CDK Warning(IP 限制需要 VPC 端点)
- `VPC` + `transferFamilyAllowedCidrs` 指定时: 向 Security Group 添加基于 CIDR 的 Ingress Rule

---

## VPC 端点配置

选择 VPC 端点类型时的要求:

### 必需资源
- VPC(`vpc` prop)
- Private Subnets(`privateSubnets` prop) — 用于放置 Transfer Family VPC Endpoint
- Security Group — 由 CDK 自动创建(`TransferSg`)

### Security Group 规则

| 协议 | 端口 | 用途 |
|-----------|--------|------|
| SFTP | TCP 22 | SFTP 连接 |
| FTPS (可选) | TCP 21 | FTPS 控制 |
| FTPS (可选) | TCP 8192-8200 | FTPS 被动数据 |

指定 `transferFamilyAllowedCidrs` 时，上述端口仅允许来自指定 CIDR 的访问。
未指定时，允许来自 `0.0.0.0/0` 的访问。

### 合作伙伴访问路径

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

## PUBLIC 端点配置

### 限制事项
- Transfer Family PUBLIC 端点在没有 NLB 的情况下不原生支持基于 IP 地址的访问限制
- 需要合作伙伴 IP 限制时，请使用 VPC 端点类型

### 合作伙伴访问路径

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

## DNS 要求

### S3 Access Point Alias
- Transfer Family 的 HomeDirectoryMappings 使用 S3 AP **alias**
- Alias 格式: `{ap-name}-{hash}-s3alias` (例: `my-ap-ext-s3alias`)
- DNS 解析由 AWS 内部自动完成(无需自定义 DNS 配置)

### Transfer Family 端点
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: VPC Endpoint 的 Private DNS(通过 Route 53 Resolver)

---

## S3 Access Point 路径

Transfer Family → FSx for ONTAP S3 Access Point 之间的通信:
- 通过 AWS 内部网络(不经过互联网)
- 无需 VPC Endpoint for S3(Transfer Family 直接访问 S3 AP)
- 基于 IAM 角色的身份验证(SFTP 用户角色)

### 完整数据流程图

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

### Lambda → S3 AP 通信要求

| 要求 | 配置 |
|------|------|
| Lambda VPC 部署 | 与 FSx for ONTAP 相同 VPC 的私有子网 |
| S3 Gateway VPC Endpoint | 关联到 Lambda 子网的路由表 |
| Lambda Security Group | 出站全部允许(S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | 允许来自 Lambda SG 的 HTTPS (443) 入站 |
| IAM | Lambda 角色具有 `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## 检查清单

### PoC / 演示环境
- [ ] 确认 PUBLIC 端点是否足够
- [ ] 确认合作伙伴的 SFTP 客户端能否连接到 `{server-id}.server.transfer.{region}.amazonaws.com`
- [ ] 准备 SSH 密钥对
- [ ] 确认 Lambda 是否部署在与 FSx for ONTAP 相同的 VPC 中
- [ ] 确认 S3 Gateway VPC Endpoint 是否包含在 Lambda 子网的路由表中

### 生产环境
- [ ] 选择 VPC 端点类型
- [ ] 确认合作伙伴 IP CIDR 并配置 `transferFamilyAllowedCidrs`
- [ ] 最小化 FSx Security Group 的入站规则
- [ ] 最小化 Lambda Security Group 的出站规则
- [ ] 确认 VPN / Direct Connect 路径
- [ ] 审查 Security Group 规则
- [ ] 确认 DNS 解析(合作伙伴侧)
- [ ] 如果需要 FTPS，确认端口开放
