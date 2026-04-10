# Authentication Mode Demo Environment Setup Guide

**Created**: 2026-04-04
**Purpose**: Build reproducible demo environments for each of the 5 authentication modes

---

## Overview

This system supports 5 authentication modes. Sample configuration files are provided in `demo-data/configs/` — just copy to `cdk.context.json` and deploy.

| Mode | Config File | Auth Method | Permission Source | Additional Infra |
|------|------------|-------------|-------------------|-----------------|
| A | `mode-a-email-password.json` | Email/Password | Manual SID registration | None |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | OIDC Claims Only | OIDC Token | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## Common Steps

### Prerequisites

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### Deployment

```bash
# 1. Copy config (choose mode)
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json

# 2. Replace REPLACE_* placeholders with actual values

# 3. Pre-deploy (ECR + Docker image)
bash demo-data/scripts/pre-deploy-setup.sh

# 4. CDK deploy (~30-40 min)
npx cdk deploy --all --require-approval never

# 5. Post-deploy (test data + users)
bash demo-data/scripts/post-deploy-setup.sh

# 6. Verify
bash demo-data/scripts/verify-deployment.sh
```

---

## Mode A: Email/Password (Minimal)

Simplest configuration. Admin manually creates Cognito users and DynamoDB SID data.

```bash
cp demo-data/configs/mode-a-email-password.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```

Test: `admin@example.com` / `DemoPass1234` → all documents accessible. `user@example.com` / `DemoPass1234` → public only.

Sign-in page: Email/password form only.

---

## Mode B: SAML AD Federation

AD users sign in via SAML; SIDs are auto-retrieved.

```bash
cp demo-data/configs/mode-b-saml-ad-federation.json cdk.context.json
# Replace: REPLACE_WITH_YOUR_METADATA_ID, REPLACE_WITH_YOUR_CLOUDFRONT_URL
```

Prerequisites: IAM Identity Center enabled, Managed AD configured as ID source, SAML application created.

After initial deploy, get CloudFront URL and update `cloudFrontUrl`, then redeploy Security + WebApp stacks.

Sign-in page: "Sign in with AD" button + email/password form.

---

## Mode C: OIDC + LDAP (OpenLDAP + Auth0/Keycloak)

OIDC sign-in + automatic UID/GID/group retrieval from LDAP.

### One-shot setup script

```bash
export OIDC_CLIENT_ID="your-client-id"
export OIDC_CLIENT_SECRET_ARN="arn:aws:secretsmanager:..."
export OIDC_ISSUER_URL="https://your-idp.auth0.com"
bash demo-data/scripts/setup-mode-c-oidc-ldap.sh
```

### Manual steps

```bash
cp demo-data/configs/mode-c-oidc-ldap.json cdk.context.json
# Replace all REPLACE_* placeholders
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/setup-ontap-namemapping.sh
bash demo-data/scripts/verify-ldap-integration.sh
```

### LDAP Health Check Verification

```bash
# Manual Lambda invocation (check connect/bind/search step results)
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm state (OK = healthy, ALARM = LDAP connection failure)
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge Rule (5-minute interval scheduled execution)
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch Logs (structured JSON logs)
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **Verified (2026-04-10)**: LDAP health check Lambda manual invocation against OpenLDAP EC2 (10.0.2.187:389) — all steps SUCCESS (connect: 12ms, bind: 12ms, search: 16ms, total: 501ms). CloudWatch Alarm: OK, EventBridge Rule: 5min ENABLED. Secrets Manager + CloudWatch Metrics access via NAT Gateway confirmed.

### Test Users (OpenLDAP)

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

Sign-in page: "Sign in with {provider}" button + email/password form.

---

## Mode D: OIDC Claims Only (No LDAP)

Lightest federation — uses only OIDC token group claims.

```bash
cp demo-data/configs/mode-d-oidc-claims-only.json cdk.context.json
# Replace REPLACE_* placeholders
```

Requires: OIDC IdP configured with group claims (Auth0: namespaced custom claims via Post Login Action).

---

## Mode E: SAML + OIDC Hybrid

Both AD SAML Federation and OIDC IdP enabled simultaneously.

```bash
cp demo-data/configs/mode-e-saml-oidc-hybrid.json cdk.context.json
```

Sign-in page: "Sign in with AD" + "Sign in with {provider}" + email/password form.

---

## Authentication Mode Selection Guide

### Decision Flowchart

Select the optimal authentication mode based on your existing authentication infrastructure.

```
What is your existing authentication infrastructure?
│
├─ None (new setup)
│   └─ → Mode A (Email/Password) to start
│       Can migrate to Mode C/D later
│
├─ Windows Active Directory (on-premises or Managed AD)
│   ├─ IAM Identity Center configured?
│   │   ├─ Yes → Mode B (SAML AD Federation)
│   │   └─ No  → Configure SAML via AD FS / Entra ID → Mode B
│   │
│   └─ Want to also use an OIDC IdP?
│       └─ Yes → Mode E (SAML + OIDC Hybrid)
│
├─ OIDC IdP (Keycloak / Okta / Entra ID / Auth0)
│   ├─ Also have LDAP/FreeIPA server?
│   │   └─ Yes → Mode C (OIDC + LDAP)
│   │       UID/GID-based permission filtering available
│   │
│   └─ No LDAP (IdP group claims only)
│       └─ → Mode D (OIDC Claims Only)
│           Group claim configuration required on IdP side
│
└─ Multiple IdPs simultaneously (Okta + Keycloak, etc.)
    └─ → oidcProviders array (Phase 2 Multi-OIDC)
        Each IdP button dynamically displayed on sign-in screen
