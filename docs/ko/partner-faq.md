# 파트너 FAQ (자주 묻는 질문)

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | **한국어** | [简体中文](../zh-CN/partner-faq.md) | [繁體中文](../zh-TW/partner-faq.md) | [Français](../fr/partner-faq.md) | [Deutsch](../de/partner-faq.md) | [Español](../es/partner-faq.md)

**작성일**: 2026-05-24  
**대상**: 파트너 기업, 시스템 통합 사업자(SI), 컨설팅 회사

---

## 고객 제안 시 자주 묻는 질문

### Q1. 기존 파일 서버(Windows Server)에서 마이그레이션이 가능한가요?

**A**: 네. FSx for ONTAP은 Windows Server 파일 서버와 동일한 SMB/CIFS 프로토콜을 지원하며, NTFS ACL을 그대로 유지할 수 있습니다. 기존 Active Directory에 도메인 조인하면 사용자가 느끼는 조작감은 변하지 않습니다. 마이그레이션에는 AWS DataSync 또는 robocopy를 사용할 수 있습니다.

**관련 문서**: [FSx for ONTAP 사이징·성능 설계](fsxn-sizing-and-performance.md)

---

### Q2. 권한 설정은 누가 하나요? 추가 설정 작업이 필요한가요?

**A**: 기존 NTFS ACL / UNIX 퍼미션이 그대로 RAG 검색에 반영됩니다. 추가 권한 설정은 불필요합니다. 파일 서버 관리자가 평소대로 폴더 권한을 설정하면 RAG 검색 결과에 자동으로 반영됩니다.

**구조**: 파일의 `.metadata.json`에 권한 정보(SID/UID/GID)가 기록되며, 검색 시 사용자의 권한과 대조하여 필터링됩니다.

---

### Q3. 어느 정도의 파일 수까지 대응할 수 있나요?

**A**: 다음과 같은 규모별 구성을 권장합니다:

| 규모 | 파일 수 | FSx 구성 | 월 예상 비용 |
|------|-----------|---------|---------|
| 소규모(PoC) | 최대 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| 중규모 | 최대 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| 대규모 | 최대 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**관련 문서**: [비용 추정 워크시트](cost-estimation-worksheet.md)

---

### Q4. 기존 인증 기반(Active Directory / Okta / Auth0)과 연계할 수 있나요?

**A**: 네. 다음 인증 방식에 대응합니다:

| 인증 방식 | 지원 IdP | SID/권한 취득 방법 |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger로 AD에서 SID 자동 취득 |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC 그룹 클레임 + LDAP 쿼리 |
| LDAP | OpenLDAP, FreeIPA | UID/GID 직접 취득 |
| 이메일/비밀번호 | Cognito | DynamoDB에 수동 등록 |

**관련 문서**: [인증·사용자 관리 가이드](auth-and-user-management.md)

---

### Q5. PoC에는 어느 정도의 기간과 비용이 드나요?

**A**: 

| 단계 | 기간 | AWS 비용 | 작업 내용 |
|---------|------|-----------|---------|
| 배포 | 1일 | — | CDK 배포 + 테스트 데이터 투입 |
| 기본 검증 | 1주 | ~$100 | 데모 데이터로 동작 확인 |
| 고객 데이터 PoC | 2-4주 | ~$430/월 | 실 데이터 투입 + 평가 |

**90분 핸즈온**도 준비되어 있습니다 → [PoC 워크숍 가이드](poc-workshop-guide.md)

---

### Q6. 보안 요건이 엄격한 고객(금융, 의료, 공공)에게 제안할 수 있나요?

**A**: 네. 다음과 같은 보안 기능을 갖추고 있습니다:

- 6계층 방어(Geo 제한 → WAF → OAC → IAM Auth → Cognito → SID 필터링)
- KMS 암호화(S3, DynamoDB, FSx)
- VPC 엔드포인트(인터넷 비경유)
- 감사 로그(CloudTrail + DynamoDB 감사 테이블)
- Fail-Closed 설계(권한 불명 시 액세스 거부)
- Bedrock Guardrails(콘텐츠 필터, PII 탐지)

**다만**: 본 시스템의 기술적 보안 기능은 법적·컴플라이언스 요건을 자동으로 충족하는 것은 아닙니다. 규제 대상 워크로드에서는 고객 고유의 법무·컴플라이언스 평가가 필요합니다.

**관련 문서**: [프로덕션 준비 체크리스트](production-readiness-checklist.md), [위협 모델](threat-model.md)

