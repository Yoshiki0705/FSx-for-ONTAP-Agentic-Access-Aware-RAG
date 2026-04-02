# 문서 색인

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | **한국어** | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 필수 문서

| 문서 | 설명 |
|------|------|
| [README.md](../../README.ko.md) | 시스템 개요, 아키텍처, 배포 단계, WAF/Geo 설정 |
| [implementation-overview.md](implementation-overview.md) | 상세 구현 (12가지 측면: 이미지 분석 RAG, KB 연결 UI, Smart Routing, 모니터링 및 알림) |
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
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 검증 시나리오 (관리자 vs. 일반 사용자 권한 차이, AD SSO 로그인) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD 통합, CIFS 공유, NTFS ACL 구성 (검증된 절차) |
| [demo-environment-guide.md](demo-environment-guide.md) | 검증 환경 리소스 ID, 접속 정보, Embedding 서버 절차 |

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

## 권장 읽기 순서

1. **README.md** — 시스템 개요 및 배포 단계
2. **implementation-overview.md** — 8가지 측면의 상세 구현
3. **SID-Filtering-Architecture.md** — 핵심 기능 기술 상세
4. **demo-recording-guide.md** — 데모 영상 녹화 가이드
5. **ontap-setup-guide.md** — FSx ONTAP AD 통합, CIFS 공유 설정
6. **README.md - AD SAML Federation** — AD SAML federation 설정 (선택 사항)
7. **demo-environment-guide.md** — 검증 환경 설정 (Embedding 서버 포함)
8. **demo-scenario.md** — 검증 시나리오 실행 (AD SSO 로그인)
9. **verification-report.md** — API 수준 검증 절차
