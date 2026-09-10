# 청킹 전략 선정 가이드

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | **한국어** | [简体中文](../zh-CN/chunking-strategy-guide.md) | [繁體中文](../zh-TW/chunking-strategy-guide.md) | [Français](../fr/chunking-strategy-guide.md) | [Deutsch](../de/chunking-strategy-guide.md) | [Español](../es/chunking-strategy-guide.md)

**작성일**: 2026-06-07  
**상태**: 초판  
**대상**: RAG 품질 튜닝 담당자, 데이터 엔지니어

---

## 개요

Bedrock Knowledge Base의 청킹 전략은 검색 정확도, 응답 품질, 비용에 직접 영향을 줍니다. 이 가이드는 FSx for ONTAP에 있는 문서 특성에 맞는 전략 선택을 돕습니다.

---

## 사용 가능한 전략

CDK 컨텍스트 `kbChunkingStrategy`로 설정합니다:

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # 기본값
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **청킹 전략을 변경하면 데이터 소스 재동기화(재인제스션)가 필요합니다.**

**이 네 가지 이외의 값은 synth 시점에 예외가 됩니다.** 조용히 기본값으로 되돌리면 `KbChunkingStrategy` 출력에는 잘못 입력한 문자열이, 실제 설정에는 `FIXED_SIZE`가 담겨 표시와 배포 설정이 어긋납니다. 대소문자는 정규화됩니다(`semantic` → `SEMANTIC`).

---

## 전략 비교

| 전략 | 청크 크기 | 오버랩 | 검색 정확도 | 비용 | 적합한 경우 |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 토큰 | 10% | ⭐⭐⭐ | 💰 낮음 | 범용, 초기 배포, 구조가 균일한 문서 |
| **HIERARCHICAL** | parent 1500 / child 300 | 60 토큰 | ⭐⭐⭐⭐ | 💰💰 중간 | 장문 보고서, 계층 구조 문서, 기술 문서 |
| **SEMANTIC** | ≤300 토큰 | 자동(의미 단위) | ⭐⭐⭐⭐⭐ | 💰💰💰 높음 | 다양한 문서, FAQ, 대화 형식, 회의록 |
| **NONE** | 문서 전체 | 없음 | ⭐⭐ | 💰 가장 낮음 | 짧은 문서(<300 토큰), 메타데이터만 |

---

## 문서 특성과 권장 전략

| 문서 특성 | 권장 | 이유 |
|---|---|---|
| **설계서·명세서**(계층 구조, 장문) | HIERARCHICAL | 장 → 절 → 단락의 계층을 유지해 넓은 컨텍스트와 정밀한 검색을 함께 얻습니다 |
| **계약서·법률 문서**(조문 단위) | SEMANTIC | 조문 사이의 의미 경계를 감지하고 조문을 쪼개지 않습니다 |
| **FAQ**(짧은 질문-답변 쌍) | SEMANTIC | 질문과 답변을 같은 청크에 유지합니다 |
| **회의록·메일**(대화 형식) | SEMANTIC | 주제가 바뀌는 지점에서 자연스럽게 분할합니다 |
| **매뉴얼·절차서**(단계별) | HIERARCHICAL | 절차 전체가 parent, 각 단계가 child가 됩니다 |
| **재무 보고서**(표·수치 포함) | FIXED_SIZE | 표 구조가 복잡할 때 고정 크기가 더 안정적입니다 |
| **짧은 공지**(1페이지 미만) | NONE | 문서 전체가 한 청크에 들어가면 분할이 필요 없습니다 |
| **혼재 코퍼스**(다양한 문서 유형) | SEMANTIC | 유형과 무관하게 의미상 타당한 분할이 됩니다 |

---

## 업종별

