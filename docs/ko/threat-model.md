# 위협 모델 — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | **한국어** | [简体中文](../zh-CN/threat-model.md) | [繁體中文](../zh-TW/threat-model.md) | [Français](../fr/threat-model.md) | [Deutsch](../de/threat-model.md) | [Español](../es/threat-model.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 보안 아키텍트, 위협 모델링 담당자, CISO

---

## 개요

본 문서는 Permission-aware Agentic RAG 시스템에 대한 주요 위협, 공격 경로, 영향, 기존 완화 조치 및 권장 추가 대책을 정리한 위협 모델입니다.

---

## 시스템 경계 및 신뢰 경계

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 신뢰 경계 1: 인터넷 → CloudFront                                         │
│  공격자: 외부 사용자, 봇, 스크립트                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ 신뢰 경계 2: CloudFront → Lambda (WebApp)                                │
│  공격자: 인증되었지만 권한 외의 사용자                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 신뢰 경계 3: Lambda → Bedrock / DynamoDB / FSx                           │
│  공격자: 내부 위협, 설정 오류, 공급망                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 신뢰 경계 4: FSx for ONTAP → S3 Access Point → Bedrock KB                    │
│  공격자: 권한 상승, 메타데이터 변조                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 위협 카탈로그

### T1: Prompt Injection

| 항목 | 내용 |
|------|------|
| **위협** | 악의적인 프롬프트로 시스템 프롬프트 무시, 권한 검사 우회, 의도하지 않은 정보 공개를 유발 |
| **공격 경로** | 사용자 입력 → Converse API / Agent |
| **영향** | 높음 — 권한 외 문서 내용 유출, 시스템 동작 변경 |
| **기존 완화 조치** | Bedrock Guardrails(콘텐츠 필터), SID 필터링은 애플리케이션 측에서 실행(LLM이 우회 불가) |
| **추가 권장** | Guardrails Prompt Attack 필터 활성화, 입력 길이 제한, 출력 검증 레이어 추가 |
| **잔존 위험** | 간접적 Prompt Injection(문서 내에 포함된 지시)은 완전히 방지할 수 없음 |

**중요**: 본 시스템에서는 SID 필터링이 LLM 외부(애플리케이션 레이어)에서 실행되므로, Prompt Injection으로 권한 검사 자체를 우회할 수 없습니다. 다만, 허가된 문서 내의 정보를 의도하지 않은 형태로 공개시키는 위험은 남아 있습니다.

---

### T2: Retrieval Poisoning

| 항목 | 내용 |
|------|------|
| **위협** | 악의적인 문서를 FSx 볼륨에 배치하여 RAG 검색 결과를 오염시킴 |
| **공격 경로** | CIFS/SMB 접근 → FSx 볼륨 → S3 AP → Bedrock KB |
| **영향** | 중~높음 — 오정보 생성, 피싱 유도, 간접적 Prompt Injection |
| **기존 완화 조치** | NTFS ACL 쓰기 제한, Transfer Family IAM 역할 제한, `.metadata.json`은 서비스 역할만 생성 가능 |
| **추가 권장** | 문서 투입 시 맬웨어 스캔, 콘텐츠 검증 파이프라인, 이상 탐지(급격한 문서 증가 알림) |
| **잔존 위험** | 정당한 쓰기 권한을 가진 내부 사용자에 의한 의도적 오염 |

---

### T3: Cross-User Data Leakage

| 항목 | 내용 |
|------|------|
| **위협** | 사용자 A의 검색 결과에 사용자 B만 접근 가능한 문서가 포함됨 |
| **공격 경로** | SID 필터링 구현 버그, 캐시 오염, 세션 혼동 |
| **영향** | 높음 — 기밀 정보 유출, 컴플라이언스 위반 |
| **기존 완화 조치** | SID 매칭(집합의 교집합), Fail-Closed 원칙, 권한 매트릭스 테스트(31개 시나리오) |
| **추가 권장** | 정기적인 권한 매트릭스 테스트 자동 실행, 이상 탐지(평소 접근하지 않는 문서에 대한 접근 패턴) |
| **잔존 위험** | 낮음 — SID 필터링이 LLM 외부에서 실행되므로 구현 버그 외에는 우회가 어려움 |

---

### T4: Stale ACL / Permission Drift

| 항목 | 내용 |
|------|------|
| **위협** | 파일 ACL이 변경되었지만 벡터 스토어 메타데이터나 권한 캐시에 이전 권한이 잔존 |
| **공격 경로** | ACL 변경 → 메타데이터 미갱신 → 이전 권한으로 검색 가능 |
| **영향** | 중간 — 권한 박탈 후에도 일정 기간 접근 가능(최대 35분) |
| **기존 완화 조치** | KB Auto-Sync(15분 간격), 권한 캐시 TTL(5분), 긴급 권한 박탈 절차 |
| **추가 권장** | ACL 변경 이벤트 즉시 감지(FSx Audit Log → EventBridge), 캐시 TTL 단축 검토, 권한 변경 감사 로그 |
| **잔존 위험** | Eventually Consistent 모델이므로 완전한 실시간 반영은 불가능. 긴급 시 수동 박탈로 대응 |

