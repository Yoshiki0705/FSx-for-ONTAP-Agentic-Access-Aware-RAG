# Authentication & User Management Guide

**🌐 Language:** [日本語](../auth-and-user-management.md) | **English** | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**Created**: 2026-04-02
**Version**: 3.4.0

---

## Overview

This system provides two authentication modes. You can switch between them using CDK context parameters at deploy time.

| Mode | CDK Parameter | User Creation | SID Registration | Recommended Use |
|------|--------------|---------------|-----------------|----------------|
| Email/Password | `enableAdFederation=false` (default) | Admin creates manually | Admin registers manually | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Auto-created on first sign-in | Auto-registered on sign-in | Production / Enterprise |
| OIDC/LDAP Federation | `oidcProviderConfig` specified | Auto-created on first sign-in | Auto-registered on sign-in | Multi-IdP / LDAP environments |

### Zero-Touch User Provisioning

AD Federation and OIDC/LDAP Federation modes achieve "Zero-Touch User Provisioning." This mechanism automatically maps existing file server (FSx for NetApp ONTAP) user permissions to RAG system UI users.

- Administrators do not need to manually create users in the RAG system
- Users do not need to self-register
- When a user managed by an IdP (AD/Keycloak/Okta/Entra ID, etc.) signs in for the first time, Cognito user creation → permission retrieval → DynamoDB registration all happen automatically
- File server permission changes are automatically reflected on the next sign-in after the cache TTL (24 hours) expires

```
IdP (AD/OIDC) ──Auth──> Cognito User Pool
                              │
                        Post-Auth Trigger
                              │
                              v
                    Identity Sync Lambda
                     ┌────────┴────────┐
                     │                 │
              SSM PowerShell      Direct LDAP Query
              (Windows AD)     (OpenLDAP/FreeIPA)
                     │                 │
                     └────────┬────────┘
                              │
                     SID / UID+GID / Groups
                              │
                              v
                    DynamoDB user-access Table
                              │
                              v
                    Permission Filtering at RAG Search
```

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

## Mode 3: OIDC/LDAP Federation (Multi-IdP / LDAP Environments)

### How It Works

```
OIDC User -> CloudFront UI -> "Sign in with OIDC" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

When an OIDC user signs in, the following are all performed automatically:

1. **Automatic Cognito User Creation** — A Cognito user is automatically generated from the email attribute in the OIDC assertion
2. **Automatic Permission Retrieval** — Identity Sync Lambda retrieves SID/UID/GID/group information from the LDAP server or OIDC claims
3. **Automatic DynamoDB Registration** — The retrieved permission data is saved to the `user-access` table (24-hour cache)

### Configuration-Driven Auto-Activation

Each authentication method is automatically enabled when its configuration is provided. Near-zero additional AWS resource cost.

| Feature | Activation Condition | Additional Cost |
|---------|---------------------|----------------|
| OIDC Federation | `oidcProviderConfig` specified | None (Cognito IdP registration is free) |
| LDAP Permission Retrieval | `ldapConfig` specified | None (Lambda pay-per-use only) |
| OIDC Claims Permission | `oidcProviderConfig` specified + no `ldapConfig` | None |
| UID/GID Permission Filtering | `permissionMappingStrategy` is `uid-gid` or `hybrid` | None |
| ONTAP Name-Mapping | `ontapNameMappingEnabled=true` | None |

> **CDK Auto-Configuration**: When you deploy CDK with `oidcProviderConfig` specified, the following is automatically configured:
> - OIDC IdP is registered in the Cognito User Pool
> - Cognito Domain is created (if not already created by `enableAdFederation=true`)
> - OIDC IdP is added as a supported provider to the User Pool Client
> - Identity Sync Lambda is created and registered as a Post-Authentication Trigger
> - OAuth environment variables (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`) are automatically set on the WebAppStack Lambda
>
> When both `enableAdFederation=true` and `oidcProviderConfig` are specified, both SAML and OIDC are supported, and both sign-in buttons are displayed.

### Pattern C: OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak)

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password",
    "userSearchFilter": "(mail={email})",
    "groupSearchFilter": "(member={dn})"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

### Pattern D: OIDC Claims Only (No LDAP)

```json
{
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com",
    "groupClaimName": "groups"
  }
}
```

> **Important note for Auth0 users**: Auth0's OIDC-conformant applications require custom claims in ID tokens to use a namespace (URL prefix). Non-namespaced `groups` claims are silently dropped from ID tokens. Configure your Auth0 Post Login Action with namespaced claims:
>
> ```javascript
> // Auth0 Post Login Action
> exports.onExecutePostLogin = async (event, api) => {
>   const groups = ['developers', 'rag-users']; // User's groups
>   api.idToken.setCustomClaim('https://rag-system/groups', groups);
>   api.accessToken.setCustomClaim('https://rag-system/groups', groups);
> };
> ```
>
> The CDK `groupClaimName` can remain as `groups`. CDK automatically configures the attribute mapping as `https://rag-system/groups` → `custom:oidc_groups`.

