# Architecture Decision Records (ADR) — 아키텍처 결정 기록

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | **한국어** | [简体中文](../zh-CN/architecture-decision-records.md) | [繁體中文](../zh-TW/architecture-decision-records.md) | [Français](../fr/architecture-decision-records.md) | [Deutsch](../de/architecture-decision-records.md) | [Español](../es/architecture-decision-records.md)

**작성일**: 2026-05-23  
**상태**: 승인됨  
**대상**: 아키텍트, 기술 리드, 의사결정 경위를 이해하고자 하는 분

---

## 개요

본 문서는 Permission-aware Agentic RAG 시스템의 주요 아키텍처 의사결정과 그 근거를 기록합니다. "왜 이 구성을 선택했는가"를 설명하며, 향후 변경 판단에 참고하는 것을 목적으로 합니다.

---

## ADR-001: 벡터 스토어 — S3 Vectors를 기본 채택

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-03-29 |
| **컨텍스트** | RAG 검색의 벡터 스토어로 S3 Vectors와 OpenSearch Serverless 중 어느 것을 기본으로 할 것인가 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| S3 Vectors (채택) | 월 수 달러, 운영 제로, 원클릭 AOSS 내보내기 가능 | 콜드 쿼리: 서브초, 높은 QPS 미지원 |
| OpenSearch Serverless | 상시 50ms, 높은 QPS 지원, 전문 검색 가능 | 최소 $700/월 (2 OCU), OCU 관리 필요 |

### 결정

**S3 Vectors를 기본**으로 하고, `vectorStoreType` 파라미터로 OpenSearch Serverless로 전환 가능하게 한다.

### 근거

1. PoC / 소규모 사용에서 월 수 달러로 시작할 수 있어 도입 장벽이 낮음
2. Bedrock KB 경유 접근에서는 벡터 스토어에 의존하지 않으므로 SID 필터링 로직이 공통
3. 성능 요건이 높아지면 콘솔에서 원클릭으로 AOSS에 내보내기 가능 (약 15분)
4. S3 Vectors의 메타데이터는 모두 filterable (추가 설정 불필요)

### 영향

- 기본 배포 비용이 대폭 감소 ($700/월 → $5/월)
- 높은 QPS 환경에서는 `vectorStoreType=opensearch`로 전환 필요
- S3 Vectors의 2KB filterable metadata 제한에 주의 (PDF 메타데이터가 큰 경우)

---

## ADR-002: 권한 필터링 — 애플리케이션 측 SID 매칭

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-01-15 |
| **컨텍스트** | RAG 검색 결과의 권한 필터링을 어느 레이어에서 실시할 것인가 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| 애플리케이션 측 SID 매칭 (채택) | 벡터 스토어 비의존, LLM 바이패스 불가, Fail-Closed 구현 용이 | 검색 후 필터이므로 취득 건수 > 표시 건수 |
| 벡터 스토어 metadata filter | 검색 시 필터, 효율적 | Bedrock KB Retrieve API에서 직접 제어 불가 |
| Bedrock KB RetrieveAndGenerate | 1 API로 완결 | metadata가 반환되지 않아 SID 필터 불가능 |

### 결정

**Bedrock KB Retrieve API + 애플리케이션 측 SID 매칭 + Converse API**의 2단계 방식을 채택.

### 근거

1. RetrieveAndGenerate API는 citation의 metadata에 `allowed_group_sids`를 포함하지 않아 SID 필터링 불가능
2. 애플리케이션 측 필터링은 LLM 외부에서 실행되므로 Prompt Injection으로 바이패스 불가
3. 벡터 스토어 종류 (S3 Vectors / AOSS)에 의존하지 않는 공통 로직
4. Fail-Closed (SID 취득 실패 시 전체 거부) 구현이 명확

### 영향

- Retrieve API에서 취득한 전체 문서에 대해 필터링하므로 취득 건수를 많이 설정할 필요
- 필터링 후 문서 수가 적으면 응답 품질이 저하될 가능성
- 권한 캐시 (DynamoDB, TTL 5분)로 반복 체크를 고속화

---

## ADR-003: 인증 방식 — Cognito + 멀티 IdP 페더레이션

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-02-01 |
| **컨텍스트** | 사용자 인증 및 SID/UID/GID 취득 방식 선정 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| Cognito + SAML/OIDC/LDAP (채택) | 5 모드 지원, CDK 파라미터로 전환, Fail-Closed 대응 | Cognito 제약 (커스텀 속성 수, 토큰 크기) |
| IAM Identity Center 직접 사용 | AWS 네이티브 SSO | RAG 앱과의 통합이 복잡 |
| 커스텀 인증 (Lambda Authorizer) | 완전한 유연성 | 구현·운영 비용 큼 |

### 결정

**Cognito User Pool**을 허브로 하여 SAML (AD Federation), OIDC (Auth0/Keycloak/Okta), LDAP (OpenLDAP/FreeIPA), 이메일/비밀번호의 5 모드를 CDK 파라미터로 전환 가능하게 한다.

### 근거

1. Cognito는 CloudFront + Lambda Function URL (IAM Auth)과의 통합이 용이
2. Post-Authentication Trigger로 SID/UID/GID 자동 취득·DynamoDB 등록 가능
3. `authFailureMode=fail-closed`로 권한 취득 실패 시 로그인 차단 실현
4. 고객의 기존 IdP에 맞춰 모드를 선택할 수 있는 유연성

