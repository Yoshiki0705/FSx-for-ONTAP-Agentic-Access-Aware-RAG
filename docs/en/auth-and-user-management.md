# Authentication & User Management Guide

**🌐 Language:** [日本語](../auth-and-user-management.md) | **English** | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**Created**: 2026-04-02
**Version**: 3.3.0

---

## Overview

This system provides two authentication modes. You can switch between them using CDK context parameters at deploy time.

| Mode | CDK Parameter | User Creation | SID Registration | Recommended Use |
|------|--------------|---------------|-----------------|----------------|
| Email/Password | `enableAdFederation=false` (default) | Admin creates manually | Admin registers manually | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Auto-created on first sign-in | Auto-registered on sign-in | Production / Enterprise |

---

## Mode 1: Email/Password Authentication (Default)

### How It Works

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Users are created directly in the Cognito User Pool and sign in with their email address and password.

### Administrator Tasks

**Step 1: Create Cognito Users**

```bash
# post-deploy-setup.sh runs automatically, or manually:
bash demo-data/scripts/create-demo-users.sh
```

**Step 2: Register DynamoDB SID Data**

```bash
# Register SID data manually
bash demo-data/scripts/setup-user-access.sh
```

This script registers the following in the DynamoDB `user-access` table:

| userId | userSID | groupSIDs | Access Scope |
|--------|---------|-----------|-------------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | All documents |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | Public only |

### Limitations

- Every time a user is added, the admin must manually update both Cognito and DynamoDB
- AD group membership changes are not automatically reflected
- Not suitable for large-scale operations

---

## Mode 2: AD Federation (Recommended: Enterprise)

### How It Works

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

When an AD user signs in via SAML, the following are all performed automatically:

1. **Automatic Cognito User Creation** — A Cognito user is automatically generated from the email attribute in the SAML assertion
2. **Automatic SID Retrieval** — AD Sync Lambda retrieves the user SID + group SIDs from AD
3. **Automatic DynamoDB Registration** — The retrieved SID data is saved to the `user-access` table (24-hour cache)

No manual administrator work is required.

### AD Sync Lambda Behavior

| AD Type | SID Retrieval Method | Required Infrastructure |
|---------|---------------------|----------------------|
| Managed AD | LDAP or PowerShell via SSM | AWS Managed AD + (optional) Windows EC2 |
| Self-managed AD | PowerShell via SSM | Windows EC2 (AD-joined) |

**Cache Behavior:**
- First sign-in: Queries AD to retrieve SIDs, saves to DynamoDB
- Subsequent sign-ins (within 24 hours): Uses DynamoDB cache, skips AD query
- After 24 hours: Re-retrieves from AD on next sign-in

**Error Behavior:**
- Sign-in is not blocked even if AD Sync Lambda fails (error log only)
- If no SID data exists, SID filtering is Fail-Closed (all documents denied)

### Pattern A: AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Setup Steps:**
1. CDK deploy (creates Managed AD + SAML IdP + Cognito Domain)
2. SVM AD join (`post-deploy-setup.sh` runs automatically)
3. Create a SAML application for Cognito in IAM Identity Center (or specify an external IdP with `samlMetadataUrl`)
4. Execute AD authentication from the "AD Sign-in" button in the Cognito Hosted UI

### Pattern B: Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Setup Steps:**
1. Join a Windows EC2 instance to AD and enable SSM Agent
2. Create a SAML application in Entra ID and obtain the metadata URL
3. CDK deploy
4. Execute AD authentication from the "AD Sign-in" button in the CloudFront UI

### CDK Parameter List

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableAdFederation` | boolean | `false` | Enable SAML federation |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed AD administrator password |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | AD-joined Windows EC2 instance ID |
| `samlMetadataUrl` | string | - | SAML IdP metadata URL |
| `adDomainName` | string | - | AD domain name (e.g., demo.local) |
| `adDnsIps` | string | - | AD DNS IPs (comma-separated) |
| `cloudFrontUrl` | string | - | OAuth callback URL |

---

## Integration with SID Filtering

Regardless of the authentication mode, the SID filtering mechanism works the same way.

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs
  v
Bedrock KB Retrieve API -> Results + metadata (allowed_group_sids)
  |
  | userSIDs n documentSIDs
  v
Match -> ALLOW, No match -> DENY
```

**Differences in SID Data Source:**

| Authentication Mode | SID Data Source | `source` Field |
|--------------------|----------------|----------------|
| Email/Password | `setup-user-access.sh` (manual) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatic) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatic) | `AD-Sync-self-managed` |

### DynamoDB user-access Table Schema

```json
{
  "userId": "admin@example.com",
  "userSID": "S-1-5-21-...-500",
  "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
  "displayName": "Admin User",
  "email": "admin@example.com",
  "source": "AD-Sync-managed",
  "retrievedAt": 1705750800000,
  "ttl": 1705837200
}
```

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| All documents denied after sign-in | No SID data in DynamoDB | AD Federation: Check AD Sync Lambda logs. Manual: Run `setup-user-access.sh` |
| "AD Sign-in" button not displayed | `enableAdFederation=false` | Check CDK parameters and redeploy |
| SAML authentication failure | Invalid SAML metadata URL | Managed AD: Check IAM Identity Center settings. Self-managed: Check Entra ID metadata URL |
| AD group changes not reflected | SID cache (24 hours) | Wait 24 hours, or delete the relevant DynamoDB record and sign in again |
| AD Sync Lambda timeout | PowerShell execution via SSM is slow | Increase the `SSM_TIMEOUT` environment variable (default: 60 seconds) |

---

## Related Documents

- [README.md — AD SAML Federation](../../README.en.md#ad-saml-federation-option) — CDK deployment instructions
- [docs/implementation-overview.md — Section 3: IAM Authentication](../en/implementation-overview.md#3-iam-authentication--lambda-function-url-iam-auth--cloudfront-oac) — Infrastructure-layer authentication design
- [docs/SID-Filtering-Architecture.md](../en/SID-Filtering-Architecture.md) — Detailed SID filtering design
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD integration setup
