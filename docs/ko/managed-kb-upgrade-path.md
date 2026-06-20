# Amazon Bedrock Managed Knowledge Base 업그레이드 경로 (검증 절차)

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | **한국어** | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | [Français](../fr/managed-kb-upgrade-path.md) | [Deutsch](../de/managed-kb-upgrade-path.md) | [Español](../es/managed-kb-upgrade-path.md)

**작성일**: 2026-06-18
**대상 리전**: ap-northeast-1 (도쿄) — Managed KB는 도쿄 리전에서 사용 가능 (2026-06-17 GA)
**상태**: 검증 절차 문서 (마이그레이션 미실시 / 기존 경로 유지)
**관련**: [Managed KB 마이그레이션 검토](managed-kb-migration-evaluation.md) (판단 기준 / 트레이드오프)

---

## 0. 이 문서의 위치

본 문서는 [Managed KB 마이그레이션 검토](managed-kb-migration-evaluation.md)에서 정리한 검증 포인트를 **실행 가능한 검증 절차**로 구체화한 것입니다. 판단 기준·트레이드오프의 논의는 마이그레이션 검토 문서를 참조하고, 본 문서는 "어떻게 검증하는가"에 초점을 맞춥니다.

주요 전제:

- 본 문서는 **검증 절차서**이며, 즉시 마이그레이션을 권장하는 것이 아닙니다.
- 기존 경로(Bedrock KB + OpenSearch Serverless / S3 Vectors)는 **삭제하지 않습니다**. 병렬 옵션으로서의 추가 검증입니다.
- Managed KB가 기존형 KB보다 "우수한" 것은 아닙니다. **용도에 따른 선택**이며, 본 프로젝트의 주목적인 Permission-aware RAG의 요건(ACL 엄격 적용)을 충족할 수 있는지가 마이그레이션 가부를 결정합니다.
- 기재 내용의 증거 계층을 다음과 같이 분류합니다.

| 계층 | 정의 | 본 문서에서의 취급 |
|------|------|------------------|
| Public evidence | AWS 공식 문서·블로그에서 검증 가능 | 출처 링크와 함께 기재 |
| Project-context expectation | 본 프로젝트 내의 설계 판단·기대값(공개 검증 불가) | "본 프로젝트의 상정"으로 명시 |

> ⚠️ **Validation Required**: 본 문서의 검증 절차는 AWS 공식 튜토리얼([기존형 KB 대상](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html))을 Managed KB 대상으로 **읽어 바꾼 전제**를 포함합니다. Managed KB의 S3 커넥터가 FSx for ONTAP S3 Access Point를 인식하는지는 공식적으로 미확인이며, 검증 V1에서 이를 가장 먼저 확인해야 합니다.

---

## 1. 검증의 전체상

마이그레이션 가부를 판단하기 위한 검증은 다음 3개 페이즈로 구성합니다. 각 페이즈는 이전 페이즈의 성공을 전제로 합니다.

```
Phase A: 연결 검증 (V1, V2)
  └─ S3 AP를 데이터 소스로 할 수 있는가 / 메타데이터가 보존되는가
       │ PASS
       ▼
Phase B: 인가 검증 (V3, V4, V5)
  └─ ACL 필터가 기능하는가 / 멀티홉에서 유지되는가 / 반영 지연
       │ PASS
       ▼
Phase C: 감사·운영 검증 (V6, V7)
  └─ lineage 기록 / 대화 이력·캐시의 ACL
       │ PASS
       ▼
마이그레이션 가부 판단 (→ 마이그레이션 검토 문서 §5)
```

> 어느 페이즈도 **프로덕션 데이터가 아니라 FlexClone으로 작성한 검증용 볼륨**에 대해 실시합니다(§4 참조).

---

## 2. Phase A: S3 Access Point 데이터 소스 연결 검증

### 2.1 검증 V1: S3 커넥터가 S3 AP URI를 인식하는가

⚠️ **Validation Required**: 공식 튜토리얼은 기존형 KB 대상이며, Managed KB의 S3 커넥터가 S3 AP의 alias 형식 URI를 받아들이는지는 미확인입니다.

**전제 준비**:

1. FlexClone으로 검증용 볼륨을 작성(§4의 절차)
2. 검증용 볼륨에 대한 S3 Access Point를 작성(기존 `setup-kb-datasource.sh`의 로직 참조)
3. S3 AP alias를 확인(형식: `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` 또는 ARN)

