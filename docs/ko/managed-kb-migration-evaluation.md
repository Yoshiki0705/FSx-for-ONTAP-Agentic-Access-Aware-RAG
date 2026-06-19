# Amazon Bedrock Managed Knowledge Base 마이그레이션 경로 검토

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | **한국어** | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | [Français](../fr/managed-kb-migration-evaluation.md) | [Deutsch](../de/managed-kb-migration-evaluation.md) | [Español](../es/managed-kb-migration-evaluation.md)

**작성일**: 2026-06-18
**대상 리전**: ap-northeast-1 (도쿄) — Managed KB는 도쿄 리전에서 사용 가능
**상태**: 검토 문서 (마이그레이션 미실시 / 기존 경로 유지)
**관련**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md` (연계 출처)

---

## 0. 이 문서의 위치

본 문서는 AWS Summit New York 2026 (2026-06-17)에서 GA된 [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)를, 본 리포지토리의 기존 Permission-aware RAG 구성(Bedrock KB + OpenSearch Serverless / S3 Vectors)으로 업그레이드할 때의 **마이그레이션 경로 검토**를 정리한 것입니다.

주요 전제:

- 본 문서는 **검토 자료**이며, 즉시 마이그레이션을 권장하는 것이 아닙니다.
- 기존 경로(Bedrock KB + OpenSearch Serverless / S3 Vectors)는 **삭제하지 않습니다**.
- 기재 내용은 다음 2개의 증거 계층으로 분류합니다.

| 계층 | 정의 | 본 문서에서의 취급 |
|------|------|------------------|
| Public evidence | AWS 공식 문서·블로그에서 검증 가능 | 출처 링크와 함께 기재 |
| Project-context expectation | 본 프로젝트 내의 설계 판단·기대값(공개 검증 불가) | "본 프로젝트의 상정"으로 명시 |

> ⚠️ **Distinction discipline**: "샘플 기능의 일반 설명"과 "본 프로젝트에서 검증된 동작"을 명확히 구별합니다. Managed KB의 기능 기술은 AWS 공개 정보에 기반한 일반 설명이며, 본 프로젝트에서의 ACL 연계 동작은 **미검증**입니다(후술하는 검증 포인트 참조).

---

## 1. Managed KB의 주요 기능 (Public evidence)

[Introducing Amazon Bedrock Managed Knowledge Base 블로그](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) 및 [GA 발표](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)에 기반합니다. 라이선스 준수를 위해 출처의 취지를 유지하면서 요약·재구성했습니다.

| 기능 | 개요 | 본 프로젝트와의 관련 |
|------|------|----------------------|
| 6개 네이티브 데이터 커넥터 | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler. 데이터와 권한을 자동 수집 | **S3 커넥터**가 FSx for ONTAP S3 Access Point에 연결할 수 있는지가 관건 |
| Smart Parsing | 데이터 유형·커넥터별로 최적의 파싱 전략을 자동 선택(PDF·Office·테이블·멀티모달) | 기존의 수동 청킹 전략 선택을 자동화할 가능성 |
| Agentic Retriever | 복잡한 쿼리를 서브쿼리로 분해하여 멀티홉 검색을 반복 실행 | Permission-aware 맥락에서 재인가가 필요(후술) |
| 관리형 벡터 스토리지 | 벡터 DB 프로비저닝 불필요. 가격 대비 성능 최적화됨 | OpenSearch Serverless / S3 Vectors의 운영 부하가 불필요 |
| AgentCore Gateway 통합 | 빌트인 connector target(MCP)으로 공개. `Retrieve`와 `AgenticRetrieveStream` 2개 툴 | 본 프로젝트의 AgentCore Gateway(구현 완료)와 통합 가능 |
| 기존 API 호환 | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` 등은 동일 | KB ID 변경만으로 코드 변경 불필요(AWS 주장, 요검증) |
| 리전 | 도쿄 포함 여러 리전에서 GA | ap-northeast-1 배포와 정합 |

### 가격 모델 (Public evidence)

