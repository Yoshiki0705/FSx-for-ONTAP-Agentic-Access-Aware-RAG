# 인증 및 사용자 관리 가이드

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | **한국어** | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**작성일**: 2026-04-02
**버전**: 3.4.0

---

## 개요

본 시스템은 2가지 인증 모드를 제공합니다. 배포 시 CDK 컨텍스트 파라미터로 전환할 수 있습니다.

| 모드 | CDK 파라미터 | 사용자 생성 | SID 등록 | 권장 용도 |
|------|------------|-----------|---------|----------|
| 이메일/비밀번호 | `enableAdFederation=false` (기본값) | 관리자가 수동 생성 | 관리자가 수동 등록 | PoC / 데모 |
| AD Federation | `enableAdFederation=true` | 첫 로그인 시 자동 생성 | 로그인 시 자동 등록 | 프로덕션 / 엔터프라이즈 |
| OIDC/LDAP Federation | `oidcProviderConfig` 지정 | 첫 로그인 시 자동 생성 | 로그인 시 자동 등록 | 멀티 IdP / LDAP 환경 |

### 제로터치 사용자 프로비저닝

AD Federation 및 OIDC/LDAP Federation 모드에서는 "제로터치 사용자 프로비저닝"을 실현합니다. 이는 파일 서버(FSx for NetApp ONTAP)의 기존 사용자 권한을 RAG 시스템의 UI 사용자에 자동으로 매핑하는 메커니즘입니다.

- 관리자가 RAG 시스템 측에서 사용자를 수동으로 생성할 필요가 없습니다
- 사용자 자신이 셀프 등록할 필요도 없습니다
- IdP(AD/Keycloak/Okta/Entra ID 등)에서 관리되는 사용자가 처음 로그인하면 Cognito 사용자 생성 → 권한 정보 취득 → DynamoDB 등록이 모두 자동으로 수행됩니다
- 파일 서버 측의 권한 변경은 캐시 TTL(24시간) 경과 후 다음 로그인 시 자동 반영됩니다

---

## 모드 1: 이메일/비밀번호 인증 (기본값)

### 동작 방식

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Cognito User Pool에 직접 사용자를 생성하고, 이메일 주소와 비밀번호로 로그인합니다.

### 관리자 작업

**Step 1: Cognito 사용자 생성**

```bash
# post-deploy-setup.sh 가 자동 실행, 또는 수동으로:
bash demo-data/scripts/create-demo-users.sh
```

**Step 2: DynamoDB SID 데이터 등록**

```bash
# SID 데이터를 수동 등록
bash demo-data/scripts/setup-user-access.sh
```

이 스크립트는 DynamoDB `user-access` 테이블에 다음을 등록합니다:

| userId | userSID | groupSIDs | 접근 범위 |
|--------|---------|-----------|----------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | 전체 문서 |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | public만 |

### 제약 사항

- 사용자를 추가할 때마다 관리자가 Cognito + DynamoDB 양쪽을 수동으로 업데이트해야 함
- AD 그룹 멤버십 변경이 자동으로 반영되지 않음
- 대규모 운영에는 적합하지 않음

---

## 모드 2: AD Federation (권장: 엔터프라이즈)

### 동작 방식

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

AD 사용자가 SAML을 통해 로그인하면 다음이 모두 자동으로 수행됩니다:

1. **Cognito 사용자 자동 생성** — SAML 어설션의 이메일 속성에서 Cognito 사용자를 자동 생성
2. **SID 자동 취득** — AD Sync Lambda가 AD에서 사용자 SID + 그룹 SID를 취득
3. **DynamoDB 자동 등록** — 취득한 SID 데이터를 `user-access` 테이블에 저장 (24시간 캐시)

관리자의 수동 작업이 필요하지 않습니다.

### AD Sync Lambda 동작

| AD 방식 | SID 취득 방법 | 필요한 인프라 |
|---------|-------------|-------------|
| Managed AD | LDAP 또는 SSM 경유 PowerShell | AWS Managed AD + (옵션) Windows EC2 |
| Self-managed AD | SSM 경유 PowerShell | Windows EC2 (AD 참가 완료) |

**캐시 동작:**
- 첫 로그인: AD에 쿼리하여 SID를 취득, DynamoDB에 저장
- 이후 로그인 (24시간 이내): DynamoDB 캐시를 사용, AD 쿼리를 건너뜀
- 24시간 경과 후: 다음 로그인 시 AD에서 재취득

**오류 시 동작:**
- AD Sync Lambda 실패 시에도 로그인은 차단되지 않음 (오류 로그만 기록)
- SID 데이터가 없는 경우, SID 필터링은 Fail-Closed (전체 문서 거부)

