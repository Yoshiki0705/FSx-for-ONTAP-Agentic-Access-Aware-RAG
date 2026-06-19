# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | **한국어** | [简体中文](../zh-CN/transfer-family-networking-prerequisites.md) | [繁體中文](../zh-TW/transfer-family-networking-prerequisites.md) | [Français](../fr/transfer-family-networking-prerequisites.md) | [Deutsch](../de/transfer-family-networking-prerequisites.md) | [Español](../es/transfer-family-networking-prerequisites.md)

**작성일**: 2026-05  
**대상**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## 엔드포인트 유형 선택 가이드

Transfer Family 서버는 두 가지 엔드포인트 유형을 지원합니다.

| 항목 | PUBLIC | VPC |
|------|--------|-----|
| 액세스 출처 | 인터넷 경유 | VPC 내 / VPN / Direct Connect |
| IP 제한 | 네이티브 미지원(NLB 필요) | Security Group으로 제어 가능 |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| 비용 | 엔드포인트 무료 | VPC Endpoint 시간당 과금 |
| 권장 사용 사례 | PoC, 외부 파트너(IP 제한 불필요 시) | 프로덕션, 규제 산업, IP 제한 필수 시 |

### CDK 파라미터

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` 지정 시: CDK Warning이 발행됩니다(IP 제한에는 VPC 엔드포인트가 필요)
- `VPC` + `transferFamilyAllowedCidrs` 지정 시: Security Group에 CIDR 기반 Ingress Rule이 추가됩니다

---

## VPC 엔드포인트 구성

VPC 엔드포인트 유형을 선택한 경우의 요건:

### 필수 리소스
- VPC(`vpc` prop)
- Private Subnets(`privateSubnets` prop) — Transfer Family VPC Endpoint이 배치됩니다
- Security Group — CDK가 자동 생성(`TransferSg`)

### Security Group 규칙

| 프로토콜 | 포트 | 용도 |
|-----------|--------|------|
| SFTP | TCP 22 | SFTP 연결 |
| FTPS (선택) | TCP 21 | FTPS 제어 |
| FTPS (선택) | TCP 8192-8200 | FTPS 패시브 데이터 |

`transferFamilyAllowedCidrs`가 지정된 경우, 위 포트는 지정된 CIDR에서만 허용됩니다.
지정하지 않은 경우 `0.0.0.0/0`에서 허용됩니다.

### 파트너 액세스 경로

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

## PUBLIC 엔드포인트 구성

### 제한 사항
- Transfer Family PUBLIC 엔드포인트는 NLB 없이는 IP 주소 기반 액세스 제한을 네이티브로 지원하지 않습니다
- 파트너 IP 제한이 필요한 경우 VPC 엔드포인트 유형을 사용하십시오

### 파트너 액세스 경로

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

## DNS 요건

### S3 Access Point Alias
- Transfer Family의 HomeDirectoryMappings는 S3 AP **alias**를 사용
- Alias 형식: `{ap-name}-{hash}-s3alias` (예: `my-ap-ext-s3alias`)
- DNS 확인은 AWS 내부에서 자동으로 수행됩니다(사용자 지정 DNS 설정 불필요)

### Transfer Family 엔드포인트
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: VPC Endpoint의 Private DNS(Route 53 Resolver 경유)

---

## S3 Access Point 경로

Transfer Family → FSx for ONTAP S3 Access Point 간 통신:
- AWS 내부 네트워크 경유(인터넷을 경유하지 않음)
- VPC Endpoint for S3는 불필요(Transfer Family가 직접 S3 AP에 액세스)
- IAM 역할 기반 인증(SFTP 사용자 역할)

### 전체 데이터 플로우 다이어그램

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

### Lambda → S3 AP 통신 요건

| 요건 | 설정 |
|------|------|
| Lambda VPC 배치 | FSx for ONTAP과 동일한 VPC의 프라이빗 서브넷 |
| S3 Gateway VPC Endpoint | Lambda 서브넷의 라우팅 테이블에 연결 |
| Lambda Security Group | 아웃바운드 전체 허용(S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | Lambda SG로부터의 HTTPS (443) 인바운드 허용 |
| IAM | Lambda 역할에 `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## 체크리스트

### PoC / 데모 환경
- [ ] PUBLIC 엔드포인트로 충분한지 확인
- [ ] 파트너의 SFTP 클라이언트가 `{server-id}.server.transfer.{region}.amazonaws.com`에 연결 가능한지 확인
- [ ] SSH 키 페어 준비
- [ ] Lambda가 FSx for ONTAP과 동일한 VPC에 배치되어 있는지 확인
- [ ] S3 Gateway VPC Endpoint이 Lambda 서브넷의 라우팅 테이블에 포함되어 있는지 확인

### 프로덕션 환경
- [ ] VPC 엔드포인트 유형 선택
- [ ] 파트너 IP CIDR 확인 및 `transferFamilyAllowedCidrs` 설정
- [ ] FSx Security Group의 인바운드 규칙 최소화
- [ ] Lambda Security Group의 아웃바운드 규칙 최소화
- [ ] VPN / Direct Connect 경로 확인
- [ ] Security Group 규칙 검토
- [ ] DNS 확인(파트너 측)
- [ ] FTPS가 필요한 경우 포트 개방 확인