**검증 절차**:

```bash
# 1. Managed KB를 작성(관리형 벡터 스토리지)
#    ⚠️ 다음은 상정 명령. Managed KB의 정확한 API 파라미터는 GA 문서에서 요확인
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ managed storage 지정 방법은 요확인

# 2. S3 커넥터를 데이터 소스로 추가하고 S3 AP URI를 지정
#    검증의 핵심: S3 AP의 alias 형식 / ARN 형식 중 어느 것이 수리되는가
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ 여기가 수리되는지가 V1의 본질
    }
  }'
```

**판정 기준**:

| 결과 | 판정 | 다음 액션 |
|------|------|----------|
| S3 AP ARN/alias가 수리되어 동기화 성공 | ✅ PASS | V2로 |
| S3 AP는 불가하지만 일반 S3 버킷이면 가능 | △ 조건부 | DataSync 등으로 S3 중계 경로를 검토(ACL 메타데이터 보존에 추가 검증 필요) |
| S3 커넥터 자체가 동기화 실패 | ❌ FAIL | 마이그레이션 불성립. 현행 구성 유지 |

> **본 프로젝트의 상정**: S3 호환 API라면 연결 가능하다고 상정하지만, S3 AP 고유의 제약([FSx for ONTAP S3 AP 호환성 매트릭스](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)에 기재된 ListObjectsV2 레이턴시 등)이 Managed KB의 크롤러에 영향을 줄 가능성이 있습니다.

### 2.2 검증 V2: 메타데이터 보존

**검증 절차**:

1. 검증용 볼륨에 `.metadata.json`(`allowed_group_sids`를 포함)을 배치
2. Managed KB의 동기화를 실행
3. `Retrieve` API로 문서를 취득하고 응답에 메타데이터가 포함되는지 확인

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "테스트 쿼리"}' \
  --region ap-northeast-1
# 응답의 metadata 필드에 allowed_group_sids가 포함되는지 확인
```

**판정 기준**:

| 결과 | 판정 |
|------|------|
| `allowed_group_sids`가 메타데이터로 보존되어 취득 가능 | ✅ PASS → Phase B로 |
| 메타데이터가 누락 또는 다른 형식으로 변환됨 | ❌ FAIL → ACL 필터 불가. 현행 구성 유지 |

> ⚠️ Managed KB의 Smart Parsing이 메타데이터를 어떻게 다루는지는 미확인입니다. `.metadata.json`의 sidecar 방식이 기존형 KB와 마찬가지로 기능하는지, 아니면 다른 메타데이터 부여 방식(커넥터 속성 등)이 필요한지를 확인하십시오.

---

## 3. Phase B: Permission-aware RAG 설계 과제 검증

본 프로젝트의 주목적은 Permission-aware RAG이며, ACL 엄격 적용은 양보할 수 없는 요건입니다. Phase B의 검증을 클리어하지 않는 한, 현행 구성의 유지가 기본 방침이 됩니다.

### 3.1 기존 방식과의 불변 조건

현행은 [벡터 스토어 비의존 방식](s3-vectors-sid-architecture-guide.md)을 채택하고 있습니다.

```
Bedrock KB Retrieve → 검색 결과 + allowed_group_sids
→ 앱 측(route.ts)에서 사용자SID ∩ 문서SID 대조(Fail-Closed)
→ 일치한 문서만 Converse API로
```

**마이그레이션 시 유지해야 할 불변 조건**: "앱 측에서 최종 인가를 강제하고, SID 취득 불가 시 전체 거부(Fail-Closed)". Managed KB가 이 불변 조건을 무너뜨리지 않는지를 검증합니다.

### 3.2 검증 V3: `listContains`에 의한 SID 배열 대조

[AgentCore Gateway connector target 문서](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)에 따르면, Managed KB의 `Retrieve` 툴은 `managedSearchConfiguration.filter`에서 `listContains` 연산자를 지원합니다(출처의 취지를 요약).

**검증 절차**:

```bash
# 사용자의 SID가 allowed_group_sids 배열에 포함되는 문서만 취득
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "기밀 문서 테스트"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**판정 기준**:

