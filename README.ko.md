# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | **한국어** | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

> FSx for ONTAP에 저장된 기업 데이터에 대해 문서별 권한 메타데이터와 호출자의 SID / UID・GID를 검색 시점에 대조하는 Permission-aware RAG + Agentic AI 레퍼런스 구현입니다. AWS CDK 단일 명령 배포. PoC부터 프로덕션 평가까지 지원합니다.

---

## 시작하기

| 하고 싶은 것 | 가이드 | 소요 시간 |
|-------------|--------|----------|
| 빠르게 체험하기 | [PoC 워크숍 가이드](docs/ko/poc-workshop-guide.md) | 90분 |
| 내 계정에 배포하기 | [배포 가이드](docs/deployment-guide.md) | 30-40분 |
| 실제 데이터로 검증하기 | [안전한 실험 가이드](docs/ko/safe-experimentation-guide.md) | 2-4주 |
| 정확도/비용 평가하기 | [RAG/Agent 평가 프레임워크](docs/ko/evaluation.md) | 1주 |
| 프로덕션 준비도 확인하기 | [프로덕션 준비 체크리스트](docs/ko/production-readiness-checklist.md) | — |
| 비용 추정하기 | [비용 추정 워크시트](docs/ko/cost-estimation-worksheet.md) | — |

## 오기 전에 결정할 것 / 여기서 다루지 않는 것

이 리포지토리는 **구현과 실측**을 다룹니다. FSx for ONTAP를 채택할지, S3 Access Point로 데이터를 노출할지, 권한을 어느 계층에서 가질지에 대한 **판단**은 [FSx for ONTAP Adoption Playbook](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook) 쪽에 있습니다.

| 먼저 결정할 것 | 판단 근거 |
|--------------|---------|
| FSx for ONTAP가 과제에 맞는지(맞지 않는 조건 포함) | [결정 트리](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/reference/decision-trees) |
| S3 Access Point로 데이터를 노출하는 전제와 제약(동일 계정·동일 리전, 모든 요청이 하나의 ID로 인가되는 성질) | [data-utilization 도메인](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) |
| 인가가 어느 계층에서 성립하는지, 감사 로그에 무엇이 남는지 | [security-governance 도메인](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/security-governance) |
| NFS / SMB 공존과 Active Directory ID 설계 | [multiprotocol-identity 도메인](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/multiprotocol-identity) |

**여기서 다루지 않는 것**: 스토리지 선정, 마이그레이션 방식, 블록 스토리지·성능·비용 설계. 모두 Playbook 쪽입니다.

**여기서 다루는 것**: 문서별 권한 메타데이터를 인덱스로 보유하고 검색 시점에 호출자의 SID / UID・GID와 대조하는 RAG 구현(Amazon Bedrock + AWS CDK), 배포 및 운영 절차, 이 구성에서의 실측. **원본 파일의 ACL은 S3 Access Point를 경유하는 경로에서 최종 사용자의 인가로 이어지지 않으므로, 권한은 별도의 인덱스로 유지합니다**([권한 메타데이터 변경 일관성 모델](docs/ko/permission-consistency.md)).

<details><summary>📂 전체 기능 및 설계 가이드 목록</summary>

| 카테고리 | 가이드 | 내용 |
|---------|--------|------|
| 아키텍처 | [구현 개요 (22개 관점)](docs/ko/implementation-overview.md) | 전 컴포넌트 기술 상세 |
| 아키텍처 | [Architecture Decision Records](docs/ko/architecture-decision-records.md) | 6개 주요 설계 결정 근거 |
| 권한 제어 | [SID 필터링 아키텍처](docs/ko/SID-Filtering-Architecture.md) | 권한 매칭 구조 |
| 인증 | [인증 및 사용자 관리](docs/ko/auth-and-user-management.md) | OIDC / SAML / LDAP 연동 |
| 보안 | [위협 모델](docs/ko/threat-model.md) | 10개 위협 카테고리, 공격 경로, 완화 조치 |
| 보안 | [거버넌스 및 감사 설계](docs/ko/governance-and-audit.md) | 감사 로그, Responsible AI, Guardrails |
| 데모 | [업종별 데모 데이터 (7개 업종)](demo-data/industry-packs/) | 행정・의료・법무・제조・건설・교육・보험 |
| 전체 문서 | [문서 인덱스](docs/ko/DOCUMENTATION_INDEX.md) | 권장 읽기 순서 포함 전체 목록 |

</details>

---

## 아키텍처

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (인증: OIDC/SAML/Email)    (RAG 검색 + Embedding)       (SID/권한 데이터)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**처리 흐름**: 사용자 인증 → DynamoDB에서 SID 조회 → Bedrock KB 벡터 검색 → SID 매칭 필터 → 허가된 문서만으로 응답 생성

주요 특징:
- **Permission-aware RAG** — 문서의 권한 메타데이터와 호출자의 SID / UID・GID를 검색 시점에 대조 (Fail-Closed)
- **Agentic AI** — KB 모드(문서 검색)와 Agent 모드(다단계 추론)를 원클릭 전환
- **Smart Routing** — 쿼리 복잡도에 따라 Haiku / Sonnet / Opus 자동 선택 (비용 40-60% 절감)
- **저비용** — S3 Vectors (월 수 달러)를 기본 채택
- **22개 통합 기능** — 음성 채팅, Guardrails, Graph RAG, Web Search 등 ([상세](docs/ko/implementation-overview.md))

<details><summary>⚠️ 전제 조건 및 제약 사항</summary>

| 항목 | 내용 |
|------|------|
| 전제 환경 | Node.js 22+, Docker, AWS CLI 구성 완료, AdministratorAccess 상당 |
| 배포 리전 | ap-northeast-1 (변경 가능) + us-east-1 (WAF/Web Search용, 고정) |
| ONTAP 버전 | 9.17.1 이상 (S3 Access Points 요건) |
| S3 AP 주요 제약 | 조건부 쓰기 미지원, Event Notifications 미지원, ListObjectsV2 높은 레이턴시 |
| 벡터 스토어 | S3 Vectors (기본, filterable 2KB 제한) / OpenSearch Serverless (고성능) |
| Responsible AI | AI 출력은 보조 신호. 최종 판단은 사람의 책임. [상세](docs/ko/governance-and-audit.md) |

S3 AP 포괄적 호환성 매트릭스는 [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)를 참조하세요.

</details>

<details><summary>📚 관련 리포지토리</summary>

| 리포지토리 | 용도 | 개요 |
|-----------|------|------|
| **[본 리포지토리]** | AI / RAG | 권한 필터링 RAG + Agentic AI |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless 자동화 | 17개 업종별 서버리스 패턴 |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Athena / Glue / EMR / SageMaker 통합 |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability | 감사 로그를 Datadog / Splunk / Grafana로 EC2 없이 전달 |
| [FSx-for-ONTAP-Adoption-Playbook — data-utilization](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) | 도입 판단 | 데이터 활용 도메인 허브: S3 AP 인가 특성 · 제약 · 설계 선택지 |

</details>

<details><summary>🔧 개발자용</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

프로젝트 구조와 코딩 규약은 [CONTRIBUTING.md](CONTRIBUTING.md)를, 변경 이력은 [CHANGELOG.md](CHANGELOG.md)를 참조하세요.

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)