| 업종 | 주요 문서 | 권장 | 비고 |
|---|---|---|---|
| **제조** | 도면(텍스트 부분), 품질 규격, 작업 절차서 | HIERARCHICAL | 도면은 멀티모달 KB와 함께 사용 |
| **금융** | 규제 문서, 내부 보고서, 컴플라이언스 보고 | SEMANTIC | 조문의 의미적 완전성을 유지 |
| **공공** | 정책 문서, 통달, 회의록 | SEMANTIC | 회의록의 주제 단위 분할이 중요 |
| **의료** | 임상 가이드라인, 절차서, 연구 논문 | HIERARCHICAL | 장 구성 구조를 활용 |
| **법무** | 계약서, 판례, 법령 | SEMANTIC | 조문 분할을 피함 |
| **교육** | 교재, 실라버스, 연구 자료 | FIXED_SIZE | 균일한 구조, 비용 중시 |
| **보험** | 심사 기준, 부정 탐지 보고서 | HIERARCHICAL | 계층적 판정 기준에 적합 |

---

## 성능 특성

### 인제스션 시간

| 전략 | 1,000 문서(추정) | 10,000 문서(추정) |
|---|---|---|
| FIXED_SIZE | ~5 분 | ~30 분 |
| HIERARCHICAL | ~8 분 | ~50 분 |
| SEMANTIC | ~15 분 | ~90 분 |
| NONE | ~3 분 | ~15 분 |

> SEMANTIC은 후보 경계마다 모델 호출을 추가로 수행하므로 인제스션 시간과 비용이 늘어납니다.

### 검색 지연

청킹 전략은 검색 지연에 직접 영향을 주지 않습니다(벡터 검색 성능은 인덱스 크기에 의존). 다만 HIERARCHICAL은 parent/child 2단 검색을 수행하므로 지연이 약간(~50ms) 늘어날 수 있습니다.

---

## 권한 인식 RAG와의 관계

**중요**: 청킹 전략과 무관하게 권한 필터링은 항상 **문서 단위**로 적용됩니다.

```
문서 A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (문서에서 상속)
  ├── Chunk 2 → SID: [Admin, Engineering] (문서에서 상속)
  └── Chunk 3 → SID: [Admin, Engineering] (문서에서 상속)
```

- `.metadata.json`의 SID 정보는 문서 단위로 부여됩니다.
- 청크 단위의 권한 차별화는 불가능하며, 문서 전체가 하나의 권한 집합을 가집니다.
- 같은 문서 안에서 다른 권한이 필요하면 문서를 분할해 별도 파일로 만듭니다.

---

## 전략 변경 절차

```bash
# 1. 현재 전략 확인
grep kbChunkingStrategy cdk.context.json

# 2. CDK 컨텍스트 갱신
# cdk.context.json을 편집하거나 커맨드라인으로 지정

# 3. CDK 차분 확인
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. 배포(데이터 소스 설정만 갱신)
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. 데이터 소스 재동기화(필수)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. 재인제스션 완료 대기
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. 품질 평가(RAGAS로 비교)
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## 평가 방법

전략 변경 후에는 반드시 다음을 측정합니다:

1. **RAGAS 평가**: `tests/rag-evaluation/`으로 Faithfulness, Answer Relevancy, Context Precision을 비교합니다.
2. **권한 매트릭스 회귀**: 31개 시나리오에서 권한 필터링이 정상인지 확인합니다.
3. **응답 시간**: CloudWatch에서 P50/P95/P99 지연을 확인합니다.
4. **비용**: 인제스션 비용과 쿼리 비용의 합으로 비교합니다.

---

## CDK 구현

`lib/stacks/demo/demo-ai-stack.ts`의 `buildChunkingConfiguration()`:

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE: 청킹 없음(문서 전체를 하나의 벡터로)
```

---

## 관련 문서

- [FSx for ONTAP 사이징·성능 설계](fsxn-sizing-and-performance.md)
- [RAG / Agent 평가 프레임워크](evaluation.md)
- [비용 견적 워크시트](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