**상세**: [permission-consistency.md](../permission-consistency.md) 참조

---

### T5: Over-Permissive Cache

| 항목 | 내용 |
|------|------|
| **위협** | 권한 캐시가 과도하게 허용적인 상태로 고정되어 거부해야 할 접근을 계속 허용 |
| **공격 경로** | 캐시 쓰기 시 경합 상태, TTL 설정 오류, 캐시 키 충돌 |
| **영향** | 높음 — 권한 외 문서에 대한 지속적 접근 |
| **기존 완화 조치** | DynamoDB TTL 자동 만료(5분), 캐시 키에 사용자 ID + 문서 ID 포함 |
| **추가 권장** | 캐시 히트율 모니터링, 비정상적으로 높은 히트율 알림, 정기적 캐시 전체 삭제(일별) |
| **잔존 위험** | 낮음 — TTL이 짧아 오염되더라도 5분 내 자동 복구 |

---

### T6: Agent Tool Abuse

| 항목 | 내용 |
|------|------|
| **위협** | Agent가 의도하지 않은 도구를 호출하여 데이터 변경·삭제·외부 전송을 수행 |
| **공격 경로** | Prompt Injection → Agent 행동 계획 변경 → 위험한 도구 호출 |
| **영향** | 높음 — 데이터 파괴, 정보 유출, 비용 폭발 |
| **기존 완화 조치** | AgentCore Policy(도구 접근 제한), Action Group IAM 역할 최소 권한화, 읽기 전용 도구만 기본 제공 |
| **추가 권장** | Human Approval(외부 액션 실행 전 승인), 도구 호출 횟수 제한, 비용 상한 설정 |
| **잔존 위험** | 중간 — Agent의 자율성과 안전성의 트레이드오프. 읽기 전용으로 제한하면 위험은 낮음 |

---

### T7: Audit Log Tampering

| 항목 | 내용 |
|------|------|
| **위협** | 감사 로그의 변조·삭제로 부정 접근의 증적을 은폐 |
| **공격 경로** | Lambda 실행 역할의 권한 상승 → CloudWatch Logs / S3 변조 |
| **영향** | 높음 — 인시던트 조사 불가, 컴플라이언스 위반 |
| **기존 완화 조치** | CloudWatch Logs 보존 정책, IAM 최소 권한 |
| **추가 권장** | S3 Object Lock(WORM), CloudTrail 로그의 별도 계정 보존, 로그 무결성 검증(CloudTrail Digest) |
| **잔존 위험** | 낮음 — S3 Object Lock + 별도 계정 보존으로 실질적으로 변조 불가능 |

**상세**: [governance-and-audit.md](../governance-and-audit.md) 참조

---

### T8: Misconfigured Identity Federation

| 항목 | 내용 |
|------|------|
| **위협** | OIDC / SAML / LDAP 설정 오류로 부정한 사용자가 인증을 통과하거나 정규 사용자에게 과도한 권한이 부여됨 |
| **공격 경로** | IdP 설정 오류 → 부정 토큰 발행 → Cognito 인증 통과 → 과도한 SID 부여 |
| **영향** | 높음 — 권한 상승, 전체 문서에 대한 접근 |
| **기존 완화 조치** | `authFailureMode=fail-closed`(권한 취득 실패 시 차단), Cognito 토큰 검증, LDAP 헬스 체크 |
| **추가 권장** | IdP 설정의 정기 감사, 페더레이션 메타데이터 자동 검증, 비정상적인 그룹 SID 수 알림 |
| **잔존 위험** | 중간 — IdP 측 설정은 본 시스템의 제어 범위 밖. Fail-Closed로 영향을 제한 |

---

### T9: Vector Metadata Leakage

| 항목 | 내용 |
|------|------|
| **위협** | 벡터 스토어의 메타데이터(SID 정보, 파일 경로)가 의도치 않게 노출되어 조직 구조나 접근 권한 정보가 유출 |
| **공격 경로** | S3 Vectors / OpenSearch Serverless에 대한 직접 접근, API 응답의 과도한 정보 반환 |
| **영향** | 중간 — 조직 구조 추측, 표적형 공격의 정보 수집 |
| **기존 완화 조치** | VPC 엔드포인트 경유 접근 제한, IAM 정책에 의한 직접 접근 방지, API 응답에서 SID 정보 제외(프론트엔드) |
| **추가 권장** | S3 Vectors 버킷 정책의 최소 권한화, OpenSearch Serverless 데이터 접근 정책 감사, 메타데이터 암호화 |
| **잔존 위험** | 낮음 — Bedrock KB 경유 접근만 허용하고 직접 접근을 IAM으로 방지 |