```

### Permission Mapping Strategy Selection

The `permissionMappingStrategy` parameter controls how document access control works.

| Strategy | Value | Condition | Document Metadata | Recommended Environment |
|----------|-------|-----------|-------------------|------------------------|
| SID only | `sid-only` | Windows AD environment | `allowed_group_sids` | NTFS ACL-managed file permissions |
| UID/GID only | `uid-gid` | UNIX/Linux environment | `allowed_uids`, `allowed_gids` | POSIX permission-managed files |
| Hybrid | `hybrid` | Mixed environment | Both SID + UID/GID | Both AD and LDAP users exist |

### OIDC IdP Integration Checklist

When integrating an OIDC IdP, the following settings are required on the IdP side.

#### Common (All OIDC IdPs)

- [ ] Create a client application (Regular Web Application) for the RAG system
- [ ] Obtain `clientId` and `clientSecret`
- [ ] Store `clientSecret` in AWS Secrets Manager
- [ ] Set Allowed Callback URLs to `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
- [ ] Set Allowed Logout URLs to `https://{cloudfront-url}/signin`
- [ ] Get `issuerUrl` from `/.well-known/openid-configuration` `issuer` field (note trailing slash)
- [ ] Verify `openid`, `email`, `profile` scopes are enabled

#### Auth0-specific

- [ ] Add trailing slash to `issuerUrl` (e.g., `https://xxx.auth0.com/`)
- [ ] For group claims: Configure Post Login Action with namespaced custom claims

#### Keycloak-specific

- [ ] No trailing slash on `issuerUrl` (e.g., `https://keycloak.example.com/realms/main`)
- [ ] Client Protocol: `openid-connect`, Access Type: `confidential`
- [ ] Group claims: Add `groups` mapper in Client Scopes

#### Okta-specific

- [ ] No trailing slash on `issuerUrl` (e.g., `https://company.okta.com`)
- [ ] Application Type: `Web Application`
- [ ] Group claims: Authorization Server → Claims → Add `groups` claim

#### Entra ID (formerly Azure AD)-specific

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Add Redirect URI
- [ ] Token Configuration → Optional Claims → Add `groups`

---

## Migration Between Modes

### Mode A → Mode C/D (Email/Password → OIDC Federation)

The most common migration pattern. Start with Mode A for PoC, then migrate to OIDC Federation for production.

```bash
# Step 1: Backup current cdk.context.json
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: Add OIDC configuration to cdk.context.json
# Step 3: Redeploy (Security + WebApp stacks only)
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: Configure Callback URLs on OIDC IdP side
# Step 5: Verify - existing email/password users can still sign in
```

**Notes:**
- Existing Cognito users (email/password) are not deleted
- Existing DynamoDB SID data is preserved
- Use `permissionMappingStrategy: "hybrid"` for SID + UID/GID user coexistence
- If Cognito User Pool `email.mutable` is `false`, User Pool recreation is required

### Mode B → Mode E (SAML AD → SAML + OIDC Hybrid)

Add an OIDC IdP to existing AD SAML Federation.

```bash
# Step 1: Add oidcProviderConfig to cdk.context.json (keep enableAdFederation: true)
# Step 2: Redeploy Security + WebApp stacks
# Step 3: Verify both "Sign in with AD" and "{providerName}" buttons appear
```

---

## Cleanup

```bash
bash demo-data/scripts/cleanup-all.sh
# or: npx cdk destroy --all
```

---

## Troubleshooting

| Symptom | Mode | Cause | Solution |
|---------|------|-------|----------|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| All docs denied after sign-in | A | SID data not registered | Run `post-deploy-setup.sh` |
| "Sign in with AD" not shown | B,E | `enableAdFederation=false` | Check `cdk.context.json` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings. `issuerUrl` must exactly match the `issuer` field in IdP's `/.well-known/openid-configuration` (Auth0 requires trailing `/`) |
| OIDC `invalid_request` | C,D,E | issuerUrl trailing slash mismatch | Auth0: `https://xxx.auth0.com/` (trailing `/` required), Keycloak: no trailing `/` |
| OIDC `Attribute cannot be updated` | C,D,E | email attribute `mutable: false` | User Pool must be recreated (`mutable` cannot be changed after creation) |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, update, redeploy |
| ONTAP REST API unreachable | C | fsxadmin password not set | Set via `aws fsx update-file-system` |

---

## Related Documents

- [Authentication & User Management Guide](../../docs/en/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
- [Demo Scenarios](demo-scenario.md)
