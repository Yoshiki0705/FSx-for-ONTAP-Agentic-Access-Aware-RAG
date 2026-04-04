# 검증 시나리오 가이드

## 개요

Permission-aware RAG 시스템의 동작 검증 절차입니다. SID 기반 권한 필터링을 통해 동일한 질문에 대해 사용자별로 다른 검색 결과가 반환되는 것을 확인합니다.

---

## 시나리오 4: OIDC + LDAP Federation 검증

> **전제 조건**: `oidcProviderConfig` + `ldapConfig`로 CDK 배포 완료. VPC 내 OpenLDAP 서버 가동 중.

### 4-1. OpenLDAP 설정

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP 테스트 사용자

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. 확인 사항

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. 검증 스크립트

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. OpenLDAP 구축 시 고려사항

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

[인증 모드별 설정 가이드](ko/auth-mode-setup-guide.md) 참조.
