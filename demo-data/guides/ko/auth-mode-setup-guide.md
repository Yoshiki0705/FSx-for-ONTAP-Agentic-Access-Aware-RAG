# 인증 모드별 데모 환경 구축 가이드

**작성일**: 2026-04-04
**작성일**: 5가지 인증 모드 각각의 데모 환경을 재현 가능한 절차로 구축

---

## 개요

본 시스템은 5가지 인증 모드를 지원합니다. 샘플 구성 파일이 `demo-data/configs/`에 준비되어 있으며, `cdk.context.json`에 복사하여 배포할 수 있습니다.

| 모드 | 구성 파일 | 인증 방식 | 권한 취득 | 추가 인프라 |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | 이메일/비밀번호 | 수동 SID 등록 | 없음 |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | OIDC Claims Only | OIDC 토큰 | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## 공통 절차

### 사전 요구 사항

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### 배포

```bash
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
bash demo-data/scripts/verify-deployment.sh
```

---

## 정리

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 문제 해결

| | 모드 | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 관련 문서

- [인증 및 사용자 관리 가이드](../../docs/ko/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
