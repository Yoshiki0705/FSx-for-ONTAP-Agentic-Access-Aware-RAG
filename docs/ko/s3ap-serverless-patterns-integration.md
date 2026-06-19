# S3AP Serverless Patterns 연동 아키텍처

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | **한국어** | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | [Français](../fr/s3ap-serverless-patterns-integration.md) | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | [Español](../es/s3ap-serverless-patterns-integration.md)

**작성일**: 2026-05-23  
**상태**: 초안  
**대상**: 아키텍트, 파트너 SA 대상

---

## 개요

이 문서는 [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)(17 UC 서버리스 처리 패턴)와 본 프로젝트(Permission-aware Agentic RAG)의 연동 아키텍처를 설명합니다.

---

## 두 프로젝트의 위치 관계

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (엔터프라이즈 파일 서버)                                    │
│                                                                         │
│  NAS 데이터: 설계 도면, 계약서, 진료 기록, 재무 보고서, 연구 논문...        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (처리·변환·분석)              │  │ (권한 기반 AI 검색·대화)      │
│                              │  │                              │
│ • Step Functions 배치 처리    │  │ • Bedrock KB + Converse API  │
│ • AI/ML 서비스 연동           │  │ • SID 필터링                  │
│ • 처리 결과를 FSx에 다시 기록 │  │ • 채팅 UI (Next.js)          │
│                              │  │ • Agent 모드                 │
│ 17개 업계 UC                 │  │ 14개 Agent 템플릿            │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## 연동 패턴

### 패턴 A: 처리 결과를 RAG 검색 대상으로 만들기

S3AP Serverless Patterns에서 처리·분석된 결과를 RAG의 검색 대상 문서로 활용합니다.

```
FSx for ONTAP (원본 데이터: DICOM 이미지, 계약서 PDF, IoT 로그)
  ↓ S3 AP (읽기)
S3AP Serverless Patterns
  ├─ UC5: DICOM → 메타데이터 추출·익명화
  ├─ UC1: 계약서 → 엔티티 추출·분류
  └─ UC3: IoT 로그 → 이상 탐지·보고서 생성
  ↓ S3 AP (다시 기록) or S3 버킷
FSx for ONTAP (처리 완료 데이터 + .metadata.json)
  ↓ S3 AP (읽기)
Permission-aware RAG (Bedrock KB)
  ↓ SID 필터링
사용자: "지난달 품질 검사에서 이상이 발견된 제품은?"
```

**장점**:
- 원본 데이터(이미지, 바이너리)를 AI가 이해할 수 있는 텍스트로 변환한 후 RAG에 투입
- 처리 결과에 권한 메타데이터를 부여하여 부서별 액세스 제어를 유지
- 두 시스템이 동일한 FSx for ONTAP 볼륨을 공유(데이터 복사 불필요)

### 패턴 B: RAG에서 처리 파이프라인 트리거하기

Agent 모드에서 "분석을 실행해 줘"라고 지시하면 S3AP 패턴의 Step Functions를 트리거합니다.

```
사용자: "최신 품질 검사 이미지를 분석해서 보고서를 작성해 줘"
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: 제조업 분석)
  ↓ 처리 완료
Agent: "분석이 완료되었습니다. 결과는 다음과 같습니다: ..."
```

### 패턴 C: 감사·컴플라이언스 통합

S3AP UC1(법무·컴플라이언스)의 감사 결과를 RAG로 검색 가능하게 하여 컴플라이언스 상황을 대화형으로 확인합니다.

```
S3AP UC1: 파일 서버 감사 → 감사 보고서 생성
  ↓
RAG: "컴플라이언스 위반 파일이 있나요?"
  → 감사 보고서에서 권한 범위 내의 정보를 응답
```

---

## 업종별 연동 매핑

| S3AP UC | 업종 | RAG에서의 활용 방법 | Agent 템플릿 |
|---------|------|----------------|------------------|
| UC1 | 법무 | 감사 보고서 검색, 컴플라이언스 상황 확인 | `legalCompliance` |
| UC2 | 금융 | OCR 처리 완료 청구서·계약서 검색 | `financial` |
| UC3 | 제조 | 품질 검사 보고서·이상 탐지 결과 검색 | `search` |
| UC5 | 의료 | DICOM 메타데이터·익명화 완료 소견 검색 | `medicalGuideline` |
| UC10 | 건설 | BIM 메타데이터·안전 컴플라이언스 보고서 검색 | `project` |
| UC13 | 교육 | 논문 분류 결과·인용 네트워크 검색 | `search` |
| UC14 | 보험 | 사정 보고서·손해 평가 결과 검색 | `insuranceClaim` |
| UC16 | 정부 | 공문서 분류·마스킹 완료 문서 검색 | `publicDocument` |

---

## 배포 구성 예시

### 최소 구성(1개 계정)

```
AWS Account
├── FSx for ONTAP (공유 볼륨)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (선택 배포)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### 엔터프라이즈 구성(멀티 계정)

```
Management Account
├── StackSets (S3AP 패턴 배포)
└── CDK Pipelines (RAG 배포)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## 관련 문서

| 문서 | 내용 |
|-------------|------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 멀티 테넌트 배포 패턴 |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR(벡터 스토어, 권한 필터 등) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | 17 UC 상세 |