### 패턴 A: AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**설정 절차:**
1. CDK 배포 (Managed AD + SAML IdP + Cognito Domain 생성)
2. SVM AD 참가 (`post-deploy-setup.sh`가 자동 실행)
3. IAM Identity Center에서 Cognito용 SAML 애플리케이션 생성 (또는 `samlMetadataUrl`로 외부 IdP 지정)
4. Cognito Hosted UI의 "AD로 로그인" 버튼에서 AD 인증 실행

### 패턴 B: Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**설정 절차:**
1. Windows EC2를 AD에 참가시키고 SSM Agent를 활성화
2. Entra ID에서 SAML 애플리케이션을 생성하고 메타데이터 URL을 취득
3. CDK 배포
4. CloudFront UI의 "AD로 로그인" 버튼에서 AD 인증 실행

### CDK 파라미터 목록

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `enableAdFederation` | boolean | `false` | SAML 페더레이션 활성화 |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed AD 관리자 비밀번호 |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | AD 참가 완료 Windows EC2 인스턴스 ID |
| `samlMetadataUrl` | string | - | SAML IdP 메타데이터 URL |
| `adDomainName` | string | - | AD 도메인 이름 (예: demo.local) |
| `adDnsIps` | string | - | AD DNS IP (쉼표 구분) |
| `cloudFrontUrl` | string | - | OAuth 콜백 URL |

---

## 모드 3: OIDC/LDAP Federation (멀티 IdP / LDAP 환경)

### 동작 방식

```
OIDC User -> CloudFront UI -> "OIDC로 로그인" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

OIDC 사용자가 로그인하면 다음이 모두 자동으로 수행됩니다:

1. **Cognito 사용자 자동 생성** — OIDC 어설션의 email 속성에서 Cognito 사용자를 자동 생성
2. **권한 정보 자동 취득** — Identity Sync Lambda가 LDAP 서버 또는 OIDC 클레임에서 SID/UID/GID/그룹 정보를 취득
3. **DynamoDB 자동 등록** — 취득한 권한 데이터를 `user-access` 테이블에 저장 (24시간 캐시)

### 설정 기반 자동 활성화

각 인증 방식은 설정 값이 제공되면 자동으로 활성화됩니다. 추가 AWS 리소스 비용은 거의 없습니다.

| 기능 | 활성화 조건 | 추가 비용 |
|------|-----------|----------|
| OIDC Federation | `oidcProviderConfig` 지정 | 없음 (Cognito IdP 등록 무료) |
| LDAP 권한 취득 | `ldapConfig` 지정 | 없음 (Lambda 실행 시 과금만) |
| OIDC 클레임 권한 취득 | `oidcProviderConfig` 지정 + `ldapConfig` 없음 | 없음 |
| UID/GID 권한 필터링 | `permissionMappingStrategy`가 `uid-gid` 또는 `hybrid` | 없음 |
| ONTAP name-mapping | `ontapNameMappingEnabled=true` | 없음 |

> **CDK 자동 설정**: `oidcProviderConfig`를 지정하여 CDK를 배포하면 다음이 자동으로 구성됩니다:
> - Cognito User Pool에 OIDC IdP가 등록됩니다
> - Cognito Domain이 생성됩니다(`enableAdFederation=true`로 미생성 시)
> - User Pool Client에 OIDC IdP가 지원 프로바이더로 추가됩니다
> - Identity Sync Lambda가 생성되고 Post-Authentication Trigger로 등록됩니다
> - WebAppStack Lambda에 OAuth 환경 변수(`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`)가 자동 설정됩니다
>
> `enableAdFederation=true`와 `oidcProviderConfig`를 동시에 지정하면 SAML + OIDC 모두 지원되며 로그인 화면에 두 버튼이 모두 표시됩니다.

### 패턴 C: OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak)

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

### 패턴 D: OIDC Claims Only (LDAP 없음)

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

> **Auth0 사용 시 중요 참고 사항**: Auth0의 OIDC 준수 애플리케이션에서는 ID 토큰의 커스텀 클레임에 네임스페이스(URL prefix)가 필요합니다. 네임스페이스 없는 `groups` 클레임은 ID 토큰에서 자동으로 제외됩니다. Auth0의 Post Login Action에서 다음과 같이 네임스페이스가 포함된 클레임을 설정하세요:
>
> ```javascript
> // Auth0 Post Login Action
> exports.onExecutePostLogin = async (event, api) => {
>   const groups = ['developers', 'rag-users']; // 사용자의 그룹
>   api.idToken.setCustomClaim('https://rag-system/groups', groups);
>   api.accessToken.setCustomClaim('https://rag-system/groups', groups);
> };
> ```
>
> CDK 측의 `groupClaimName`은 `groups`로 유지하면 됩니다. CDK가 자동으로 `https://rag-system/groups` → `custom:oidc_groups` 속성 매핑을 설정합니다.