### 영향

- Cognito 제약 (커스텀 속성 50개, 토큰 크기 2KB)에 주의
- SAML 메타데이터 URL 관리 필요 (IdP 측 인증서 갱신 시)
- LDAP 직접 쿼리는 VPC 내 Lambda 필요

---

## ADR-004: 프론트엔드 — Lambda Web Adapter + Next.js 15

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-01-10 |
| **컨텍스트** | 웹 애플리케이션 호스팅 방식 선정 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| Lambda Web Adapter + Next.js (채택) | 서버리스, IAM Auth + OAC, 콜드 스타트 허용 | 콜드 스타트 3-5초, Docker 이미지 크기 |
| ECS Fargate | 상시 기동, 저지연 | 최소 $30/월 (상시 가동), ALB 필요 |
| Amplify Hosting | 매니지드, CI/CD 통합 | IAM Auth 미지원, 커스터마이즈 제한 |
| App Runner | 간편 배포, 자동 스케일 | IAM Auth 미지원, VPC 통합 제한 |

### 결정

**Lambda Web Adapter**로 Next.js 15를 서버리스 실행하고, CloudFront OAC + IAM Auth로 보호한다.

### 근거

1. IAM 인증 (Function URL + OAC)으로 CloudFront 이외에서의 직접 접근을 완전히 방지
2. 서버리스이므로 사용이 없는 시간대의 비용이 제로
3. CDK로 원커맨드 배포 가능 (Docker 이미지 빌드 포함)
4. Next.js 15의 App Router + Server Components로 SSR/ISR 이용 가능

### 영향

- 콜드 스타트 (3-5초)는 첫 접근 시 발생. Provisioned Concurrency로 완화 가능
- Docker 이미지 크기 최적화 필요 (멀티 스테이지 빌드)
- Apple Silicon (M1/M2/M3)에서는 프리빌드 모드 필요 (x86_64 Lambda 호환)

---

## ADR-005: 데이터 동기화 — KB Auto-Sync (폴링 방식)

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-04-15 |
| **컨텍스트** | FSx for ONTAP 상의 파일 변경을 Bedrock KB에 반영하는 방식 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| EventBridge Scheduler 폴링 (채택) | 심플, FSx 이벤트 불필요, S3 AP 호환 | 최대 15분 지연, ListObjectsV2 비용 |
| CloudTrail + EventBridge (이벤트 구동) | 니어 리얼타임 | S3 AP의 CloudTrail 대응이 제한적 |
| FSx Audit Log + EventBridge | 파일 레벨 이벤트 | 설정 복잡, 로그량 대 |
| 수동 트리거만 | 가장 심플 | 운영 부하, 동기화 누락 리스크 |

### 결정

**EventBridge Scheduler에 의한 5-15분 간격 폴링**을 기본으로 하고, 변경 감지 시에만 `StartIngestionJob`을 실행한다.

### 근거

1. FSx for ONTAP S3 Access Point는 CloudTrail 데이터 이벤트 대응이 제한적
2. ListObjectsV2 + DynamoDB 인벤토리 비교로 확실하게 변경 감지
3. IN_PROGRESS 작업의 중복 배제로 불필요한 동기화 방지
4. 3회 연속 실패 시 CloudWatch Alarm → 운영팀에 통지

### 영향

- 최대 15분의 동기화 지연 (폴링 간격에 의존)
- 대규모 환경 (100,000+ 파일)에서는 ListObjectsV2 소요 시간에 주의
- Transfer Family 경로에서는 CloudTrail 이벤트 구동 모드도 선택 가능

---

## ADR-006: Smart Routing — 3계층 모델 자동 선택

| 항목 | 내용 |
|------|------|
| **상태** | 승인됨 |
| **날짜** | 2026-05-01 |
| **컨텍스트** | 비용 최적화를 위한 모델 선택 전략 |

### 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| 3계층 자동 라우팅 (채택) | 비용 60-80% 절감, 품질 유지 | 분류 정확도에 의존, 오분류 리스크 |
| 단일 모델 고정 | 심플, 예측 가능 | 비용 비효율 또는 품질 부족 |
| 사용자 수동 선택 | 사용자 제어 | UX 악화, 비용 관리 곤란 |

### 결정

쿼리 복잡도에 기반한 **3계층 자동 라우팅** (Simple → Haiku, Complex → Sonnet, Full-context → Opus)을 기본으로 하고, 수동 선택 옵션도 제공한다.

### 근거

1. 엔터프라이즈 RAG에서 질문의 60% 이상이 간단한 사실 확인 (Haiku로 충분)
2. 가중 평균 비용 ~$0.014/query는 전부 Sonnet의 ~$0.01과 비교하여 품질 향상하면서 비용 동등
3. CloudWatch EMF 메트릭으로 라우팅 분포를 가시화하고 임계값 조정 가능
4. 폴백 메커니즘 (모델 불가 시 다음 티어로 자동 전환)으로 가용성 확보

### 영향

- 분류기의 정확도가 비용과 품질에 직결 (정기적인 임계값 튜닝 권장)
- Opus 사용 시 비용 스파이크에 주의 (일일 비용 상한 설정 권장)
- Smart Routing OFF 시 기존대로 단일 모델 고정

---

## 관련 문서

| 문서 | 관련 ADR |
|------|---------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
