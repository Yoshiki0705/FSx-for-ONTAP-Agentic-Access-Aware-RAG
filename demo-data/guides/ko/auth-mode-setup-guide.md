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

## 인증 모드 선택 가이드

### 의사 결정 플로차트

기존 인증 인프라를 기반으로 최적의 인증 모드를 선택합니다.

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

### 권한 매핑 전략 선택

`permissionMappingStrategy` 파라미터는 문서 접근 제어 방식을 결정합니다.

| 전략 | 값 | 조건 | 문서 메타데이터 | 권장 환경 |
|----------|-------|-----------|-------------------|------------------------|
| SID 전용 | `sid-only` | Windows AD 환경 | `allowed_group_sids` | NTFS ACL 관리 파일 권한 |
| UID/GID 전용 | `uid-gid` | UNIX/Linux 환경 | `allowed_uids`, `allowed_gids` | POSIX 권한 관리 파일 |
| 하이브리드 | `hybrid` | 혼합 환경 | SID + UID/GID 모두 | AD와 LDAP 사용자가 공존 |

### OIDC IdP 통합 체크리스트

OIDC IdP를 통합할 때 IdP 측에서 다음 설정이 필요합니다.

#### 공통 (모든 OIDC IdP)

- [ ] RAG 시스템용 클라이언트 애플리케이션 생성 (Regular Web Application)
- [ ] `clientId` 및 `clientSecret` 취득
- [ ] `clientSecret`을 AWS Secrets Manager에 저장
- [ ] Allowed Callback URLs를 `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`로 설정
- [ ] Allowed Logout URLs를 `https://{cloudfront-url}/signin`으로 설정
- [ ] `/.well-known/openid-configuration`의 `issuer` 필드에서 `issuerUrl` 취득 (후행 슬래시 주의)
- [ ] `openid`, `email`, `profile` 스코프가 활성화되어 있는지 확인

#### Auth0 전용

- [ ] `issuerUrl`에 후행 슬래시 추가 (예: `https://xxx.auth0.com/`)
- [ ] 그룹 클레임: 네임스페이스 커스텀 클레임이 포함된 Post Login Action 구성

#### Keycloak 전용

- [ ] `issuerUrl`에 후행 슬래시 없음 (예: `https://keycloak.example.com/realms/main`)
- [ ] Client Protocol: `openid-connect`, Access Type: `confidential`
- [ ] 그룹 클레임: Client Scopes에서 `groups` mapper 추가

#### Okta 전용

- [ ] `issuerUrl`에 후행 슬래시 없음 (예: `https://company.okta.com`)
- [ ] Application Type: `Web Application`
- [ ] 그룹 클레임: Authorization Server → Claims → `groups` 클레임 추가

#### Entra ID (구 Azure AD) 전용

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Redirect URI 추가
- [ ] Token Configuration → Optional Claims → `groups` 추가

---

## LDAP 헬스체크 검증 (모드 C)

`ldapConfig`가 구성되면 LDAP 헬스체크 Lambda가 자동으로 생성됩니다. 다음 명령어를 사용하여 정상 작동 여부를 확인하세요.

```bash
# 수동 Lambda 호출 (connect/bind/search 단계 결과 확인)
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm 상태 (OK = 정상, ALARM = LDAP 연결 실패)
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge Rule (5분 간격 예약 실행)
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch Logs (구조화된 JSON 로그)
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **검증 완료 (2026-04-10)**: OpenLDAP EC2 (10.0.2.187:389) 에 대한 LDAP 헬스체크 Lambda 수동 호출 — 모든 단계 SUCCESS (connect: 12ms, bind: 12ms, search: 16ms, total: 501ms). CloudWatch Alarm: OK, EventBridge Rule: 5min ENABLED. NAT Gateway를 통한 Secrets Manager + CloudWatch Metrics 접근 확인 완료.

---

## 모드 간 마이그레이션

### Mode A → Mode C/D (이메일/비밀번호 → OIDC Federation)

가장 일반적인 마이그레이션 패턴입니다. PoC에서 Mode A로 시작한 후 프로덕션에서 OIDC Federation으로 마이그레이션합니다.

```bash
# Step 1: 현재 cdk.context.json 백업
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: cdk.context.json에 OIDC 구성 추가
# Step 3: 재배포 (Security + WebApp 스택만)
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: OIDC IdP 측에서 Callback URLs 구성
# Step 5: 검증 - 기존 이메일/비밀번호 사용자가 여전히 로그인 가능한지 확인
```

**참고:**
- 기존 Cognito 사용자 (이메일/비밀번호)는 삭제되지 않습니다
- 기존 DynamoDB SID 데이터는 보존됩니다
- SID + UID/GID 사용자 공존을 위해 `permissionMappingStrategy: "hybrid"` 사용
- Cognito User Pool의 `email.mutable`이 `false`인 경우 User Pool 재생성이 필요합니다

### Mode B → Mode E (SAML AD → SAML + OIDC 하이브리드)

기존 AD SAML Federation에 OIDC IdP를 추가합니다.

```bash
# Step 1: cdk.context.json에 oidcProviderConfig 추가 (enableAdFederation: true 유지)
# Step 2: Security + WebApp 스택 재배포
# Step 3: "Sign in with AD"와 "{providerName}" 버튼이 모두 표시되는지 확인
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
| OIDC 인증 실패 | C,D,E | `clientId`/`issuerUrl` 오류 | OIDC IdP 설정 확인. `issuerUrl`은 IdP의 `/.well-known/openid-configuration`의 `issuer` 값과 정확히 일치시킬 것 (Auth0는 후행 `/` 필요) |
| OIDC `invalid_request` | C,D,E | issuerUrl 후행 슬래시 불일치 | Auth0: `https://xxx.auth0.com/` (후행 `/` 필수), Keycloak: 후행 `/` 없음 |
| OIDC `Attribute cannot be updated` | C,D,E | email 속성이 `mutable: false` | User Pool 재생성 필요 (`mutable`은 생성 후 변경 불가) |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## 관련 문서

- [인증 및 사용자 관리 가이드](../../docs/ko/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
