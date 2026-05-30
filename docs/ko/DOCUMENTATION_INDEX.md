# 문서 색인

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | **한국어** | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 필수 문서

| 문서 | 설명 |
|------|------|
| [README.md](../../README.ko.md) | 시스템 개요, 아키텍처, 배포 단계, WAF/Geo 설정 |
| [auth-and-user-management.md](auth-and-user-management.md) | 인증 및 사용자 관리 가이드 (인증 모드 선택, AD Federation, 자동 SID 등록, 문제 해결) |
| [implementation-overview.md](implementation-overview.md) | 상세 구현 (22가지 측면: 이미지 분석 RAG, KB 연결 UI, Smart Routing, 모니터링 및 알림, OIDC/LDAP Federation) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 기반 권한 필터링 상세 설계 |
| [verification-report.md](verification-report.md) | 배포 후 검증 절차 및 테스트 케이스 |
| [ui-specification.md](ui-specification.md) | Chatbot UI 사양 (KB/Agent 모드, Agent Directory, 엔터프라이즈 Agent 기능, 사이드바 설계) |
| [demo-recording-guide.md](demo-recording-guide.md) | 데모 영상 녹화 가이드 (6개 증거 항목) |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 서버 설계 및 구현 문서 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | CDK 스택 아키텍처 가이드 (벡터 스토어 비교, 구현 인사이트) |
| [README - AD SAML Federation](../../README.ko.md#ad-saml-federation-optional) | AD SAML federation 설정 (Managed AD / Self-managed AD) |

## 설정 및 검증

| 문서 | 설명 |
|------|------|
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | 인증 모드별 데모 환경 구축 가이드 (5가지 모드, 샘플 구성 파일 포함) |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 검증 시나리오 (관리자 vs. 일반 사용자 권한 차이, AD SSO 로그인, OIDC/LDAP 로그인) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD 통합, CIFS 공유, NTFS ACL 구성, Name-Mapping 설정 (검증된 절차) |
| [demo-environment-guide.md](demo-environment-guide.md) | 검증 환경 리소스 ID, 접속 정보, Embedding 서버 절차 |

## 엔터프라이즈 설계 및 운영 가이드

| 문서 | 설명 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 프로덕션 준비 체크리스트 (Demo → PoC → Production 성숙도 레벨 정의, 보안/감사/DR/운영 확인 항목) |
| [permission-consistency.md](permission-consistency.md) | 권한 변경 일관성 모델 (ACL 변경 → 메타데이터 재생성 → KB 재동기화 → 캐시 무효화 흐름, 최대 지연, 긴급 권한 박탈 절차) |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 성능 및 용량 설계 가이드 (규모별 구성, S3 AP 고려사항, QoS, 벡터 스토어 선정) |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 멀티테넌트 및 파트너 배포 패턴 (계정 분리/SVM 분리/하이브리드, 비용 추정 템플릿) |
| [governance-and-audit.md](governance-and-audit.md) | 거버넌스 및 감사 설계 (감사 로그 스키마, Responsible AI, Guardrails 정책, 업종별 사용 사례) |
| [evaluation.md](evaluation.md) | RAG / Agent 평가 메트릭 (4축 평가: 비즈니스 KPI, RAG 품질, 권한 제어, Agent 성능; PoC 평가 템플릿) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 안전한 실험 가이드 (범위 정의, 금지 사항, 실제 데이터 투입 체크리스트, 롤백 절차) |
| [threat-model.md](threat-model.md) | 위협 모델 (10개 위협 카테고리, 공격 경로, 기존 완화 조치, 추가 권장 사항, 위협→대책 매핑 표) |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch 대시보드 운영 가이드 (메트릭 목록, 알람 정의, 문제 해결 패턴) |
| [poc-workshop-guide.md](poc-workshop-guide.md) | PoC 워크숍 가이드 (90분: 배포 → 테스트 → 평가 → 정리) |
| [tests/permission-matrix/](../../tests/permission-matrix/) | 권한 매트릭스 테스트 (ACL 엣지 케이스 31개 시나리오: Fail-Closed, 그룹 중첩, 상속 권한, 긴급 박탈) |

## FSx for ONTAP 운영 자동화

| 문서 | 설명 |
|------|------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | 운영 자동화 스위트 개요 (디렉토리 구조, 사용 사례) |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | 이 아키텍처가 FSx for ONTAP 운영을 단순화하는 이유 (설계 결정, 비용 추정, 보안 설계) |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | AWS 통합 검증 보고서 (2026-05-01, 모든 단계 통과) |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | 통합 CloudFormation 템플릿 (VPC 엔드포인트 포함) |

## 샘플 구성 파일

| 파일 | 인증 모드 | 설명 |
|------|-----------|------|
| `demo-data/configs/mode-a-email-password.json` | 이메일/비밀번호 | 최소 구성, 수동 SID 등록 |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0 (LDAP 없음) |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP 동시 활성화 |

## Embedding 서버 (FlexCache CIFS 마운트 경유)

| 문서 / 파일 | 설명 |
|-------------|------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Embedding 서버 배포 및 운영 절차 |
| `docker/embed/src/index.ts` | Embedding 앱 (문서 스캔 → 청크 분할 → 벡터화 → 인덱싱) |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4 서명 클라이언트 (IMDS 인증 지원) |
| `docker/embed/Dockerfile` | Embedding 컨테이너 정의 (node:22-slim, cifs-utils) |
| `docker/embed/buildspec.yml` | CodeBuild 빌드 정의 |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK 정의 (EC2 + ECR + IAM) |

## 설정 스크립트

| 스크립트 | 설명 |
|----------|------|
| `demo-data/scripts/create-demo-users.sh` | Cognito 테스트 사용자 생성 |
| `demo-data/scripts/setup-user-access.sh` | DynamoDB에 SID 데이터 등록 |
| `demo-data/scripts/upload-demo-data.sh` | S3에 테스트 문서 업로드 |
| `demo-data/scripts/sync-kb-datasource.sh` | Bedrock KB 데이터 소스 동기화 |
| `demo-data/scripts/setup-openldap.sh` | OpenLDAP 서버 설정 (VPC 내 EC2, 테스트 사용자/그룹) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mapping 규칙 설정 |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP 통합 검증 (Lambda → LDAP → DynamoDB) |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping 검증 (REST API 연결 및 규칙 조회) |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | 모드 C (OIDC+LDAP) 원샷 설정 (전체 Phase 자동 실행) |

## 권장 읽기 순서

### 1단계: 초기 설정

1. **README.md** — 시스템 개요 및 배포 단계
2. **auth-and-user-management.md** — 인증 모드 선택 및 사용자 관리
3. **implementation-overview.md** — 22가지 측면의 상세 구현
4. **SID-Filtering-Architecture.md** — 핵심 기능 기술 상세
5. **safe-experimentation-guide.md** — 안전한 실험 가이드 (PoC 시작 전 필독)

### 2단계: 검증 및 평가

6. **demo-recording-guide.md** — 데모 영상 녹화 가이드
7. **ontap-setup-guide.md** — FSx for ONTAP AD 통합, CIFS 공유 설정
8. **demo-environment-guide.md** — 검증 환경 설정
9. **demo-scenario.md** — 검증 시나리오 실행
10. **evaluation.md** — PoC 평가 템플릿

### 3단계: 프로덕션 및 엔터프라이즈 설계

11. **production-readiness-checklist.md** — 프로덕션 준비 체크리스트
12. **permission-consistency.md** — 권한 변경 일관성 모델
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP 성능 및 용량 설계
14. **governance-and-audit.md** — 거버넌스 및 감사 설계
15. **partner-deployment-patterns.md** — 멀티테넌트 배포 패턴