---

### T10: Denial of Wallet / Cost Abuse

| 항목 | 내용 |
|------|------|
| **위협** | 대량의 요청이나 고비용 모델의 의도적 이용으로 AWS 이용 요금을 폭발시킴 |
| **공격 경로** | 인증된 사용자에 의한 대량 쿼리, Agent 모드에서의 무한 루프, 고비용 모델의 연속 이용 |
| **영향** | 높음 — 예기치 않은 고액 청구 |
| **기존 완화 조치** | WAF 레이트 리밋(2000 req/5min), Smart Routing(저비용 모델 우선), Lambda 동시 실행 수 제한 |
| **추가 권장** | AWS Budgets 알림, 사용자별 일일 쿼리 상한, Agent 스텝 수 상한, Bedrock Provisioned Throughput 검토 |
| **잔존 위험** | 중간 — 레이트 리밋으로 완화되지만 정규 사용자에 의한 과도한 이용은 완전히 방지할 수 없음 |

---

## 위협 → 대책 매핑 표

| 위협 | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
| T1: Prompt Injection | — | ✅ | — | — | — | — | ✅ | — |
| T2: Retrieval Poisoning | — | ✅ | — | — | ✅ | — | ✅ | — |
| T3: Cross-User Leakage | — | — | ✅ | ✅ | — | — | ✅ | — |
| T4: Stale ACL | — | — | — | ✅ | — | — | ✅ | — |
| T5: Over-Permissive Cache | — | — | ✅ | ✅ | — | — | ✅ | — |
| T6: Agent Tool Abuse | — | ✅ | — | — | ✅ | — | ✅ | ✅ |
| T7: Audit Log Tampering | — | — | — | — | ✅ | ✅ | — | — |
| T8: Misconfigured IdP | — | — | — | ✅ | ✅ | — | ✅ | — |
| T9: Metadata Leakage | — | — | — | — | ✅ | ✅ | ✅ | — |
| T10: Cost Abuse | ✅ | — | — | — | — | — | ✅ | ✅ |

---

## 위험 평가 요약

| 위협 | 발생 가능성 | 영향도 | 잔존 위험 | 우선순위 |
|------|-----------|--------|-----------|---------|
| T1: Prompt Injection | 높음 | 중간 | 중간 | P1 |
| T2: Retrieval Poisoning | 낮음 | 높음 | 낮음 | P2 |
| T3: Cross-User Leakage | 낮음 | 높음 | 낮음 | P1 |
| T4: Stale ACL | 중간 | 중간 | 중간 | P2 |
| T5: Over-Permissive Cache | 낮음 | 높음 | 낮음 | P3 |
| T6: Agent Tool Abuse | 중간 | 높음 | 중간 | P1 |
| T7: Audit Log Tampering | 낮음 | 높음 | 낮음 | P2 |
| T8: Misconfigured IdP | 중간 | 높음 | 중간 | P1 |
| T9: Metadata Leakage | 낮음 | 중간 | 낮음 | P3 |
| T10: Cost Abuse | 중간 | 중간 | 중간 | P2 |

---

## 권장 추가 대책(우선순위 순)

### 즉시 대응(P1)

1. **Guardrails Prompt Attack 필터 활성화** — T1 대책
2. **Agent 도구 호출의 Human Approval 구현** — T6 대책
3. **IdP 설정의 정기 감사 프로세스 확립** — T8 대책
4. **권한 매트릭스 테스트의 CI/CD 통합** — T3 대책

### 단기 대응(P2)

5. **S3 Object Lock에 의한 감사 로그 보호** — T7 대책
6. **ACL 변경 이벤트의 즉시 감지** — T4 대책
7. **문서 투입 시 콘텐츠 검증** — T2 대책
8. **AWS Budgets + 사용자별 쿼리 상한** — T10 대책

### 중기 대응(P3)

9. **캐시 히트율의 이상 탐지** — T5 대책
10. **벡터 스토어 메타데이터 암호화** — T9 대책

---

## 관련 문서

| 문서 | 관련 위협 |
|------|-----------|
| [production-readiness-checklist.md](../production-readiness-checklist.md) | 전체 위협(프로덕션 준비 확인) |
| [permission-consistency.md](../permission-consistency.md) | T3, T4, T5(권한 일관성) |
| [governance-and-audit.md](../governance-and-audit.md) | T7, T8, T9(감사·거버넌스) |
| [safe-experimentation-guide.md](../safe-experimentation-guide.md) | T2, T10(안전한 실험 범위) |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | T1, T3, T5(SID 필터링 설계) |
