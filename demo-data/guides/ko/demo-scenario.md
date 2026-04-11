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


---

## 5. 멀티 에이전트 협업 데모

### 사전 요구사항

`cdk.context.json`에서 `enableMultiAgent: true`로 설정하여 배포 완료.

### 5-1. 멀티 에이전트 모드 활성화

1. 채팅 헤더에서 **[Multi]** 토글 클릭
2. Team 드롭다운에서 "Permission RAG Team" 선택
3. 새로운 멀티 에이전트 세션이 자동 생성됨

### 5-2. 권한 필터링 멀티 에이전트 검색

**admin**으로 로그인하여 질문을 보내세요. Agent Trace UI에서 타임라인과 비용 내역을 확인하세요. 그런 다음 **user**로 로그인하여 결과를 비교하세요.

### 5-3. Single Agent vs Multi-Agent 비교

1. **Single 모드**에서 질문 전송 → 응답 시간과 비용 기록
2. **Multi 모드**로 전환 → 같은 질문 전송 → 비교

### 5-4. 배포 시 주의사항

- **CloudFormation `AgentCollaboration` 유효 값**: `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` 만 가능. `COLLABORATOR`는 무효
- **2단계 배포**: Supervisor Agent를 `DISABLED`로 생성 후, Custom Resource Lambda로: `UpdateAgent` → `SUPERVISOR_ROUTER`, `AssociateAgentCollaborator`, `PrepareAgent`
- **IAM 권한**: Supervisor 역할에 `bedrock:GetAgentAlias` + `bedrock:InvokeAgent` (`agent-alias/*/*`) 필요. Custom Resource Lambda에 `iam:PassRole` 필요
- **Collaborator Alias**: 각 Collaborator Agent는 Supervisor 참조 전에 `CfnAgentAlias` 필요
- **autoPrepare=true 불가**: Supervisor Agent에서 사용 불가

### 5-5. 운영 시 발견사항

- **Team 목록 조회**: 채팅 페이지의 Multi 모드 토글은 마운트 시 API를 통해 팀 목록을 가져오고 `teams.length > 0`을 확인합니다. 팀이 없으면 Multi 모드가 비활성화됩니다 (의도된 동작)
- **Supervisor 직접 선택**: 드롭다운에서 Supervisor Agent를 선택하고 Single Agent 모드에서 호출해도 Bedrock 측에서 멀티 에이전트 협업이 트리거됩니다 (Supervisor → Collaborator 실행 흐름 작동)
- **권한 필터링**: Supervisor Agent 응답에는 권한 필터링된 인용이 포함됩니다 (admin 사용자는 기밀 문서를 볼 수 있고, 일반 사용자는 공개 문서만 볼 수 있음)
- **Docker 이미지 업데이트**: 코드 변경 후 3단계가 필요합니다: `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` (CDK는 `latest` 태그 변경을 감지하지 못함)
- **Multi 모드 통합**: Multi 모드 토글 → `/api/bedrock/agent-team/invoke` 호출 → `multiAgentTrace` 포함 응답 → MultiAgentTraceTimeline + CostSummary 조건부 렌더링 동작 확인 완료
- **Collaborator 트레이스**: `buildCollaboratorTraces`는 Bedrock Agent InvokeAgent API 트레이스 이벤트에서 Collaborator 실행 정보를 추출하지만, Supervisor 내부의 Collaborator 호출이 트레이스에 항상 포함되지 않을 수 있습니다 (Bedrock 측 제한). 응답 자체는 정상적으로 반환됩니다
- **routingClassifierTrace**: `SUPERVISOR_ROUTER` 모드에서 Collaborator 트레이스는 `orchestrationTrace`가 아닌 `routingClassifierTrace` 내의 `agentCollaboratorInvocationInput/Output`에 포함됩니다
- **filteredSearch SID 자동 해결**: filteredSearch Lambda는 `sessionAttributes.userId`를 통해 DynamoDB User Access Table에서 SID 정보를 자동으로 해결합니다. 명시적 SID 파라미터 없이도 권한 필터링이 작동합니다
- **KB 메타데이터 따옴표 문제**: Bedrock KB의 `allowed_group_sids`에 추가 따옴표가 포함될 수 있습니다. `cleanSID` 함수가 이를 제거하여 올바른 SID 매칭을 수행합니다
- **Agent instruction 다국어 지원**: CDK `agentLanguage` 속성 (기본값: `'auto'`)으로 영어 기반 instruction에 사용자 입력 언어에 맞춘 자동 응답 언어 전환이 가능합니다
- **E2E 검증 성공**: admin 사용자 Multi 모드 → 제품 카탈로그 조회 → FSx for ONTAP 콘텐츠가 권한 필터링과 함께 반환됨. RetrievalAgent 상세 패널 및 CostSummary 정상 표시
