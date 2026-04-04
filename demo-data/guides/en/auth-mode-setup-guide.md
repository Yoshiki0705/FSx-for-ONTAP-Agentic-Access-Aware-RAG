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
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, update, redeploy |
| ONTAP REST API unreachable | C | fsxadmin password not set | Set via `aws fsx update-file-system` |

---

## Related Documents

- [Authentication & User Management Guide](../../docs/en/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
- [Demo Scenarios](demo-scenario.md)
