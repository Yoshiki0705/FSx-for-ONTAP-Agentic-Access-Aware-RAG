# 인증 및 사용자 관리 가이드

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | **한국어** | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**작성일**: 2026-04-02
**버전**: 3.3.0

---

## 개요

본 시스템은 2가지 인증 모드를 제공합니다. 배포 시 CDK 컨텍스트 파라미터로 전환할 수 있습니다.

| 모드 | CDK 파라미터 | 사용자 생성 | SID 등록 | 권장 용도 |
|------|------------|-----------|---------|----------|
| 이메일/비밀번호 | `enableAdFederation=false` (기본값) | 관리자가 수동 생성 | 관리자가 수동 등록 | PoC / 데모 |
| AD Federation | `enableAdFederation=true` | 첫 로그인 시 자동 생성 | 로그인 시 자동 등록 | 프로덕션 / 엔터프라이즈 |

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

## SID 필터링과의 연동

인증 모드에 관계없이 SID 필터링 메커니즘은 동일합니다.

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

**SID 데이터 등록 출처의 차이:**

| 인증 모드 | SID 데이터 등록 출처 | `source` 필드 |
|----------|-------------------|--------------|
| 이메일/비밀번호 | `setup-user-access.sh` (수동) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (자동) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (자동) | `AD-Sync-self-managed` |

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
| 로그인 후 전체 문서가 거부됨 | DynamoDB에 SID 데이터가 없음 | AD Federation: AD Sync Lambda 로그를 확인. 수동: `setup-user-access.sh` 실행 |
| "AD로 로그인" 버튼이 표시되지 않음 | `enableAdFederation=false` | CDK 파라미터를 확인하고 재배포 |
| SAML 인증 실패 | SAML 메타데이터 URL 오류 | Managed AD: IAM Identity Center 설정 확인. Self-managed: Entra ID 메타데이터 URL 확인 |
| AD 그룹 변경이 반영되지 않음 | SID 캐시 (24시간) | 24시간 대기하거나 DynamoDB의 해당 레코드를 삭제하고 재로그인 |
| AD Sync Lambda 타임아웃 | SSM 경유 PowerShell 실행이 느림 | `SSM_TIMEOUT` 환경 변수를 늘림 (기본값: 60초) |

---

## 관련 문서

- [README.md — AD SAML 페더레이션](../../README.ko.md#ad-saml-페더레이션-옵션) — CDK 배포 절차
- [docs/implementation-overview.md — 섹션 3: IAM 인증](../ko/implementation-overview.md#3-iam-인증--lambda-function-url-iam-auth--cloudfront-oac) — 인프라 계층의 인증 설계
- [docs/SID-Filtering-Architecture.md](../ko/SID-Filtering-Architecture.md) — SID 필터링 상세 설계
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD 연동 설정
