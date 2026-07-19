# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | **한국어** | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

> FSx for ONTAP에 저장된 기업 데이터에 대해 NTFS ACL / UNIX 권한을 쿼리 시점에 자동 적용하는 Permission-aware RAG + Agentic AI 레퍼런스 구현입니다. AWS CDK 단일 명령 배포. PoC부터 프로덕션 평가까지 지원합니다.

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
- **Permission-aware RAG** — NTFS ACL / UNIX 권한을 검색 시점에 자동 적용 (Fail-Closed)
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