| 테스트 케이스 | 기대 결과 |
|-------------|---------|
| 사용자 SID가 배열에 포함되는 문서 | 취득됨 |
| 사용자 SID가 배열에 포함되지 않는 문서 | 제외됨 |
| `allowed_group_sids`가 누락된 문서 | 제외됨(Fail-Closed) |

> ⚠️ **중요**: `listContains`가 검색 계층에서 필터하더라도, 본 프로젝트의 설계 원칙은 **앱 측에서의 재인가**입니다. Managed KB의 filter를 "1차 필터"로 사용하고, 최종 인가는 앱 측에서 유지하는 2층 방어를 권장합니다(filter에만 의존하지 않음).

### 3.3 검증 V4: Agentic Retrieval 멀티홉 중의 필터 유지

이것이 Managed KB 고유의 최대 리스크입니다. `AgenticRetrieveStream`은 쿼리를 서브쿼리로 분해하여 여러 번의 검색을 반복합니다. **각 홉에서 메타데이터 필터가 유지되지 않으면, 중간 스텝에서 권한 외 데이터가 혼입됩니다.**

**검증 절차**:

1. 권한이 다른 여러 문서에 걸쳐야 하는 복잡한 쿼리를 준비(예: "부문 A의 기밀 설계서와 공개 사양서를 비교하여")
2. 권한 외 문서(부문 A의 기밀)에 액세스할 수 없는 사용자로 `AgenticRetrieveStream`을 실행
3. 각 홉의 트레이스(CloudWatch / 응답의 중간 스텝)를 확인하고, 권한 외 문서가 **어느 홉에서도 참조되지 않는** 것을 검증

**판정 기준**:

| 결과 | 판정 |
|------|------|
| 전체 홉에서 `userContext` / filter가 적용되어 권한 외 데이터 비참조 | ✅ PASS |
| 중간 홉에서 필터가 누락되어 권한 외 데이터가 혼입 | ❌ FAIL → 멀티홉 무효화, 단일 `Retrieve`만 사용 |

> ⚠️ **Validation Required**: 멀티홉 각 스텝으로의 필터 전파는 공식적으로 명시되지 않았습니다. 검증으로 확인할 수 없는 경우, `AgenticRetrieveStream`을 사용하지 않고 단일 `Retrieve` + 앱 측 대조로 한정합니다(멀티홉의 이점을 포기하더라도 ACL 보증을 우선).

### 3.4 검증 V5: 권한 변경 / 삭제의 반영 지연

**검증 절차**:

1. 사용자의 SID를 그룹에서 삭제(또는 문서의 `allowed_group_sids`를 변경)
2. Managed KB의 동기화 완료 후, 해당 사용자로 재검색
3. 구 권한 데이터가 반환되지 않게 될 때까지의 지연을 계측

**판정 기준**: 반영 지연이 본 프로젝트의 [권한 정합성 모델](permission-consistency.md)에서 정의하는 허용 범위 내인가. 범위 외이면, 긴급 실효(emergency revocation)는 앱 측 캐시 무효화로 별도 담보하는 설계가 필요합니다.

---

## 4. FlexClone을 사용한 안전한 검증 패턴

프로덕션 데이터를 직접 Managed KB의 크롤링 대상으로 해서는 안 됩니다. FlexClone으로 프로덕션 상당의 검증용 볼륨을 작성하고, 격리된 환경에서 검증합니다.

### 4.1 왜 FlexClone인가

| 관점 | 직접 프로덕션 액세스 | FlexClone 검증 |
|------|---------------------|---------------|
| 프로덕션 I/O로의 영향 | 크롤링 부하가 업무 워크로드에 영향 | 영향 없음(클론은 독립) |
| 데이터 일관성 | 크롤링 중의 갱신으로 불정합 가능성 | 포인트인타임으로 일관 |
| 검증의 재현성 | 프로덕션 데이터 변동으로 재현 곤란 | 동일 스냅샷에서 몇 번이든 재현 |
| 오조작 리스크 | 프로덕션 데이터로의 오기록 리스크 | 클론은 폐기 가능 |
| 비용 | — | 스냅샷 차분만(초기는 수MB) |

### 4.2 검증용 클론 작성 절차

