# PoC 결과 보고서 템플릿

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | [English](../../en/templates/poc-result-report-template.md) | **한국어** | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | [繁體中文](../../zh-TW/templates/poc-result-report-template.md) | [Français](../../fr/templates/poc-result-report-template.md) | [Deutsch](../../de/templates/poc-result-report-template.md) | [Español](../../es/templates/poc-result-report-template.md)

**목적**: 파트너/SI가 고객에게 PoC 실시 결과를 보고하기 위한 양식

---

## 1. 요약

| 항목 | 내용 |
|---|---|
| 고객명 | _____ |
| 실시 기간 | YYYY/MM/DD — YYYY/MM/DD |
| 대상 업무 | _____ |
| 대상 문서 수 | _____ |
| 대상 사용자 수 | _____ |
| 종합 평가 | ☐ 프로덕션 전환 권장 / ☐ 추가 검증 필요 / ☐ 보류 |

---

## 2. 정량 평가 결과

### 2.1 RAG 품질 지표

| 지표 | 목표값 | 실측값 | 판정 |
|---|---|---|---|
| Faithfulness(사실 정합성) | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Answer Relevancy(응답 관련성) | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Context Precision(컨텍스트 정밀도) | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| 권한 위반 건수 | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 성능 지표

| 지표 | 목표값 | 실측값 | 판정 |
|---|---|---|---|
| 응답 시간 (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| 응답 시간 (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Prompt Cache 적중률 | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 비즈니스 효과 지표

| 지표 | PoC 이전 | PoC 이후 | 개선율 |
|---|---|---|---|
| 검색 시간(건당) | _____ 분 | _____ 초 | _____ % |
| 1차 응답 해결률 | _____ % | _____ % | _____ pt |
| 권한 외 정보 접근 | _____ 건 | 0 건 | 100% |

---

## 3. 권한 제어 검증 결과

| 테스트 시나리오 | 결과 | 비고 |
|---|---|---|
| 관리자 → 전체 문서 접근 | ☐ Pass / ☐ Fail | |
| 일반 사용자 → 공개 문서만 | ☐ Pass / ☐ Fail | |
| 그룹 권한 → 소속 부서 문서만 | ☐ Pass / ☐ Fail | |
| 권한 변경 → 반영 | ☐ Pass / ☐ Fail | 최대 지연: _____ 분 |
| 권한 없는 문서 → 검색 결과에서 제외 | ☐ Pass / ☐ Fail | |

---

## 4. 비용 실적

| 항목 | 월 예상 비용 | 비고 |
|---|---|---|
| FSx for ONTAP | $_____ | |
| Bedrock(추론) | $_____ | Smart Routing 적용 후 |
| Bedrock(임베딩) | $_____ | 초기 + 증분 |
| 벡터 스토어 | $_____ | S3 Vectors / OpenSearch |
| 기타(Lambda, DynamoDB, CloudFront) | $_____ | |
| **합계** | **$_____** | |

---

## 5. 발견된 과제와 권고 사항

| # | 과제 | 영향도 | 권고 대응 | 대응 시기 |
|---|---|---|---|---|
| 1 | | ☐ 높음 / ☐ 보통 / ☐ 낮음 | | |
| 2 | | ☐ 높음 / ☐ 보통 / ☐ 낮음 | | |
| 3 | | ☐ 높음 / ☐ 보통 / ☐ 낮음 | | |

---

## 6. 프로덕션 전환을 위한 다음 단계

| # | 액션 | 담당 | 기한 |
|---|---|---|---|
| 1 | 보안 평가(IAM 최소 권한, 암호화) | | |
| 2 | 부하 테스트(예상 사용자 수의 2배) | | |
| 3 | DR 설계(Multi-AZ, 백업) | | |
| 4 | 운영 설계(Runbook, 알림) | | |
| 5 | Go/No-Go 판정 회의 | | |

---

## 7. 첨부 자료

- [ ] CloudWatch 대시보드 스크린샷
- [ ] RAGAS 평가 결과(JSON)
- [ ] 권한 매트릭스 테스트 결과
- [ ] 비용 명세(AWS Cost Explorer)
- [ ] 사용자 설문 결과(실시한 경우)