### 패턴 E: SAML + OIDC 하이브리드

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

### CDK 파라미터 목록 (OIDC/LDAP)

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | IdP 표시 이름 (로그인 버튼에 표시) |
| `oidcProviderConfig.clientId` | string | **필수** | OIDC 클라이언트 ID |
| `oidcProviderConfig.clientSecret` | string | **필수** | OIDC 클라이언트 시크릿 (Secrets Manager ARN 지원, CDK가 배포 시 자동으로 값을 해석) |
| `oidcProviderConfig.issuerUrl` | string | **필수** | OIDC 이슈어 URL |
| `oidcProviderConfig.groupClaimName` | string | `groups` | 그룹 정보 클레임 이름 |
| `ldapConfig.ldapUrl` | string | - | LDAP/LDAPS URL (예: `ldaps://ldap.example.com:636`) |
| `ldapConfig.baseDn` | string | - | 검색 베이스 DN (예: `dc=example,dc=com`) |
| `ldapConfig.bindDn` | string | - | 바인드 DN (예: `cn=readonly,dc=example,dc=com`) |
| `ldapConfig.bindPasswordSecretArn` | string | - | 바인드 비밀번호 Secrets Manager ARN |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | 사용자 검색 필터 |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | 그룹 검색 필터 |
| `permissionMappingStrategy` | string | `sid-only` | 권한 매핑 전략: `sid-only`, `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | ONTAP name-mapping 연동 |

> **CDK 배포 시 고려사항**:
> - `clientSecret`에 Secrets Manager ARN을 지정하면, CDK가 배포 시 자동으로 시크릿 값을 해석합니다.
> - Cognito 커스텀 속성은 생성 후 변경/삭제할 수 없습니다 (CloudFormation 제한). 이 제한으로 인해 `oidc_groups`는 CDK User Pool 정의에서 제외됩니다.
> - CDK 배포 직후 Cognito가 OIDC 엔드포인트를 재해석하는 동안 일시적으로 OIDC 로그인이 실패할 수 있습니다 (1~2분).
> - `AdminGetUser` 권한은 순환 의존성을 방지하기 위해 와일드카드 ARN을 사용합니다.

---

## 권한 필터링과의 연동

인증 모드에 관계없이 권한 필터링 메커니즘은 동일합니다. Permission Resolver가 인증 소스에 따라 적절한 필터링 전략을 자동 선택합니다.

### 필터링 전략

| 전략 | 조건 | 동작 |
|------|------|------|
| SID Matching | `userSID`만 존재 | 문서의 `allowed_group_sids`와 사용자 SID를 대조 |
| UID/GID Matching | `uid` + `gid`만 존재 | 문서의 `allowed_uids` / `allowed_gids`와 사용자 UID/GID를 대조 |
| Hybrid Matching | `userSID`와 `uid` 모두 존재 | SID 매칭 우선, UID/GID 폴백 |
| Deny All (Fail-Closed) | 권한 정보 없음 | 전체 문서 접근 거부 |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (전략 자동 선택)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID 우선 → UID/GID 폴백
  v
Match -> ALLOW, No match -> DENY
```

**SID 데이터 등록 출처의 차이:**

| 인증 모드 | SID 데이터 등록 출처 | `source` 필드 |
|----------|-------------------|--------------|
| 이메일/비밀번호 | `setup-user-access.sh` (수동) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (자동) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (자동) | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda (자동) | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda (자동) | `OIDC-Claims` |

### DynamoDB user-access 테이블 스키마

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

## 문제 해결