```bash
# 1. 프로덕션 볼륨의 스냅샷을 작성(ONTAP REST API / CLI)
#    ⚠️ ONTAP 관리 엔드포인트로의 액세스는 VPC 내에서 실시
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. 스냅샷에서 FlexClone을 작성
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. 클론 볼륨에 대한 S3 Access Point를 작성
#    (기존 setup-kb-datasource.sh의 로직을 검증용으로 전용)

# 4. 검증 완료 후, 클론을 폐기(프로덕션에 영향 없음)
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> 정확한 ONTAP REST API 파라미터는 [운영 Runbook](operations-runbook.md)의 ONTAP 조작 섹션을 참조하십시오. SSH 키·관리 엔드포인트 정보는 프로덕션 절차에 따릅니다.

### 4.3 검증 환경의 격리 원칙

- 검증용 Managed KB는 프로덕션 KB와는 **별도 리소스**로 작성하고, 프로덕션 KB ID를 변경하지 않음
- 검증용 S3 AP는 검증용 클론만을 가리킴(프로덕션 볼륨 비참조)
- 검증용 IAM 역할은 검증 리소스에 **최소 권한**으로 스코프(프로덕션 데이터로의 읽기 권한을 부여하지 않음)
- 검증 완료 후에는 클론·KB·S3 AP·IAM 역할을 모두 폐기

---

## 5. 감사·lineage 검증 (Phase C / Optional)

⚠️ **Validation Required**: Managed KB 경유의 액세스가 연계 대상([fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations))의 Unity Catalog lineage에 기록되는지는 미확인입니다.

**검증 관점**:

- Managed KB의 `Retrieve` / `AgenticRetrieveStream` 호출이 CloudTrail에 기록되는가
- "누가·언제·어떤 문서 유래 정보를·어떤 응답에서 사용했는가"를 추적할 수 있는가
- 대화 이력·캐시로의 ACL 적용이 앱 측에서 유지되는가(Managed 측 캐시의 동작이 불명하므로, 앱 측에서 명시적으로 제어)

감사 요건의 상세는 [거버넌스·감사 설계](governance-and-audit.md)를 참조하십시오.

---

## 6. 검증 체크리스트 (요약)

마이그레이션 가부 판단 전에 다음을 모두 클리어하십시오.

- [ ] **V1**: S3 커넥터가 FSx for ONTAP S3 AP를 인식(Phase A)
- [ ] **V2**: `allowed_group_sids`가 메타데이터로 보존(Phase A)
- [ ] **V3**: `listContains`로 SID 배열 대조가 기능(Phase B)
- [ ] **V4**: Agentic Retrieval 멀티홉 중에도 필터 유지(Phase B)
- [ ] **V5**: 권한 변경 / 삭제의 반영 지연이 허용 범위 내(Phase B)
- [ ] **V6**: CloudTrail / lineage에 기록(Phase C)
- [ ] **V7**: 대화 이력 / 캐시로의 ACL 적용 유지(Phase C)
- [ ] 모든 검증을 **FlexClone 검증용 볼륨**에서 실시(프로덕션 비영향)
- [ ] 앱 측 Fail-Closed 재인가의 불변 조건을 유지

> 어느 항목이든 FAIL인 경우, 해당 리스크를 허용할 수 있는 설계 보완이 없는 한, **현행 구성(OpenSearch Serverless / S3 Vectors)의 유지**가 기본 방침이 됩니다. CDK 스택으로의 Managed KB 통합은 모든 검증 클리어 후에 착수합니다.

---

## 7. 관련 문서

| 문서 | 내용 |
|------|------|
| [Managed KB 마이그레이션 검토](managed-kb-migration-evaluation.md) | 판단 기준 / 트레이드오프 / 기존 구성 비교 |
| [CDK 스택 아키텍처 가이드](stack-architecture-comparison.md) | 벡터 스토어 구성 비교(Managed KB 열 포함) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 설계 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | 벡터 스토어 비의존 인가 방식 |
| [권한 정합성 모델](permission-consistency.md) | ACL 변경 반영 플로우 / 허용 지연 |
| [거버넌스·감사 설계](governance-and-audit.md) | 감사 로그 / lineage 요건 |
| [운영 Runbook](operations-runbook.md) | ONTAP 조작(FlexClone 작성 절차) |

---

## 참고 링크

- [Amazon Bedrock Managed Knowledge Base GA 발표](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [AWS 공식 튜토리얼(기존형 KB)](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway connector target(Managed KB)](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> 라이선스 준수를 위해 콘텐츠를 재구성했습니다. AWS 공식 정보는 출처의 취지를 유지하면서 요약·언어 변경했습니다.