---

### Q7. 멀티테넌트(여러 고객으로의 전개)가 가능한가요?

**A**: 네. 3가지 전개 패턴을 준비하고 있습니다:

| 패턴 | 분리 수준 | 적용 조건 |
|---------|-----------|---------|
| A: 계정 분리 | 최고 | 엄격한 데이터 분리 요건(금융, 의료) |
| B: SVM 분리 | 높음 | 동일 계정 내에서 고객 데이터 분리 |
| C: 프리픽스 분리 | 중간 | 비용 중시, 소규모 고객 |

**관련 문서**: [파트너 전개 패턴](partner-deployment-patterns.md)

---

### Q8. 외부 파트너(법률 사무소, 회계 감사 법인)로부터의 문서 수신은?

**A**: AWS Transfer Family를 통한 SFTP 인제스션을 지원합니다. 파트너는 SFTP 클라이언트로 파일을 업로드하기만 하면, 자동으로 권한 메타데이터가 부여되어 RAG Knowledge Base에 취입됩니다.

- 파트너는 Web UI나 AWS Console에 대한 액세스가 불필요
- `.metadata.json` 덮어쓰기는 IAM Deny로 방지(신뢰 경계 보호)
- 5분 이내에 RAG 검색 가능

**관련 문서**: [Transfer Family 파트너 온보딩](transfer-family-partner-onboarding.md)

---

### Q9. 음성으로 질문이 가능한가요?

**A**: 네. 2가지 음성 채팅 모드를 제공합니다:

| 모드 | 기술 | 레이턴시 | 상태 |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | 중 | GA, CDK 배포 가능 |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | 낮음 | 구현 완료, CLI 배포 |

음성 입력 → 텍스트 변환 → Permission-aware RAG 검색 → 음성 출력의 전체 흐름에서 권한 필터링이 적용됩니다.

---

### Q10. 다른 AWS 서비스와의 연계는?

**A**: 다음 서비스와 통합되어 있습니다:

| 서비스 | 용도 |
|---------|------|
| Amazon Bedrock (KB + Agent) | RAG 검색 + 멀티에이전트 협조 |
| Amazon Cognito | 인증·사용자 관리 |
| Amazon CloudFront + WAF | CDN + 보안 |
| Amazon S3 Vectors | 벡터 DB(저비용) |
| Amazon EventBridge | KB 자동 동기화 스케줄링 |
| AWS Transfer Family | SFTP 인제스션 |
| Amazon CloudWatch | 모니터링·알림·대시보드 |
| AWS Step Functions | FSx for ONTAP 운영 자동화 |

---

## 기술적인 자주 묻는 질문

### Q11. S3 Access Point과 S3 버킷의 차이는?

**A**: S3 Access Point은 FSx for ONTAP 볼륨에 대한 S3 호환 액세스 인터페이스입니다. S3 버킷과는 달리:

- 데이터는 FSx for ONTAP 상에 계속 존재합니다(S3에 복사되지 않습니다)
- NFS/SMB와 S3 API 양쪽에서 동일한 데이터에 액세스할 수 있습니다
- 5GB의 업로드 크기 제한이 있습니다
- rename / append 작업은 지원되지 않습니다

---

### Q12. 배포에 실패한 경우의 롤백은?

**A**: CDK는 CloudFormation 기반이므로, 배포 실패 시 자동으로 롤백됩니다. 수동 롤백이 필요한 경우:

```bash
# 특정 스택 삭제
npx cdk destroy <stack-name>

# 전체 스택 삭제
npx cdk destroy --all --force
```

**관련 문서**: [배포 트러블슈팅](deployment-troubleshooting.md)

---

## 제안·워크숍에서 사용할 수 있는 리소스

| 리소스 | 용도 | 링크 |
|---------|------|--------|
| 업종별 데모 데이터 | 고객 업종에 맞춘 데모 | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90분 워크숍 | 핸즈온 체험 | [PoC 워크숍 가이드](poc-workshop-guide.md) |
| 비용 추정 | 제안서 첨부용 | [비용 추정 워크시트](cost-estimation-worksheet.md) |
| PoC 성공 기준 | 고객 합의용 | [PoC 성공 기준 템플릿](poc-success-criteria-template.md) |
| 프로덕션 준비 체크리스트 | 마이그레이션 계획용 | [프로덕션 준비 체크리스트](production-readiness-checklist.md) |
| 아키텍처 다이어그램 | 제안서 첨부용 | README.md의 Architecture 섹션 |
