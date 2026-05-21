# PoC 워크숍 가이드 (90분)

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | **한국어** | [简体中文](../zh-CN/poc-workshop-guide.md) | [繁體中文](../zh-TW/poc-workshop-guide.md) | [Français](../fr/poc-workshop-guide.md) | [Deutsch](../de/poc-workshop-guide.md) | [Español](../es/poc-workshop-guide.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 솔루션 아키텍트, 파트너 엔지니어, 고객 클라우드 팀

---

## 개요

본 워크숍에서는 Permission-aware Agentic RAG 시스템을 90분 내에 배포하고, 권한 기반 검색의 동작을 체험합니다.

---

## 사전 요구 사항

| 항목 | 요건 |
|------|------|
| AWS 계정 | AdministratorAccess 상당의 권한 |
| AWS CLI | v2 설정 완료(`aws sts get-caller-identity`가 성공할 것) |
| Node.js | 22 이상 |
| Docker | 실행 중(`docker info`가 성공할 것) |
| CDK Bootstrap | 미실시인 경우 워크숍 내에서 실시 |
| Bedrock 모델 접근 | Claude Haiku / Sonnet, Titan Embed v2 활성화 |

---

## 아젠다

| 시간 | 섹션 | 내용 |
|------|------|------|
| 0:00–0:10 | 0. 소개 | 아키텍처 개요, 유스케이스 설명 |
| 0:10–0:40 | 1. 환경 배포 | 클론, 의존성, Bootstrap, 배포 |
| 0:40–0:55 | 2. 데모 데이터 투입 | 사용자 생성, 테스트 문서 배치 |
| 0:55–1:15 | 3. 권한 기반 RAG 테스트 | 다른 사용자로 검색, 결과 비교 |
| 1:15–1:25 | 4. 엔터프라이즈 가이드 확인 | 프로덕션 준비 체크리스트, 평가 템플릿 |
| 1:25–1:30 | 5. 정리 | 리소스 삭제, 비용 확인 |

---

## 0. 소개 (10분)

### 이 시스템이 해결하는 과제

```
기존 RAG:
  기업 파일 → AI에 전체 문서를 전달 → 누구나 모든 정보에 접근 가능
  → 권한 경계가 소멸 → 기밀 유출 위험

Permission-aware RAG:
  기업 파일 → 기존 ACL 유지 → 사용자별로 보이는 문서가 다름
  → 권한을 지키면서 AI 활용 → 보안과 편의성의 양립
```

### 아키텍처 (화이트보드용)

```
사용자 → CloudFront → Lambda (Next.js)
                            ↓
                  Bedrock KB Retrieve API
                            ↓
                  SID 필터링(애플리케이션 측)
                            ↓
                  허가된 문서만으로 응답 생성
```

---

## 1. 환경 배포 (30분)

### Step 1.1: 리포지토리 클론

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# 메인 리전
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# WAF용(CloudFront는 us-east-1 필수)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: 설정 파일 생성

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **주의**: `allowedCountries`를 참가자의 국가에 맞게 변경하세요.

### Step 1.4: Docker 이미지 준비 & 배포

```bash
# Docker 이미지 빌드
bash demo-data/scripts/pre-deploy-setup.sh

# 배포(약 30분)
npx cdk deploy --all --require-approval never
```

> 배포 중에 다음 섹션의 설명을 진행하면 시간을 효율적으로 활용할 수 있습니다.

---

## 2. 데모 데이터 투입 (15분)

### Step 2.1: 테스트 사용자 & 데이터 생성

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

이 스크립트는 다음을 실행합니다:
- Cognito 테스트 사용자 생성(admin@example.com, user@example.com)
- DynamoDB에 SID 데이터 등록
- S3에 테스트 문서 + `.metadata.json` 업로드
- Bedrock KB 데이터 소스 동기화

### Step 2.2: 접근 URL 취득

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. 권한 기반 RAG 테스트 (20분)

### 테스트 1: 관리자 사용자로 로그인

1. CloudFront URL에 접근
2. `admin@example.com` / 비밀번호(post-deploy-setup.sh 출력 확인)로 로그인
3. "회사의 매출에 대해 알려주세요"라고 질문
4. **기대 결과**: 150억 엔의 매출 정보를 포함한 응답(기밀 문서 참조)

### 테스트 2: 일반 사용자로 로그인

1. 로그아웃
2. `user@example.com`으로 로그인
3. 같은 질문 "회사의 매출에 대해 알려주세요"
4. **기대 결과**: 매출 정보 없음(공개 문서만 참조)

### 테스트 3: Agent 모드

1. 헤더의 모드 토글에서 "Agent"로 전환
2. "제품 카탈로그의 내용을 요약해 주세요"라고 질문
3. **기대 결과**: Agent가 KB 검색 도구를 사용하여 권한 범위 내에서 응답

### 확인 포인트

- [ ] 같은 질문에 다른 응답이 반환될 것
- [ ] Citation에 접근 레벨 배지가 표시될 것
- [ ] 일반 사용자에게 기밀 문서의 Citation이 표시되지 않을 것

---

## 4. 엔터프라이즈 가이드 확인 (10분)

다음 문서를 참가자에게 소개:

| 문서 | 확인 포인트 |
|------|------------|
| [프로덕션 준비 체크리스트](../production-readiness-checklist.md) | Demo/PoC/Production 성숙도 레벨 |
| [평가 템플릿](../evaluation.md) | PoC 평가 보고서 1페이지 요약 |
| [안전한 실험 가이드](../safe-experimentation-guide.md) | 실제 데이터 투입 전 체크리스트 |
| [위협 모델](../threat-model.md) | 10개 위협 카테고리와 대책 매핑 |

---

## 5. 정리 (5분)

```bash
# 전체 리소스 삭제
npx cdk destroy --all --force
```

> **주의**: FSx for ONTAP 삭제에 10~15분이 소요됩니다. 명령 완료 후에도 AWS 콘솔에서 삭제 상태를 확인하세요.

### 비용 확인

```bash
# 잔존 리소스 확인
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## 성공 기준

| 기준 | 확인 방법 |
|------|----------|
| 환경이 정상적으로 배포됨 | CloudFront URL에 접근 가능 |
| 다른 사용자로 다른 응답이 반환됨 | 테스트 1과 테스트 2 비교 |
| 권한 거부 시나리오가 Fail-Closed로 동작 | 일반 사용자에게 기밀 정보가 표시되지 않음 |
| 감사 로그가 생성됨 | CloudWatch Logs에 검색 로그 기록 |
| 정리가 완료됨 | 잔존 리소스 없음 |

---

## 문제 해결

| 문제 | 대처 |
|------|------|
| CDK Bootstrap 실패 | AWS CLI 인증 정보를 확인. `aws sts get-caller-identity`가 성공하는지 |
| Docker 빌드 실패 | Docker가 실행 중인지 확인. `docker info` |
| 배포가 40분 이상 | FSx for ONTAP 생성은 20~30분 소요되므로 정상 |
| 로그인 불가 | Cognito 사용자가 생성되었는지 확인. `post-deploy-setup.sh` 출력 확인 |
| 검색 결과가 0건 | KB 동기화가 완료되었는지 확인. 몇 분 기다린 후 재시도 |

---

## 다음 단계

워크숍 완료 후 다음을 검토:

1. **실제 데이터로 PoC**: [안전한 실험 가이드](../safe-experimentation-guide.md)에 따라 실제 데이터 투입
2. **평가**: [평가 템플릿](../evaluation.md)으로 PoC 결과를 정량 평가
3. **프로덕션 준비 검토**: [프로덕션 준비 체크리스트](../production-readiness-checklist.md)로 필요한 대책 확인

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../../README.ko.md) | 시스템 전체상, 배포 절차 |
| [safe-experimentation-guide.md](../safe-experimentation-guide.md) | 안전한 실험 가이드 |
| [evaluation.md](../evaluation.md) | RAG / Agent 평가 메트릭스 |
| [threat-model.md](../threat-model.md) | 위협 모델 |

---
