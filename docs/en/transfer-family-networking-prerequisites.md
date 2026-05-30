# Transfer Family Networking Prerequisites

**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | **English**

**Created**: 2026-05  
**Scope**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## Endpoint Type Selection Guide

Transfer Family servers support two endpoint types.

| Item | PUBLIC | VPC |
|------|--------|-----|
| Access Source | Via internet | Within VPC / VPN / Direct Connect |
| IP Restriction | Not natively supported (requires NLB) | Controllable via Security Group |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| Cost | No endpoint charge | VPC Endpoint hourly charge |
| Recommended Use Case | PoC, external partners (when IP restriction not required) | Production, regulated industries, when IP restriction is required |

### CDK Parameters

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` specified: CDK Warning is issued (VPC endpoint required for IP restriction)
- `VPC` + `transferFamilyAllowedCidrs` specified: CIDR-based Ingress Rules are added to the Security Group

---

## VPC Endpoint Configuration

Requirements when selecting the VPC endpoint type:

### Required Resources
- VPC (`vpc` prop)
- Private Subnets (`privateSubnets` prop) — where the Transfer Family VPC Endpoint is placed
- Security Group — automatically created by CDK (`TransferSg`)

### Security Group Rules

| Protocol | Port | Purpose |
|----------|------|---------|
| SFTP | TCP 22 | SFTP connections |
| FTPS (optional) | TCP 21 | FTPS control |
| FTPS (optional) | TCP 8192-8200 | FTPS passive data |

When `transferFamilyAllowedCidrs` is specified, the above ports are allowed only from the specified CIDRs.
If not specified, access is allowed from `0.0.0.0/0`.

### Partner Access Path

```
External Partner
    │
    ▼ (Internet)
┌─────────────────────┐
│ AWS VPN / Direct    │  ← Partner VPN connection
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

## PUBLIC Endpoint Configuration

### Limitations
- Transfer Family PUBLIC endpoints do not natively support IP address-based access restriction without an NLB
- Use the VPC endpoint type when partner IP restriction is required

### Partner Access Path

```
External Partner
    │
    ▼ (Internet)
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

## DNS Requirements

### S3 Access Point Alias
- Transfer Family HomeDirectoryMappings use the S3 AP **alias**
- Alias format: `{ap-name}-{hash}-s3alias` (e.g., `my-ap-ext-s3alias`)
- DNS resolution is handled automatically within AWS (no custom DNS configuration needed)

### Transfer Family Endpoint
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: VPC Endpoint Private DNS (via Route 53 Resolver)

---

## S3 Access Point Path

Communication between Transfer Family and FSx for ONTAP S3 Access Point:
- Routed via AWS internal network (does not traverse the internet)
- VPC Endpoint for S3 is not required (Transfer Family accesses S3 AP directly)
- IAM role-based authentication (SFTP user role)

### Complete Data Flow Diagram

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
│  │ • S3-compatible API interface                                      │    │
│  │ • Data resides on FSx for ONTAP (not copied to S3)                    │    │
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
│  │ Lambda Functions (deployed in the same VPC)                        │    │
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

### Lambda → S3 AP Communication Requirements

| Requirement | Configuration |
|-------------|--------------|
| Lambda VPC placement | Private subnet in the same VPC as FSx for ONTAP |
| S3 Gateway VPC Endpoint | Associated with the Lambda subnet's route table |
| Lambda Security Group | All outbound allowed (S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | Allow HTTPS (443) inbound from Lambda SG |
| IAM | Lambda role with `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## Checklist

### PoC / Demo Environment
- [ ] Confirm PUBLIC endpoint is sufficient
- [ ] Confirm partner's SFTP client can connect to `{server-id}.server.transfer.{region}.amazonaws.com`
- [ ] Prepare SSH key pair
- [ ] Confirm Lambda is deployed in the same VPC as FSx for ONTAP
- [ ] Confirm S3 Gateway VPC Endpoint is included in the Lambda subnet's route table

### Production Environment
- [ ] Select VPC endpoint type
- [ ] Confirm partner IP CIDRs and configure `transferFamilyAllowedCidrs`
- [ ] Minimize FSx Security Group inbound rules
- [ ] Minimize Lambda Security Group outbound rules
- [ ] Confirm VPN / Direct Connect path
- [ ] Review Security Group rules
- [ ] Confirm DNS resolution (partner side)
- [ ] Confirm port opening if FTPS is required