### Pattern E: SAML + OIDC Hybrid

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com"
  },
  "permissionMappingStrategy": "hybrid",
  "cloudFrontUrl": "https://dxxxxxxxx.cloudfront.net"
}
```

### CDK Parameter List (OIDC/LDAP)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | IdP display name (shown on sign-in button) |
| `oidcProviderConfig.clientId` | string | **Required** | OIDC client ID |
| `oidcProviderConfig.clientSecret` | string | **Required** | OIDC client secret (Secrets Manager ARN or plaintext. When ARN is specified, CDK auto-resolves the value at deploy time) |
| `oidcProviderConfig.issuerUrl` | string | **Required** | OIDC issuer URL |
| `oidcProviderConfig.groupClaimName` | string | `groups` | Group information claim name |
| `ldapConfig.ldapUrl` | string | - | LDAP/LDAPS URL (e.g., `ldaps://ldap.example.com:636`) |
| `ldapConfig.baseDn` | string | - | Search base DN (e.g., `dc=example,dc=com`) |
| `ldapConfig.bindDn` | string | - | Bind DN (e.g., `cn=readonly,dc=example,dc=com`) |
| `ldapConfig.bindPasswordSecretArn` | string | - | Bind password Secrets Manager ARN |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | User search filter |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | Group search filter |
| `permissionMappingStrategy` | string | `sid-only` | Permission mapping strategy: `sid-only`, `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | ONTAP name-mapping integration |

> **CDK Deployment Considerations**:
> - When `clientSecret` is specified as an `arn:aws:secretsmanager:...` ARN, CDK automatically retrieves the value from Secrets Manager at deploy time and sets it on the Cognito IdP. This avoids storing plaintext secrets in `cdk.context.json` and is recommended for production.
> - Cognito User Pool custom attributes (e.g., `custom:oidc_groups`) cannot be modified or deleted once created (CloudFormation limitation). The CDK code excludes `oidc_groups` from the User Pool definition and relies on Cognito auto-creating it when the OIDC IdP is registered.
> - Immediately after a CDK deployment updates the OIDC IdP, Cognito may temporarily fail OIDC sign-in while re-resolving endpoints (typically resolves within 1-2 minutes).
> - The Identity Sync Lambda's `cognito-idp:AdminGetUser` permission uses a region/account-based wildcard ARN (`arn:aws:cognito-idp:{region}:{account}:userpool/*`) to avoid circular dependencies.

---

## Integration with Permission Filtering

Regardless of the authentication mode, the permission filtering mechanism works the same way. The Permission Resolver automatically selects the appropriate filtering strategy based on the authentication source.

### Filtering Strategies

| Strategy | Condition | Behavior |
|----------|-----------|----------|
| SID Matching | `userSID` only | Match document `allowed_group_sids` against user SIDs |
| UID/GID Matching | `uid` + `gid` only | Match document `allowed_uids` / `allowed_gids` against user UID/GID |
| Hybrid Matching | Both `userSID` and `uid` | SID match priority, UID/GID fallback |
| Deny All (Fail-Closed) | No permission data | Deny all document access |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (auto strategy selection)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID priority → UID/GID fallback
  v
Match -> ALLOW, No match -> DENY
```

**Differences in SID Data Source:**

| Authentication Mode | SID Data Source | `source` Field |
|--------------------|----------------|----------------|
| Email/Password | `setup-user-access.sh` (manual) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatic) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatic) | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda (automatic) | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda (automatic) | `OIDC-Claims` |

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
| All documents denied after sign-in | No SID/UID/GID data in DynamoDB | AD Federation: Check AD Sync Lambda logs. OIDC: Check Identity Sync Lambda logs. Manual: Run `setup-user-access.sh` |
| "AD Sign-in" button not displayed | `enableAdFederation=false` | Check CDK parameters and redeploy |
| "OIDC Sign-in" button not displayed | `oidcProviderConfig` not set | Add `oidcProviderConfig` to CDK parameters and redeploy |
| SAML authentication failure | Invalid SAML metadata URL | Managed AD: Check IAM Identity Center settings. Self-managed: Check Entra ID metadata URL |
| OIDC authentication failure | Invalid `clientId` / `issuerUrl` | Verify OIDC IdP client settings match CDK parameters |
| LDAP permission retrieval failure | LDAP connection error | Check Identity Sync Lambda logs in CloudWatch. Sign-in is not blocked (Fail-Open) |
| AD group changes not reflected | SID cache (24 hours) | Wait 24 hours, or delete the relevant DynamoDB record and sign in again |
| AD Sync Lambda timeout | PowerShell execution via SSM is slow | Increase the `SSM_TIMEOUT` environment variable (default: 60 seconds) |
| OIDC groups not retrieved | Group claim not configured in IdP, or non-namespaced claims | Auth0 and other OIDC-conformant IdPs require namespaced custom claims in ID tokens. For Auth0, use `api.idToken.setCustomClaim('https://rag-system/groups', groups)` in a Post Login Action, and ensure Cognito attribute mapping matches |
| DynamoDB permission data not registered after OIDC sign-in | Post-Auth Trigger or Identity Sync Lambda not created | Deploying CDK with `oidcProviderConfig` automatically creates the Identity Sync Lambda and Post-Auth Trigger. Check Lambda execution logs in CloudWatch Logs |
| Custom attributes empty in PostConfirmation trigger | Cognito may not include custom attributes in PostConfirmation event | Identity Sync Lambda includes a Cognito AdminGetUser API fallback. Ensure Lambda role has `cognito-idp:AdminGetUser` permission |
| OAuth callback error (OIDC configuration) | `cloudFrontUrl` not set | `cloudFrontUrl` is also required for OIDC configuration. Set it in `cdk.context.json` and redeploy |

---


### LDAP Connector Considerations for OpenLDAP

When using the LDAP Connector with OpenLDAP environments, note the following:

| Item | Details |
|------|---------|
| memberOf Overlay | The LDAP Connector retrieves groups from the user entry's `memberOf` attribute. Basic OpenLDAP does not auto-populate `memberOf`, so you need to add `moduleload memberof` and `overlay memberof` to `slapd.conf` and create `groupOfNames` entries |
| posixGroup vs groupOfNames | `posixGroup` (`memberUid` attribute) and `groupOfNames` (`member` attribute) have different structural classes and cannot coexist in the same entry. The `memberOf` overlay requires `groupOfNames`, so create them in a separate OU (e.g., `ou=roles`) |
| unixGroups Limitation | The LDAP Connector extracts group names from `memberOf` DNs but does not perform secondary lookups for `gidNumber`. Therefore `unixGroups` will be `[{name: "groupname"}]` (without `gid`), and UID/GID filtering uses only the primary GID |
| groupSearchFilter | The `groupSearchFilter` in `cdk.context.json` is not used by the current LDAP Connector implementation. Group information is retrieved from the user entry's `memberOf` attribute |
| Secrets Manager | Bind password is stored as plain text string (not JSON format) |
| VPC Placement | When `ldapConfig` is specified, CDK automatically places the Lambda in the VPC and creates an LDAP security group (ports 389/636/443 outbound) |

### Setup & Verification Scripts

```bash
# OpenLDAP server setup (EC2 with test users/groups)
bash demo-data/scripts/setup-openldap.sh
bash demo-data/scripts/verify-ldap-integration.sh

# ONTAP name-mapping setup & verification
bash demo-data/scripts/setup-ontap-namemapping.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

## Verification Results

### CDK Synth + Deploy Verification (v3.4.0)

- CDK synth: ✅ Success
- CDK deploy: ✅ SecurityStack + WebAppStack UPDATE_COMPLETE
- Cognito OIDC IdP registration: ✅ Auth0 (`UserPoolIdentityProviderOidc`)
- Sign-in page: ✅ "Sign in with AD" + "Sign in with Auth0" both displayed (SAML + OIDC hybrid)
- OIDC auth flow: ✅ Auth0 auth → Cognito OAuth callback → Chat page (end-to-end success)
- Cognito auto user creation: ✅ `Auth0_auth0|...` (Status: EXTERNAL_PROVIDER)
- Post-Auth Trigger: ✅ PostConfirmation trigger fires Identity Sync Lambda on first OIDC sign-in
- DynamoDB auto-save: ✅ `source: "OIDC-Claims"`, `authSource: "oidc"` record created
- OIDC groups claim pipeline: ✅ Auth0 Post Login Action → namespaced claim (`https://rag-system/groups`) → Cognito `custom:oidc_groups` → Identity Sync Lambda → DynamoDB `oidcGroups: ["developers","rag-users"]`
- Cognito AdminGetUser API fallback: ✅ When PostConfirmation trigger event lacks custom attributes, Lambda retrieves them via Cognito API
- Backward compatibility: ✅ Existing SAML AD Federation works normally
- Unit tests: ✅ 130 tests pass
- Property tests: ✅ 52 tests pass (17 properties, numRuns=20)
- LDAP live environment test: ✅ OpenLDAP (EC2 in VPC) → LDAP Connector → DynamoDB (uid:10001, gid:5001, source:OIDC-LDAP)
- ONTAP name-mapping live environment test: ✅ ONTAP REST API connection → 3 name-mapping rules created/retrieved → resolveWindowsUser verified

SAML + OIDC hybrid sign-in page:

![Sign-in page (SAML + OIDC Hybrid)](../docs/screenshots/signin-page-saml-oidc-hybrid.png)

Auth0 OIDC login page:

![Auth0 OIDC Login Page](../docs/screenshots/oidc-auth0-login-page.png)

Chat page after Auth0 OIDC sign-in:

![Chat page after OIDC sign-in](../docs/screenshots/oidc-auth0-signin-success.png)

---

## Related Documents

- [README.md — AD SAML Federation](../../README.en.md#ad-saml-federation-option) — CDK deployment instructions
- [docs/implementation-overview.md — Section 3: IAM Authentication](../en/implementation-overview.md#3-iam-authentication--lambda-function-url-iam-auth--cloudfront-oac) — Infrastructure-layer authentication design
- [docs/SID-Filtering-Architecture.md](../en/SID-Filtering-Architecture.md) — Detailed SID filtering design
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD integration setup