[AWS의 설명](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/)에 따르면, 과금은 2축(인덱싱된 데이터 크기 + 검색 횟수의 온디맨드)입니다. 사전 약정 없음.

> ⚠️ **비용 견적 주의**: 위는 공개된 가격 모델의 구조이며, 본 프로젝트의 워크로드에서의 실제 비용은 미측정입니다. 마이그레이션 판단 전에 "현행(OpenSearch Serverless OCU / S3 Vectors 스토리지)"과 "Managed KB(데이터 크기 + 검색 횟수)"의 단가 비교를 상정 쿼리량·데이터량으로 실시하십시오.

---

## 2. 기존 구성과의 비교

### 2.1 아키텍처 비교

| 관점 | 현행 (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|------|--------------------------------------------------------------|------------|
| 벡터 스토어 운영 | 자체 관리 (AOSS의 OCU 설계 / S3 Vectors index 관리) | 완전 관리형 (프로비저닝 불필요) |
| 데이터 소스 | FSx ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | S3 커넥터 경유 (S3 AP 연결은 요검증) |
| 파싱·청킹 | `kbChunkingStrategy`로 수동 선택 (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing이 자동 선택 (커스터마이즈 가능) |
| 임베딩 모델 | 배포 시 고정 (`embeddingModel`, 재생성으로 변경) | 기본 자동 선택 + 임의로 Bedrock 모델 지정 |
| 검색 | 단일 Retrieve + 앱 측 SID 필터 | `Retrieve`(단일 하이브리드) + `AgenticRetrieveStream`(멀티홉) |
| ACL 필터 | 앱 측에서 `allowed_group_sids` 대조 (벡터 스토어 비의존) | 메타데이터 `filter` 연산자 + `userContext` (요검증) |
| Gateway 통합 | 커스텀 (구현 완료된 AgentCore Gateway + Permission Interceptor) | 빌트인 connector target |
| 운영 부하 | 중 (벡터 스토어·파이프라인 설계 필요) | 낮음 (관리형) |
| 커스터마이즈성 | 높음 (모든 컴포넌트 제어 가능) | 중 (관리형 범위 내에서 조정) |

### 2.2 기존 시스템의 SID 필터링 방식 (Project-context)

본 프로젝트는 [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md)와 같이, 다음의 벡터 스토어 비의존 방식을 채택하고 있습니다.

```
Bedrock KB Retrieve API → 검색 결과 + 메타데이터(allowed_group_sids)
→ 앱 측(route.ts)에서 사용자SID ∩ 문서SID 대조
→ 일치한 문서만 Converse API로
→ Fail-Closed: SID 취득 불가 시 전체 거부
```

이 방식의 강점은 벡터 스토어(AOSS / S3 Vectors)를 바꿔도 **앱 측 인가 로직이 불변**이라는 점입니다. Managed KB로의 마이그레이션에서도 이 불변 조건을 유지할 수 있는지가 가장 중요한 논점입니다.

---

## 3. 마이그레이션 판단 기준

"경쟁 제품의 치환"이 아니라 "용도에 따른 선택(right tool for the job)"으로 정리합니다. 양 구성의 트레이드오프를 대칭적으로 기재합니다.

### 3.1 Managed KB로 마이그레이션을 검토해야 할 경우

- 벡터 스토어(OpenSearch Serverless OCU / S3 Vectors index)의 **운영·설계 부하를 낮추고 싶다**
- Smart Parsing에 의한 **다형식 문서(PDF·Office·테이블)의 자동 파싱**을 활용하고 싶다
- Agentic Retriever에 의한 **멀티홉·복잡 쿼리**의 정확도 향상을 원한다
- 새로운 임베딩·리랭크 모델로 **인프라 재구축 없이 추종**하고 싶다
- AgentCore Gateway 중심 아키텍처에 통합하여 **빌트인 connector target**으로 연결을 간소화하고 싶다

### 3.2 현행 구성을 유지해야 할 경우

- **파일 레벨 ACL(NTFS / SID)을 검색 시 엄격히 적용하는 요건**이 있고, `allowed_group_sids` 대조의 동작을 완전히 제어하고 싶다
- 권한 변경·삭제·이름 변경의 **즉시 반영 로직을 독자 구현**하고 있다(Managed의 관리형 동기화로 동등하게 유지할 수 있는지 미검증)
- 벡터 스토어의 **filter / ranking / reranking을 세밀하게 제어**하고 싶다
- 관리형 스토리지에서의 **ACL 메타데이터 보존·필터가 미검증**인 단계에서, 프로덕션의 Fail-Closed 보증을 무너뜨리고 싶지 않다
- 데이터 주권·감사 요건으로 **벡터 데이터의 저장 위치를 명시적으로 관리**할 필요가 있다

### 3.3 판단 흐름

```
ACL을 검색 시 엄격히 적용할 필요가 있는가?
├─ YES → §4의 검증 포인트를 모두 클리어할 수 있는가?
│        ├─ YES → 단계적 마이그레이션을 검토 (§5)
│        └─ NO  → 현행 구성 유지 (ACL 보증을 우선)
└─ NO  → 운영 부하·정확도를 중시하여 Managed KB를 우선 검토
```

> ⚠️ 본 프로젝트의 주목적은 **Permission-aware RAG**이며, ACL 엄격 적용은 양보할 수 없는 요건입니다. 따라서 §4의 검증을 클리어하지 않는 한, 현행 구성의 유지가 기본 방침이 됩니다.

---

## 4. Permission-aware RAG로의 영향 (최중요)

Managed KB의 관리형 스토리지에서 본 프로젝트의 SID 기반 ACL 필터를 유지할 수 있는가. Public evidence와 검증 포인트를 정리합니다.

### 4.1 Public evidence: Managed KB의 액세스 제어 수단

[AgentCore Gateway connector target 문서](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)에 따르면, Managed KB는 2개의 액세스 제어 수단을 가집니다.

**(A) 메타데이터 `filter` 연산자 (`Retrieve` 툴)**

`managedSearchConfiguration.filter`에서 다음 연산자를 사용 가능(출처의 취지를 요약):
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains`가 `allowed_group_sids`(배열)에 대한 사용자 SID 대조에 사용될 가능성이 있습니다**. 이는 현행의 앱 측 대조를 검색 계층으로 밀어넣는 설계로 이어집니다.

**(B) `userContext`에 의한 액세스 제어 필터**

문서에 따르면, KB가 사용자/그룹 단위의 액세스 제어를 수행할 경우, 호출 애플리케이션이 `userContext`(예: `userId`)를 요청에 포함합니다. Gateway는 이를 KB로 전달하고, KB가 `userContext`에 기반하여 필터를 적용합니다. 중요한 점으로, **Gateway는 호출자의 IAM 아이덴티티에서 `userContext`를 자동 보완하지 않습니다. 애플리케이션이 명시적으로 전달해야 합니다**. 또한 **`userContext`는 모델이 아니라 애플리케이션이 부여**한다고 명기되어 있습니다.

→ 이 "애플리케이션이 명시적으로 부여" "모델에 맡기지 않음"이라는 설계는, 본 프로젝트의 **Fail-Closed·앱 강제** 원칙과 방향성이 일치합니다.

### 4.2 검증 포인트 (마이그레이션 전 반드시 확인)

다음은 모두 **미검증**이며, 마이그레이션 가부를 좌우합니다. Project-context의 상정을 병기합니다.

| # | 검증 항목 | 본 프로젝트의 상정 | 리스크 |
|---|----------|-------------------|--------|
| V1 | S3 커넥터가 **FSx ONTAP S3 Access Point**를 데이터 소스로 할 수 있는가(alias 형식·IAM 경계) | S3 호환이면 연결 가능하다고 상정 | 연결 불가 시 마이그레이션 자체가 불성립 |
| V2 | `.metadata.json`의 `allowed_group_sids`가 Managed KB 인덱스에 **메타데이터로 보존**되는가 | 보존된다고 상정 | 보존되지 않으면 ACL 필터 불가 |
| V3 | `Retrieve`의 `filter`에서 **`listContains`에 의한 SID 배열 대조**가 기능하는가 | 기능한다고 상정 | 기능하지 않으면 userContext 방식으로 전환 |
| V4 | `userContext` 방식이 **S3 커넥터 수집 데이터**에서도 유효한가(SaaS 커넥터 전제가 아닌가) | S3에서도 유효한지 불명 | S3에서 무효이면 filter 방식에 의존 |
| V5 | **`AgenticRetrieveStream`(멀티홉)의 각 스텝**에서 ACL 필터가 적용되는가 | 각 스텝 적용이 필요 | 중간 스텝에서 권한 외 데이터가 혼입되는 리스크 |
| V6 | 관리형 스토리지에서 **권한 변경·삭제·이름 변경의 반영 지연**이 허용 범위인가 | 기존과 동일한 즉시성을 기대 | 반영 지연으로 구 권한 데이터가 남는 리스크 |
| V7 | 대화 이력·캐시로의 **ACL 적용**이 유지되는가 | 앱 측에서 유지 | Managed 측 캐시의 동작이 불명 |

> ⚠️ **양보 불가**: V2, V3(또는 V4), V5 중 하나라도 미달이면, **권한 외 데이터가 검색 결과에 혼입될 가능성**이 있으므로 마이그레이션은 **BLOCKED**입니다. 이는 FSxN AI/RAG 아키텍처 리뷰의 양보 불가 요건("권한 외 데이터가 vector search 결과에 혼입될 가능성이 있는 설계", "LLM에 전달하는 context의 인가 체크가 없는 설계")에 위반됩니다.

### 4.3 다층 방어 유지

마이그레이션 시에도 단일 수단에 의존하지 않고 다층 방어를 유지합니다.

```
1. IdP / Cognito / AD에 의한 사용자 인증
2. 사용자 principal / 그룹 SID 취득 (DynamoDB user-access)
3. Managed KB 검색 시의 filter (listContains) 또는 userContext
4. ★ LLM context 주입 직전의 앱 측 ACL 재대조 (현행 route.ts 로직 유지) ★
5. AgenticRetrieveStream 사용 시 각 스텝 후 재인가
6. 인용 출처 링크 표시 시 재인가
7. 감사 로그 (누가 언제 어떤 SID 유래 정보를 사용했는가)
```

→ Managed KB 측 필터를 사용하더라도, **스텝 4(앱 측 최종 ACL 대조)를 유지할 것을 강력히 권장**합니다. 이로써 관리형 측 필터가 예상과 다르게 동작하더라도 Fail-Closed를 보증합니다.

---

## 5. 마이그레이션 경로 (단계적 / 기존 경로 유지)

기존의 Dual KB 마이그레이션 패턴([migration-guide-multimodal.md](../en/migration-guide-multimodal.md))과 마찬가지로, **병렬 운영**으로 단계적으로 검증합니다. 기존 경로는 삭제하지 않습니다.

### Phase 0: PoC 검증 (프로덕션 비영향)

1. 소규모 검증용 데이터셋으로 Managed KB를 작성(Snapshot / FlexClone에서의 일관된 데이터 권장)
2. §4.2의 V1~V7을 순서대로 검증
3. [tests/permission-matrix/](../../tests/permission-matrix/)의 31개 시나리오에 대해 SID 필터링(filter / userContext)의 동작을 확인

### Phase 1: 병렬 운영 (Shadow)

1. 기존 KB를 유지하고 Managed KB를 **읽기 전용 shadow**로 병렬 운영
2. 동일 쿼리를 양 시스템으로 보내 검색 결과·ACL 필터 결과·인용 정합성을 비교
3. RAGAS 등으로 정확도·citation precision을 비교([evaluation.md](evaluation.md))

### Phase 2: 단계적 마이그레이션 (Canary)

1. AgentCore Gateway A/B 테스트(AgentCore Optimization — 본 리포지토리에서 구현 완료)로 트래픽의 일부를 Managed KB 경로로 라우팅
2. 모든 권한 테스트(Fail-Closed, 그룹 중첩, ACL 엣지 케이스)가 통과하는지 확인
3. 통계적 유의성을 확인 후 점진적으로 트래픽 이행

### Phase 3: 컷오버 판단

- 모든 검증 클리어 → Managed KB를 기본 경로로
- 미달 항목 있음 → 현행 구성 유지, Managed KB는 shadow 유지 또는 철회

> 마이그레이션 완료 후에도 기존 경로(Bedrock KB + OpenSearch Serverless / S3 Vectors)를 **일정 기간 롤백 경로**로 유지할 것을 권장합니다.

---

## 6. 검증 체크리스트

마이그레이션 판단 전에 다음을 모두 클리어하십시오.

### 데이터 기반
- [ ] V1: S3 커넥터가 FSx ONTAP S3 AP를 데이터 소스로 등록 가능
- [ ] Snapshot / FlexClone에서의 일관된 데이터로 PoC 실시
- [ ] 프로덕션 데이터를 직접 무거운 크롤링 대상으로 하지 않음

### Permission-aware RAG (최중요)
- [ ] V2: `allowed_group_sids`가 메타데이터로 보존됨
- [ ] V3 또는 V4: `listContains` filter 또는 `userContext`로 SID 필터가 기능
- [ ] V5: AgenticRetrieveStream의 각 스텝에서 ACL이 적용됨
- [ ] 다층 방어 스텝 4(앱 측 최종 대조)를 유지
- [ ] Fail-Closed: SID 취득 불가 시 전체 거부
- [ ] 31개 권한 테스트 시나리오가 모두 통과

### 데이터 라이프사이클
- [ ] V6: 권한 변경·삭제·이름 변경의 반영 지연이 허용 범위 내
- [ ] V7: 대화 이력·캐시에 ACL이 적용됨

### 비용·성능
- [ ] 현행 vs Managed KB의 단가 비교를 실시(데이터 크기 + 검색 횟수)
- [ ] 상정 쿼리량에서의 월액 견적을 작성

### 운영
- [ ] 롤백 절차(기존 경로로의 복귀)를 runbook화
- [ ] 감사 로그로 이용 이력을 추적 가능

---

## 7. 권장 판정

**현시점의 판정: REQUEST CHANGES (검증 완료까지 마이그레이션 보류)**

해제 조건:

1. §4.2의 검증 포인트 V1~V7을 PoC로 확인
2. 특히 **V2·V3(또는 V4)·V5**를 클리어(미달이면 BLOCKED)
3. 다층 방어 스텝 4(앱 측 최종 ACL 대조)를 유지하는 설계일 것
4. 비용 단가 비교에서 현행보다 불리하지 않거나, 운영 부하 절감이 비용 증가를 상회한다고 판단할 수 있을 것

**판정의 근거:**

- Managed KB의 운영 부하 절감·Smart Parsing·Agentic Retriever는 본 프로젝트에 명확한 가치가 있습니다(Public evidence).
- 한편, 본 프로젝트의 **최우선 요건은 Permission-aware RAG의 ACL 엄격 적용**이며, 관리형 스토리지에서의 SID 필터 동작은 **미검증**입니다.
- `userContext`(앱 명시 부여·모델 비의존)와 `listContains` filter는 방향성이 일치하므로, **검증 여하에 따라 마이그레이션은 충분히 현실적**입니다.

> 본 문서는 검토 자료입니다. 실제 마이그레이션은 위 검증을 거쳐 관련 리뷰(FSxN AI/RAG 아키텍처 리뷰)의 승인을 얻은 후 실시하십시오.

---

## 관련 문서

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Managed KB 검증 절차(S3 AP 연결 검증 / FlexClone 안전 검증 패턴)
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — SID 필터링의 기본 설계
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID 통합
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — 기존 스택 구성과 KB 쿼터
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids` 메타데이터 스키마
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Dual KB 단계적 마이그레이션의 참고 패턴(영문)
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — 현행 청킹 전략
- [evaluation.md](evaluation.md) — RAG 평가 방법