| 증상 | 원인 | 대처 |
|------|------|------|
| 로그인 후 전체 문서가 거부됨 | DynamoDB에 SID/UID/GID 데이터가 없음 | AD Federation: AD Sync Lambda 로그를 확인. OIDC: Identity Sync Lambda 로그를 확인. 수동: `setup-user-access.sh` 실행 |
| "AD로 로그인" 버튼이 표시되지 않음 | `enableAdFederation=false` | CDK 파라미터를 확인하고 재배포 |
| "OIDC로 로그인" 버튼이 표시되지 않음 | `oidcProviderConfig` 미설정 | CDK 파라미터에 `oidcProviderConfig`를 추가하고 재배포 |
| SAML 인증 실패 | SAML 메타데이터 URL 오류 | Managed AD: IAM Identity Center 설정 확인. Self-managed: Entra ID 메타데이터 URL 확인 |
| OIDC 인증 실패 | `clientId` / `issuerUrl` 오류 | OIDC IdP 측 클라이언트 설정과 CDK 파라미터의 일치를 확인 |
| LDAP 권한 취득 실패 | LDAP 연결 오류 | CloudWatch Logs에서 Identity Sync Lambda 오류를 확인. 로그인 자체는 차단되지 않음 (Fail-Open) |
| AD 그룹 변경이 반영되지 않음 | SID 캐시 (24시간) | 24시간 대기하거나 DynamoDB의 해당 레코드를 삭제하고 재로그인 |
| AD Sync Lambda 타임아웃 | SSM 경유 PowerShell 실행이 느림 | `SSM_TIMEOUT` 환경 변수를 늘림 (기본값: 60초) |
| OIDC 그룹이 취득되지 않음 | IdP 측에서 그룹 클레임 미설정 또는 네임스페이스 없는 클레임 | Auth0 등의 OIDC 준수 IdP에서는 ID 토큰의 커스텀 클레임에 네임스페이스(URL prefix)가 필요. Auth0의 경우 Post Login Action에서 `api.idToken.setCustomClaim('https://rag-system/groups', groups)`와 같이 네임스페이스가 포함된 클레임을 설정하고, Cognito 속성 매핑도 `https://rag-system/groups` → `custom:oidc_groups`에 맞춤 |
| OIDC 로그인 후 DynamoDB에 권한 데이터가 등록되지 않음 | Post-Auth Trigger 또는 Identity Sync Lambda가 미생성 | `oidcProviderConfig`를 지정하여 CDK를 배포하면 Identity Sync Lambda와 Post-Auth Trigger가 자동 생성됨. CloudWatch Logs에서 Lambda 실행 로그 확인 |
| PostConfirmation 트리거에서 커스텀 속성이 비어 있음 | Cognito 사양상 PostConfirmation 이벤트에 커스텀 속성이 포함되지 않는 경우가 있음 | Identity Sync Lambda에는 Cognito AdminGetUser API 폴백이 구현되어 있음. Lambda 실행 역할에 `cognito-idp:AdminGetUser` 권한이 부여되어 있는지 확인 |
| OAuth 콜백 오류 (OIDC 구성) | `cloudFrontUrl` 미설정 | OIDC 구성에서도 `cloudFrontUrl`이 필요. `cdk.context.json`에 설정하고 재배포 |

---

## 검증 결과

### CDK Synth + 배포 검증 (v3.4.0)

- CDK synth/deploy: ✅ 성공
- Cognito OIDC IdP 등록: ✅ Auth0
- 로그인 화면: ✅ SAML + OIDC 하이브리드
- OIDC 인증 플로우: ✅ 엔드투엔드 성공
- Post-Auth Trigger: ✅ PostConfirmation
- DynamoDB 자동 저장: ✅ OIDC-Claims
- OIDC 그룹 클레임 파이프라인: ✅ Auth0 Post Login Action → 네임스페이스 클레임(`https://rag-system/groups`) → Cognito `custom:oidc_groups` → Identity Sync Lambda → DynamoDB `oidcGroups: ["developers","rag-users"]`
- Cognito AdminGetUser API 폴백: ✅ PostConfirmation 트리거 이벤트에 커스텀 속성이 미포함 시 Cognito API에서 직접 취득하여 정상 동작
- 유닛 테스트: ✅ 130 패스
- 프로퍼티 테스트: ✅ 52 패스

![로그인 화면 (SAML + OIDC 하이브리드)](../docs/screenshots/signin-page-saml-oidc-hybrid.png)

![Auth0 OIDC 로그인 페이지](../docs/screenshots/oidc-auth0-login-page.png)

![OIDC 로그인 성공 후 채팅 화면](../docs/screenshots/oidc-auth0-signin-success.png)

---

## 관련 문서

- [README.md — AD SAML 페더레이션](../../README.ko.md#ad-saml-페더레이션-옵션) — CDK 배포 절차
- [docs/implementation-overview.md — 섹션 3: IAM 인증](../ko/implementation-overview.md#3-iam-인증--lambda-function-url-iam-auth--cloudfront-oac) — 인프라 계층의 인증 설계
- [docs/SID-Filtering-Architecture.md](../ko/SID-Filtering-Architecture.md) — SID 필터링 상세 설계
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD 연동 설정
