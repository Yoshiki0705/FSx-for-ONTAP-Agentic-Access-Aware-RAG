# Amazon FSx for NetApp ONTAP을 활용한 권한 인식 RAG 시스템

**🌐 Language / 언어:** [日本語](README.md) | [English](README.en.md) | **한국어** | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

이 리포지토리는 AWS CDK를 사용하여 Amazon Bedrock 기반의 접근 제어 인식 Agentic RAG를 배포하는 샘플입니다. Amazon FSx for NetApp ONTAP의 엔터프라이즈 데이터와 접근 권한을 활용합니다. FSx for ONTAP을 데이터 소스로 사용하여 ACL / 권한 정보를 고려한 검색 및 응답 생성을 구현합니다. 벡터 스토어는 Amazon S3 Vectors(기본값, 저비용) 또는 Amazon OpenSearch Serverless(고성능) 중에서 선택할 수 있습니다. AWS Lambda(Lambda Web Adapter) 위에서 Next.js 15로 구축된 카드 기반 태스크 지향 UI를 제공하며, 엔터프라이즈용 보안 RAG / AI 어시스턴트 구성을 검증할 수 있습니다.

---

## 아키텍처

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser   │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └────────┬─────────┘
                                          │ CIFS/SMB (Optional)
                                          ▼
                                 ┌──────────────────┐
                                 │ Embedding EC2    │
                                 │ (Titan Embed v2) │
                                 │ (Optional)       │
                                 └──────────────────┘
```

## 구현 개요 (8가지 관점)

이 시스템의 구현은 8가지 관점으로 구성되어 있습니다. 각 항목의 상세 내용은 [docs/implementation-overview.md](docs/implementation-overview.md)를 참조하세요.

| # | 관점 | 개요 | 관련 CDK 스택 |
|---|------|------|---------------|
| 1 | 챗봇 애플리케이션 | Lambda Web Adapter로 서버리스 실행되는 Next.js 15 (App Router). KB/Agent 모드 전환 지원. 카드 기반 태스크 지향 UI | WebAppStack |
| 2 | AWS WAF | 6개 규칙 구성: 속도 제한, IP 평판, OWASP 준수 규칙, SQLi 보호, IP 허용 목록 | WafStack |
| 3 | IAM 인증 | Lambda Function URL + CloudFront OAC를 활용한 다계층 보안 | WebAppStack |
| 4 | 벡터 DB | S3 Vectors(기본값, 저비용) / OpenSearch Serverless(고성능). `vectorStoreType`으로 선택 | AIStack |
| 5 | 임베딩 서버 | CIFS/SMB로 마운트된 FSx ONTAP 볼륨의 문서를 EC2에서 벡터화하여 AOSS에 기록 (AOSS 구성 전용) | EmbeddingStack |
| 6 | Titan Text Embeddings | KB 수집과 임베딩 서버 모두에서 `amazon.titan-embed-text-v2:0` (1024차원) 사용 | AIStack |
| 7 | SID 메타데이터 + 권한 필터링 | `.metadata.json`을 통해 NTFS ACL SID 정보를 관리하고 검색 시 사용자 SID 매칭으로 필터링 | StorageStack |
| 8 | KB/Agent 모드 전환 | KB 모드(문서 검색)와 Agent 모드(다단계 추론) 간 전환. Agent Directory(`/genai/agents`)에서 카탈로그 방식의 Agent 관리, 템플릿 생성, 편집, 삭제. 동적 Agent 생성 및 카드 바인딩. 출력 지향 워크플로우(프레젠테이션, 결재 문서, 회의록, 보고서, 계약서, 온보딩). 8개 언어 i18n 지원. 양쪽 모드 모두 권한 인식 | WebAppStack |
| 9 | 이미지 분석 RAG | 채팅 입력에 이미지 업로드(드래그 앤 드롭 / 파일 선택기) 추가. Bedrock Vision API(Claude Haiku 4.5)로 이미지를 분석하고 결과를 KB 검색 컨텍스트에 통합. JPEG/PNG/GIF/WebP 지원, 3MB 제한 | WebAppStack |
| 10 | KB 연결 UI | Agent 생성/편집 시 Bedrock Knowledge Base 선택, 연결, 해제를 위한 UI. Agent 상세 패널에 연결된 KB 목록 표시 | WebAppStack |
| 11 | 스마트 라우팅 | 쿼리 복잡도에 따른 자동 모델 선택. 짧은 사실 확인 쿼리는 경량 모델(Haiku)로, 긴 분석 쿼리는 고성능 모델(Sonnet)로 라우팅. 사이드바에 ON/OFF 토글 | WebAppStack |
| 12 | 모니터링 & 알림 | CloudWatch 대시보드(Lambda/CloudFront/DynamoDB/Bedrock/WAF/고급 RAG 통합), SNS 알림(오류율 & 지연 시간 임계값 알림), EventBridge KB 수집 작업 실패 알림, EMF 커스텀 메트릭. `enableMonitoring=true`로 활성화 | WebAppStack (MonitoringConstruct) |
| 13 | AgentCore Memory | AgentCore Memory를 통한 대화 컨텍스트 유지(단기 & 장기 메모리). 세션 내 대화 이력(단기) + 세션 간 사용자 선호도 & 요약(장기). `enableAgentCoreMemory=true`로 활성화 | AIStack |

## UI 스크린샷

### KB 모드 — 카드 그리드 (초기 상태)

채팅 영역의 초기 상태는 14개의 목적별 카드(8개 리서치 + 6개 출력)를 그리드 레이아웃으로 표시합니다. 카테고리 필터, 즐겨찾기 기능, InfoBanner(권한 정보)를 제공합니다.

![KB Mode Card Grid](docs/screenshots/kb-mode-cards-full.png)

### Agent 모드 — 카드 그리드 + 사이드바

Agent 모드는 14개의 워크플로우 카드(8개 리서치 + 6개 출력)를 표시합니다. 카드를 클릭하면 자동으로 Bedrock Agent를 검색하고, 아직 생성되지 않은 경우 Agent Directory 생성 폼으로 이동합니다. 사이드바에는 Agent 선택 드롭다운, 채팅 이력 설정, 접을 수 있는 시스템 관리 섹션이 포함됩니다.

![Agent Mode Card Grid](docs/screenshots/agent-mode-card-grid.png)

### Agent Directory — Agent 목록 & 관리 화면

`/[locale]/genai/agents`에서 접근할 수 있는 전용 Agent 관리 화면입니다. 생성된 Bedrock Agent의 카탈로그 표시, 검색 & 카테고리 필터, 상세 패널, 템플릿 기반 생성, 인라인 편집/삭제를 제공합니다. 내비게이션 바에서 Agent 모드 / Agent 목록 / KB 모드 간 전환이 가능합니다. 엔터프라이즈 기능이 활성화되면 "공유 Agent" 및 "예약 작업" 탭이 추가됩니다.

![Agent Directory](docs/screenshots/agent-directory-enterprise.png)

#### Agent Directory — 공유 Agent 탭

`enableAgentSharing=true`로 활성화됩니다. S3 공유 버킷에서 Agent 구성을 목록 조회, 미리보기, 가져오기할 수 있습니다.

![Shared Agents Tab](docs/screenshots/agent-directory-shared-tab.png)

### Agent Directory — Agent 생성 폼

템플릿 카드에서 "템플릿에서 생성"을 클릭하면 Agent 이름, 설명, 시스템 프롬프트, AI 모델을 편집할 수 있는 생성 폼이 표시됩니다. Agent 모드에서 아직 Agent가 생성되지 않은 카드를 클릭해도 동일한 폼이 나타납니다.

![Agent Creation Form](docs/screenshots/agent-creator-form.png)

### Agent Directory — Agent 상세 & 편집

Agent 카드를 클릭하면 Agent ID, 상태, 모델, 버전, 생성일, 시스템 프롬프트(접기 가능), 액션 그룹을 보여주는 상세 패널이 표시됩니다. 사용 가능한 작업에는 인라인 편집을 위한 "편집", Agent 모드로 이동하는 "채팅에서 사용", JSON 구성 다운로드를 위한 "내보내기", S3 공유를 위한 "공유 버킷에 업로드", 주기적 실행 설정을 위한 "스케줄 생성", 확인 대화상자가 있는 "삭제"가 포함됩니다.

![Agent Detail Panel](docs/screenshots/agent-detail-panel.png)

### 채팅 응답 — 인용 표시 + 접근 레벨 배지

RAG 검색 결과는 FSx 파일 경로와 접근 레벨 배지(전체 접근 가능 / 관리자 전용 / 특정 그룹)를 표시합니다. 채팅 중 "🔄 워크플로우 선택으로 돌아가기" 버튼으로 카드 그리드로 돌아갈 수 있습니다. 메시지 입력 필드 왼쪽의 "➕" 버튼으로 새 채팅을 시작합니다.

![Chat Response + Citation](docs/screenshots/kb-mode-chat-citation.png)

### 이미지 업로드 — 드래그 앤 드롭 + 파일 선택기 (v3.1.0)

채팅 입력 영역에 이미지 업로드 기능이 추가되었습니다. 드래그 앤 드롭 영역과 📎 파일 선택기 버튼으로 이미지를 첨부하고, Bedrock Vision API(Claude Haiku 4.5)로 분석하여 KB 검색 컨텍스트에 통합합니다. JPEG/PNG/GIF/WebP 지원, 3MB 제한.

![Image Upload Zone](docs/screenshots/kb-mode-image-upload-zone.png)

### 스마트 라우팅 — 비용 최적화 자동 모델 선택 (v3.1.0)

사이드바의 스마트 라우팅 토글을 ON으로 설정하면 쿼리 복잡도에 따라 경량 모델(Haiku) 또는 고성능 모델(Sonnet)을 자동으로 선택합니다. ModelSelector에 "⚡ Auto" 옵션이 추가되고, 응답에 사용된 모델 이름과 "Auto" 배지가 표시됩니다.

![Smart Routing ON + ResponseMetadata](docs/screenshots/kb-mode-response-metadata-auto.png)

### AgentCore Memory — 세션 목록 + 메모리 섹션 (v3.3.0)

`enableAgentCoreMemory=true`로 활성화됩니다. Agent 모드 사이드바에 세션 목록(SessionList)과 장기 메모리 표시(MemorySection)가 추가됩니다. 채팅 이력 설정은 "AgentCore Memory: Enabled" 배지로 대체됩니다.

![AgentCore Memory Sidebar](docs/screenshots/agent-mode-agentcore-memory-sidebar.png)

## CDK 스택 구조

| # | 스택 | 리전 | 리소스 | 설명 |
|---|------|------|--------|------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set | CloudFront용 WAF (속도 제한, 관리형 규칙) |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (선택 사항) | 네트워크 인프라 |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + Cognito Domain (AD Federation 활성화 시), AD Sync Lambda (선택 사항) | 인증 & 인가 |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD), KMS 암호화 (선택 사항), CloudTrail (선택 사항) | 스토리지, SID 데이터, 권한 캐시 |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (`vectorStoreType`으로 선택), Bedrock Guardrails (선택 사항) | RAG 검색 인프라 (Titan Embed v2) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront, Permission Filter Lambda (선택 사항), MonitoringConstruct (선택 사항) | 웹 애플리케이션, Agent 관리, 모니터링 & 알림 |
| 7 | EmbeddingStack (선택 사항) | ap-northeast-1 | EC2 (m5.large), ECR, ONTAP ACL 자동 검색 (선택 사항) | FlexCache CIFS 마운트 + 임베딩 서버 |

### 보안 기능 (6계층 방어)

| 계층 | 기술 | 목적 |
|------|------|------|
| L1: 네트워크 | CloudFront Geo Restriction | 지리적 접근 제한 (기본값: 일본만) |
| L2: WAF | AWS WAF (6개 규칙) | 공격 패턴 탐지 & 차단 |
| L3: 오리진 인증 | CloudFront OAC (SigV4) | CloudFront를 우회한 직접 접근 방지 |
| L4: API 인증 | Lambda Function URL IAM Auth | IAM 인증을 통한 접근 제어 |
| L5: 사용자 인증 | Cognito JWT / SAML Federation | 사용자 수준 인증 & 인가 |
| L6: 데이터 인가 | SID Filtering | 문서 수준 접근 제어 |

## 사전 요구 사항

- AWS 계정 (AdministratorAccess 동등 권한 필요)
- Node.js 22+, npm
- Docker (Colima, Docker Desktop, 또는 EC2의 docker.io)
- CDK 부트스트랩 완료 (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **참고**: 빌드는 로컬(macOS / Linux) 또는 EC2에서 실행할 수 있습니다. Apple Silicon(M1/M2/M3)의 경우, `pre-deploy-setup.sh`가 자동으로 프리빌드 모드(로컬 Next.js 빌드 + Docker 패키징)를 사용하여 x86_64 Lambda 호환 이미지를 생성합니다. EC2(x86_64)에서는 전체 Docker 빌드가 수행됩니다.

## 배포 단계

### 1단계: 환경 설정

로컬(macOS / Linux) 또는 EC2에서 실행할 수 있습니다.

#### 로컬 (macOS)

```bash
# Node.js 22+ (Homebrew)
brew install node@22

# Docker (둘 중 하나)
brew install --cask docker          # Docker Desktop (sudo 필요)
brew install docker colima          # Colima (sudo 불필요, 권장)
colima start --cpu 4 --memory 8     # Colima 시작

# AWS CDK
npm install -g aws-cdk typescript ts-node
```

#### EC2 (Ubuntu 22.04)

```bash
# 퍼블릭 서브넷에 t3.large 시작 (SSM 활성화된 IAM 역할 포함)
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

보안 그룹은 SSM Session Manager가 작동하려면 아웃바운드 443(HTTPS)만 열면 됩니다. 인바운드 규칙은 필요하지 않습니다.

### 2단계: 도구 설치 (EC2용)

SSM Session Manager로 연결한 후 다음을 실행합니다.

```bash
# 시스템 업데이트 + 기본 도구
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker 활성화
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK (글로벌)
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ CDK CLI 버전 참고 사항

`npm install -g aws-cdk`로 설치된 CDK CLI 버전이 프로젝트의 `aws-cdk-lib`과 호환되지 않을 수 있습니다.

```bash
# 확인 방법
cdk --version          # 글로벌 CLI 버전
npx cdk --version      # 프로젝트 로컬 CLI 버전
```

이 프로젝트는 `aws-cdk-lib@2.244.0`을 사용합니다. CLI 버전이 오래된 경우 다음 오류가 표시됩니다:

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**해결 방법**: 프로젝트 로컬 CDK CLI를 최신 버전으로 업데이트합니다.

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # 업데이트된 버전 확인
```

> **중요**: 프로젝트 로컬 최신 CLI를 사용하려면 `cdk` 대신 `npx cdk`를 사용하세요.

### 3단계: 리포지토리 클론 및 의존성 설치

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### 4단계: CDK 부트스트랩 (최초 1회만)

대상 리전에서 CDK 부트스트랩이 실행되지 않은 경우 실행합니다. WAF 스택이 us-east-1에 배포되므로 양쪽 리전 모두에서 부트스트랩이 필요합니다.

```bash
# ap-northeast-1 (메인 리전)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1 (WAF 스택용)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> **다른 AWS 계정에 배포하는 경우**: `cdk.context.json`에서 AZ 캐시(`availability-zones:account=...`)를 삭제하세요. CDK가 새 계정의 AZ 정보를 자동으로 가져옵니다.

### 5단계: CDK 컨텍스트 구성

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Active Directory 통합 (선택 사항)

FSx ONTAP SVM을 Active Directory 도메인에 가입시키고 CIFS 공유에서 NTFS ACL(SID 기반)을 사용하려면 `cdk.context.json`에 다음을 추가합니다.

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `adPassword` | string | 미설정 (AD 미생성) | AWS Managed Microsoft AD 관리자 비밀번호. 설정 시 AD를 생성하고 SVM을 도메인에 가입 |
| `adDomainName` | string | `demo.local` | AD 도메인 이름 (FQDN) |

> **참고**: AD 생성에는 추가로 20-30분이 소요됩니다. AD 없이도 SID 필터링 데모가 가능합니다 (DynamoDB SID 데이터를 사용하여 검증).

#### AD SAML Federation (선택 사항)

AD 사용자가 CloudFront UI에서 직접 로그인할 수 있도록 SAML 페더레이션을 활성화할 수 있으며, 자동 Cognito 사용자 생성 + 자동 DynamoDB SID 데이터 등록이 포함됩니다.

**아키텍처 개요:**

```
AD User → CloudFront UI → "Sign in with AD" button
  → Cognito Hosted UI → SAML IdP (AD) → AD Authentication
  → Automatic Cognito User Creation
  → Post-Auth Trigger → AD Sync Lambda → DynamoDB SID Data Registration
  → OAuth Callback → Session Cookie → Chat Screen
```

**CDK 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `enableAdFederation` | boolean | `false` | SAML 페더레이션 활성화 플래그 |
| `cloudFrontUrl` | string | 미설정 | OAuth 콜백 URL용 CloudFront URL (예: `https://d3xxxxx.cloudfront.net`) |
| `samlMetadataUrl` | string | 미설정 | 자체 관리 AD용: Entra ID 페더레이션 메타데이터 URL |
| `adEc2InstanceId` | string | 미설정 | 자체 관리 AD용: EC2 인스턴스 ID |

**Managed AD 패턴:**

AWS Managed Microsoft AD를 사용하는 경우.

> **⚠️ IAM Identity Center(구 AWS SSO) 구성이 필요합니다:**
> Managed AD SAML 메타데이터 URL(`portal.sso.{region}.amazonaws.com/saml/metadata/{directoryId}`)을 사용하려면 AWS IAM Identity Center를 활성화하고, Managed AD를 ID 소스로 구성하고, SAML 애플리케이션을 생성해야 합니다. Managed AD를 생성하는 것만으로는 SAML 메타데이터 엔드포인트가 제공되지 않습니다.
>
> IAM Identity Center 구성이 어려운 경우, `samlMetadataUrl` 파라미터를 통해 외부 IdP(AD FS 등) 메타데이터 URL을 직접 지정할 수도 있습니다.

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net",
  // 선택 사항: IAM Identity Center 이외의 SAML 메타데이터 URL을 사용하는 경우
  // "samlMetadataUrl": "https://your-adfs-server/federationmetadata/2007-06/federationmetadata.xml"
}
```

설정 단계:
1. `adPassword`를 설정하고 CDK 배포 (Managed AD + SAML IdP + Cognito Domain 생성)
2. AWS IAM Identity Center를 활성화하고 Managed AD를 ID 소스로 구성
3. IAM Identity Center에서 Cognito User Pool용 SAML 애플리케이션 생성 (또는 `samlMetadataUrl`로 외부 IdP 지정)
4. 배포 후 `cloudFrontUrl`에 CloudFront URL을 설정하고 재배포
5. CloudFront UI의 "Sign in with AD" 버튼에서 AD 인증 실행

**자체 관리 AD 패턴 (EC2, Entra Connect 통합):**

EC2의 AD를 Entra ID(구 Azure AD)와 통합하고 Entra ID 페더레이션 메타데이터 URL을 사용합니다.

```json
{
  "enableAdFederation": true,
  "adEc2InstanceId": "i-0123456789abcdef0",
  "samlMetadataUrl": "https://login.microsoftonline.com/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net"
}
```

설정 단계:
1. EC2에 AD DS를 설치하고 Entra Connect와 동기화 구성
2. Entra ID 페더레이션 메타데이터 URL 획득
3. 위 파라미터를 설정하고 CDK 배포
4. CloudFront UI의 "Sign in with AD" 버튼에서 AD 인증 실행

**패턴 비교:**

| 항목 | Managed AD | 자체 관리 AD |
|------|-----------|-------------|
| SAML 메타데이터 | IAM Identity Center 경유 또는 `samlMetadataUrl` 지정 | Entra ID 메타데이터 URL (`samlMetadataUrl` 지정) |
| SID 검색 방법 | LDAP 또는 SSM 경유 | SSM → EC2 → PowerShell |
| 필수 파라미터 | `adPassword`, `cloudFrontUrl` + IAM Identity Center 설정 (또는 `samlMetadataUrl`) | `adEc2InstanceId`, `samlMetadataUrl`, `cloudFrontUrl` |
| AD 관리 | AWS 관리형 | 사용자 관리 |
| 비용 | Managed AD 요금 | EC2 인스턴스 요금 |

**문제 해결:**

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| SAML 인증 실패 | 잘못된 SAML IdP 메타데이터 URL | Managed AD: IAM Identity Center 구성 확인, 또는 `samlMetadataUrl`로 직접 지정. 자체 관리: Entra ID 메타데이터 URL 확인 |
| OAuth 콜백 오류 | `cloudFrontUrl` 미설정 또는 불일치 | CDK 컨텍스트의 `cloudFrontUrl`이 CloudFront Distribution URL과 일치하는지 확인 |
| Post-Auth Trigger 실패 | AD Sync Lambda 권한 부족 | CloudWatch Logs에서 오류 상세 확인. 로그인 자체는 차단되지 않음 |
| KB 검색 시 S3 접근 오류 | KB IAM 역할에 직접 S3 버킷 접근 권한 부족 | KB IAM 역할은 S3 Access Point를 통한 권한만 보유. S3 버킷을 직접 데이터 소스로 사용하는 경우 `s3:GetObject` 및 `s3:ListBucket` 권한 추가 필요 (AD Federation에 한정되지 않음) |
| Cognito Domain 생성 실패 | 도메인 접두사 충돌 | `{projectName}-{environment}-auth` 접두사가 다른 계정과 충돌하는지 확인 |

#### 엔터프라이즈 기능 (선택 사항)

다음 CDK 컨텍스트 파라미터로 보안 강화 및 아키텍처 통합 기능을 활성화할 수 있습니다.

```json
{
  "useS3AccessPoint": "true",
  "usePermissionFilterLambda": "true",
  "enableGuardrails": "true",
  "enableKmsEncryption": "true",
  "enableCloudTrail": "true",
  "enableVpcEndpoints": "true"
}
```

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `ontapMgmtIp` | (없음) | ONTAP 관리 IP. 설정 시 임베딩 서버가 ONTAP REST API에서 `.metadata.json`을 자동 생성 |
| `ontapSvmUuid` | (없음) | SVM UUID (`ontapMgmtIp`와 함께 사용) |
| `ontapAdminSecretArn` | (없음) | ONTAP 관리자 비밀번호용 Secrets Manager ARN |
| `useS3AccessPoint` | `false` | S3 Access Point를 Bedrock KB 데이터 소스로 사용 |
| `usePermissionFilterLambda` | `false` | 전용 Lambda를 통한 SID 필터링 실행 (인라인 필터링 폴백 포함) |
| `enableGuardrails` | `false` | Bedrock Guardrails (유해 콘텐츠 필터 + PII 보호) |
| `enableAgent` | `false` | Bedrock Agent + 권한 인식 Action Group (KB 검색 + SID 필터링). 동적 Agent 생성 (카드 클릭 시 카테고리별 Agent 자동 생성 및 바인딩) |
| `enableAgentSharing` | `false` | Agent 구성 공유 S3 버킷. Agent 구성의 JSON 내보내기/가져오기, S3를 통한 조직 전체 공유 |
| `enableAgentSchedules` | `false` | Agent 예약 실행 인프라 (EventBridge Scheduler + Lambda + DynamoDB 실행 이력 테이블) |
| `enableKmsEncryption` | `false` | S3 & DynamoDB용 KMS CMK 암호화 (키 로테이션 활성화) |
| `enableCloudTrail` | `false` | CloudTrail 감사 로그 (S3 데이터 접근 + Lambda 호출, 90일 보존) |
| `enableVpcEndpoints` | `false` | VPC Endpoints (S3, DynamoDB, Bedrock, SSM, Secrets Manager, CloudWatch Logs) |
| `enableMonitoring` | `false` | CloudWatch 대시보드 + SNS 알림 + EventBridge KB 수집 모니터링. 비용: 대시보드 $3/월 + 알람 $0.10/알람/월 |
| `monitoringEmail` | *(없음)* | 알림 통지 이메일 주소 (`enableMonitoring=true` 시 유효) |
| `enableAgentCoreMemory` | `false` | AgentCore Memory 활성화 (단기 & 장기 메모리). `enableAgent=true` 필요 |
| `enableAgentCoreObservability` | `false` | AgentCore Runtime 메트릭을 대시보드에 통합 (`enableMonitoring=true` 시 유효) |
| `enableAdvancedPermissions` | `false` | 시간 기반 접근 제어 + 권한 판정 감사 로그. `permission-audit` DynamoDB 테이블 생성 |
| `alarmEvaluationPeriods` | `1` | 알람 평가 기간 수 (N회 연속 임계값 초과 시 알람 발생) |
| `dashboardRefreshInterval` | `300` | 대시보드 자동 새로고침 간격 (초) |

#### 벡터 스토어 구성 선택

`vectorStoreType` 파라미터로 벡터 스토어를 전환합니다. 기본값은 S3 Vectors(저비용)입니다.

| 구성 | 비용 | 지연 시간 | 권장 용도 |
|------|------|----------|----------|
| `s3vectors` (기본값) | 월 수 달러 | 1초 미만 ~ 100ms | 데모, 개발, 비용 최적화 |

#### 기존 FSx for ONTAP 사용

FSx for ONTAP 파일 시스템이 이미 존재하는 경우, 새로 생성하는 대신 기존 리소스를 참조할 수 있습니다. 이를 통해 배포 시간이 크게 단축됩니다 (FSx ONTAP 생성의 30-40분 대기 제거).

```bash
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c existingFileSystemId=fs-0123456789abcdef0 \
  -c existingSvmId=svm-0123456789abcdef0 \
  -c existingVolumeId=fsvol-0123456789abcdef0 \
  -c vectorStoreType=s3vectors \
  -c enableAgent=true
```

| 파라미터 | 설명 |
|----------|------|
| `existingFileSystemId` | 기존 FSx ONTAP 파일 시스템 ID (예: `fs-0123456789abcdef0`) |
| `existingSvmId` | 기존 SVM ID (예: `svm-0123456789abcdef0`) |
| `existingVolumeId` | 기존 Volume ID (예: `fsvol-0123456789abcdef0`) |

> **참고**: 기존 FSx 참조 모드에서는 FSx/SVM/Volume이 CDK 관리 범위 밖에 있습니다. `cdk destroy`로 삭제되지 않습니다. Managed AD도 생성되지 않습니다 (기존 환경의 AD 설정 사용).

| 구성 | 비용 | 지연 시간 | 권장 용도 | 메타데이터 제약 |
|------|------|----------|----------|----------------|
| `s3vectors` (기본값) | 월 수 달러 | 1초 미만 ~ 100ms | 데모, 개발, 비용 최적화 | filterable 2KB 제한 (아래 참조) |
| `opensearch-serverless` | ~$700/월 | ~10ms | 고성능 프로덕션 환경 | 제약 없음 |

```bash
# S3 Vectors 구성 (기본값)
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=s3vectors

# OpenSearch Serverless 구성
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=opensearch-serverless
```

S3 Vectors 구성으로 실행 중 고성능이 필요한 경우, `demo-data/scripts/export-to-opensearch.sh`를 사용하여 온디맨드로 OpenSearch Serverless로 내보낼 수 있습니다. 자세한 내용은 [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md)를 참조하세요.

### 6단계: 사전 배포 설정 (ECR 이미지 준비)

WebApp 스택은 ECR 리포지토리의 Docker 이미지를 참조하므로, CDK 배포 전에 이미지를 준비해야 합니다.

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
1. ECR 리포지토리 생성 (`permission-aware-rag-webapp`)
2. Docker 이미지 빌드 및 푸시

빌드 모드는 호스트 아키텍처에 따라 자동으로 선택됩니다:

| 호스트 | 빌드 모드 | 설명 |
|--------|----------|------|
| x86_64 (EC2 등) | 전체 Docker 빌드 | Dockerfile 내에서 npm install + next build |
| arm64 (Apple Silicon) | 프리빌드 모드 | 로컬 next build → Docker 패키징 |

> **소요 시간**: EC2 (x86_64): 3-5분, 로컬 (Apple Silicon): 5-8분, CodeBuild: 5-10분

> **Apple Silicon 참고**: `docker buildx`가 필요합니다 (`brew install docker-buildx`). ECR에 푸시할 때 `--provenance=false`를 지정하세요 (Lambda가 manifest list 형식을 지원하지 않기 때문).

### 7단계: CDK 배포

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

엔터프라이즈 기능을 활성화하려면:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableAgentSharing=true \
  -c enableAgentSchedules=true \
  --require-approval never
```

모니터링 & 알림을 활성화하려면:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  --require-approval never
```

> **모니터링 비용 추정**: CloudWatch Dashboard $3/월 + Alarms $0.10/알람/월 (7개 알람 = $0.70/월) + SNS 알림은 프리 티어 범위 내. 총 약 $4/월.

> **소요 시간**: FSx for ONTAP 생성에 20-30분이 걸리므로 총 약 30-40분 소요됩니다.

### 8단계: 배포 후 설정 (단일 명령)

CDK 배포가 완료되면 이 단일 명령으로 모든 설정이 완료됩니다:

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
1. S3 Access Point 생성 + 정책 구성
2. FSx ONTAP에 데모 데이터 업로드 (S3 AP 경유)
3. Bedrock KB 데이터 소스 추가 + 동기화
4. DynamoDB에 사용자 SID 데이터 등록
5. Cognito에 데모 사용자 생성 (admin / user)

> **소요 시간**: 2-5분 (KB 동기화 대기 포함)

### 9단계: 배포 검증 (자동화 테스트)

자동화 테스트 스크립트를 실행하여 모든 기능을 검증합니다.

```bash
bash demo-data/scripts/verify-deployment.sh
```

테스트 결과는 `docs/test-results.md`에 자동 생성됩니다. 검증 항목:
- 스택 상태 (전체 6개 스택 CREATE/UPDATE_COMPLETE)
- 리소스 존재 여부 (Lambda URL, KB, Agent)
- 애플리케이션 응답 (로그인 페이지 HTTP 200)
- KB 모드 권한 인식 (admin: 모든 문서 허용, user: public만)
- Agent 모드 권한 인식 (Action Group SID 필터링)
- S3 Access Point (AVAILABLE)
- 엔터프라이즈 Agent 기능 (S3 공유 버킷, DynamoDB 실행 이력 테이블, 스케줄러 Lambda, Sharing/Schedules API 응답) *`enableAgentSharing`/`enableAgentSchedules` 활성화 시에만

### 10단계: 브라우저 접근

CloudFormation 출력에서 URL을 가져와 브라우저에서 접근합니다.

```bash
aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### 리소스 정리

모든 리소스(CDK 스택 + 수동 생성 리소스)를 한 번에 삭제하는 스크립트를 사용합니다:

```bash
bash demo-data/scripts/cleanup-all.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
1. 수동 생성 리소스 삭제 (S3 AP, ECR, CodeBuild)
2. Bedrock KB 데이터 소스 삭제 (CDK destroy 전 필요)
3. 동적으로 생성된 Bedrock Agent 삭제 (CDK 관리 범위 밖의 Agent)
4. 엔터프라이즈 Agent 기능 리소스 삭제 (EventBridge Scheduler 스케줄 & 그룹, S3 공유 버킷)
5. Embedding 스택 삭제 (존재하는 경우)
6. CDK destroy (전체 스택)
7. 잔여 스택 개별 삭제 + 고아 AD SG 삭제
8. VPC 내 CDK 비관리 EC2 인스턴스 & SG 삭제 + Networking 스택 재삭제
9. CDKToolkit + CDK 스테이징 S3 버킷 삭제 (양쪽 리전, 버전 관리 대응)

> **참고**: FSx ONTAP 삭제에 20-30분이 걸리므로 총 약 30-40분 소요됩니다.

## 문제 해결

### WebApp 스택 생성 실패 (ECR 이미지 미발견)

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `Source image ... does not exist` | ECR 리포지토리에 Docker 이미지 없음 | 먼저 `bash demo-data/scripts/pre-deploy-setup.sh`를 실행 |

> **중요**: 새 계정의 경우 CDK 배포 전에 반드시 `pre-deploy-setup.sh`를 실행하세요. WebApp 스택은 ECR의 `permission-aware-rag-webapp:latest` 이미지를 참조합니다.

### CDK CLI 버전 불일치

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `Cloud assembly schema version mismatch` | 글로벌 CDK CLI가 오래됨 | `npm install aws-cdk@latest`로 프로젝트 로컬을 업데이트하고 `npx cdk` 사용 |

### CloudFormation Hook으로 인한 배포 실패

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]` | 조직 수준 CloudFormation Hook이 ChangeSet을 차단 | `--method=direct` 옵션을 추가하여 ChangeSet 우회 |

```bash
# CloudFormation Hook이 활성화된 환경에서 배포
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never

# 부트스트랩도 직접 생성을 위해 create-stack 사용
aws cloudformation create-stack --stack-name CDKToolkit \
  --template-body file://cdk-bootstrap-template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

### Docker 권한 오류

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `permission denied while trying to connect to the Docker daemon` | 사용자가 docker 그룹에 없음 | `sudo usermod -aG docker ubuntu && newgrp docker` |

### AgentCore Memory 배포 실패

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `EarlyValidation::PropertyValidation` | CfnMemory 속성이 스키마에 부합하지 않음 | Name에 하이픈 사용 불가 (`_`로 대체), EventExpiryDuration은 일 단위 (최소:3, 최대:365) |
| `Please provide a role with a valid trust policy` | Memory IAM 역할의 서비스 프린시펄이 잘못됨 | `bedrock-agentcore.amazonaws.com` 사용 (`bedrock.amazonaws.com`이 아님) |
| `actorId failed to satisfy constraint` | 이메일 주소의 `@` `.`가 actorId에 포함 | `lib/agentcore/auth.ts`에서 이미 처리됨: `@` → `_at_`, `.` → `_dot_` |
| `AccessDeniedException: bedrock-agentcore:CreateEvent` | Lambda 실행 역할에 AgentCore 권한 부족 | `enableAgentCoreMemory=true`로 CDK 배포 시 자동 추가 |
| `exec format error` (Lambda 시작 실패) | Docker 이미지 아키텍처와 Lambda 불일치 | Lambda는 x86_64. Apple Silicon에서는 `docker buildx` + `--platform linux/amd64` 사용 |

### SSM Session Manager 연결 실패

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| SSM에 인스턴스가 표시되지 않음 | IAM 역할 미구성 또는 아웃바운드 443 차단 | IAM 인스턴스 프로파일과 SG 아웃바운드 규칙 확인 |

### `cdk destroy` 시 삭제 순서 문제

환경 삭제 시 다음 문제가 순서대로 발생할 수 있습니다.

#### 알려진 문제: Storage 스택 UPDATE_ROLLBACK_COMPLETE

CDK 템플릿 변경(S3 AP 커스텀 리소스 속성 변경 등) 후 `cdk deploy --all`을 실행하면 Storage 스택이 UPDATE_ROLLBACK_COMPLETE 상태가 될 수 있습니다.

- **영향**: `cdk deploy --all` 실패. 리소스 자체는 정상 작동
- **해결 방법**: `npx cdk deploy <STACK> --exclusively`로 개별 스택 업데이트
- **근본 해결**: `cdk destroy`로 전체 삭제 후 클린 배포

#### 문제 1: Embedding 스택이 남아있으면 AI 스택 삭제 불가

`enableEmbeddingServer=true`로 배포한 경우, `cdk destroy --all`이 Embedding 스택을 인식하지 못합니다 (CDK 컨텍스트에 의존하기 때문).

```bash
# 먼저 Embedding 스택을 수동 삭제
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1

# 그 후 cdk destroy 실행
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force
```

#### 문제 2: Bedrock KB에 데이터 소스가 남아있으면 삭제 실패

데이터 소스가 연결된 상태에서는 KB를 삭제할 수 없습니다. AI 스택 삭제가 `DELETE_FAILED`인 경우:

```bash
# 먼저 데이터 소스 삭제
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
DS_IDS=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
  --query 'dataSourceSummaries[].dataSourceId' --output text)
for DS_ID in $DS_IDS; do
  aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
done
sleep 10

# AI 스택 삭제 재시도
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-AI --region ap-northeast-1
```

#### 문제 3: S3 Access Point가 연결되어 있으면 FSx 볼륨 삭제 실패

S3 AP가 연결된 상태에서는 Storage 스택의 FSx ONTAP 볼륨을 삭제할 수 없습니다:

```bash
# S3 AP 분리 및 삭제
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1
sleep 30

# Storage 스택 삭제 재시도
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Storage --region ap-northeast-1
```

#### 문제 4: 고아 AD Controller SG가 VPC 삭제를 차단

Managed AD를 사용하는 경우, AD 삭제 후에도 AD Controller SG가 남아있을 수 있습니다:

```bash
# 고아 SG 식별
VPC_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
  --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text

# SG 삭제
aws ec2 delete-security-group --group-id <SG_ID> --region ap-northeast-1

# Networking 스택 삭제 재시도
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
```

#### 문제 5: VPC 서브넷에 EC2 인스턴스가 남아있으면 Networking 스택 삭제 실패

CDK 비관리 EC2 인스턴스(Docker 빌드 EC2 등)가 VPC 서브넷에 남아있으면 `cdk destroy`로 인해 Networking 스택이 `DELETE_FAILED` 상태가 됩니다.

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| `The subnet 'subnet-xxx' has dependencies and cannot be deleted` | 서브넷에 CDK 비관리 EC2 존재 | EC2 종료 → SG 삭제 → 키 페어 삭제 → 스택 삭제 재시도 |

```bash
# VPC 내 EC2 인스턴스 식별
VPC_ID="vpc-xxx"
aws ec2 describe-instances --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[].Instances[].{Id:InstanceId,Name:Tags[?Key==`Name`].Value|[0]}' --output table

# EC2 종료
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
aws ec2 wait instance-terminated --instance-ids <INSTANCE_ID>

# 잔여 SG 삭제
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[?GroupName!=`default`].{Id:GroupId,Name:GroupName}' --output table
aws ec2 delete-security-group --group-id <SG_ID>

# 키 페어 삭제 (더 이상 필요하지 않은 경우)
aws ec2 delete-key-pair --key-name <KEY_NAME>

# Networking 스택 삭제 재시도
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking
```

#### 문제 6: 버전 관리로 인한 CDK 스테이징 S3 버킷 삭제 실패

CDK 부트스트랩으로 생성된 S3 스테이징 버킷(`cdk-hnb659fds-assets-*`)은 버전 관리가 활성화되어 있습니다. `aws s3 rb --force`는 오브젝트 버전과 DeleteMarker를 남겨 버킷 삭제가 실패합니다.

```bash
# 버킷 삭제 전에 모든 버전과 DeleteMarker 삭제
BUCKET="cdk-hnb659fds-assets-ACCOUNT_ID-REGION"

# 오브젝트 버전 삭제
aws s3api list-object-versions --bucket "$BUCKET" \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json | \
  aws s3api delete-objects --bucket "$BUCKET" --delete file:///dev/stdin

# DeleteMarker 삭제
aws s3api list-object-versions --bucket "$BUCKET" \
  --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json | \
  aws s3api delete-objects --bucket "$BUCKET" --delete file:///dev/stdin

# 버킷 삭제
aws s3api delete-bucket --bucket "$BUCKET"
```

#### 문제 5: 빌드 EC2가 서브넷 삭제를 차단

빌드 EC2 인스턴스가 VPC에 남아있으면 Networking 스택 서브넷 삭제가 실패합니다:

```bash
# 빌드 EC2 종료
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[?Tags[?Key==`Name` && contains(Value, `build`)]].InstanceId' \
  --output text --region ap-northeast-1
aws ec2 terminate-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1

# 60초 대기 후 Networking 스택 삭제 재시도
sleep 60
aws cloudformation delete-stack --stack-name <PREFIX>-Networking --regio
```

#### 문제 6: 기존 FSx 참조 모드에서의 cdk destroy

`existingFileSystemId`를 지정하여 배포한 경우, `cdk destroy`는 FSx/SVM/Volume을 삭제하지 않습니다 (CDK 관리 범위 밖). S3 Vectors 벡터 버킷과 인덱스는 정상적으로 삭제됩니다.

#### 권장: 전체 정리 스크립트

위 문제를 방지하기 위한 전체 삭제 절차가 `demo-data/scripts/cleanup-all.sh`에 자동화되어 있습니다:

```bash
bash demo-data/scripts/cleanup-all.sh
```

이 스크립트는 다음을 순서대로 실행합니다:
1. 수동 생성 리소스 삭제 (S3 AP, ECR, CodeBuild, CodeBuild S3 버킷)
2. Bedrock KB 데이터 소스 삭제 (CDK destroy 전 필요)
3. 동적으로 생성된 Bedrock Agent 삭제 (CDK 관리 범위 밖의 Agent)
4. 엔터프라이즈 Agent 기능 리소스 삭제 (EventBridge Scheduler 스케줄 & 그룹, S3 공유 버킷)
5. Embedding 스택 삭제 (존재하는 경우)
6. CDK destroy (전체 스택)
7. 잔여 스택 개별 삭제 + 고아 AD SG 삭제
8. VPC 내 CDK 비관리 EC2 인스턴스 & SG 삭제 + Networking 스택 재삭제
9. CDKToolkit + CDK 스테이징 S3 버킷 삭제 (양쪽 리전, 버전 관리 대응)

## WAF & 지리적 제한 구성

### WAF 규칙 구성

CloudFront WAF는 `us-east-1`에 배포되며 6개 규칙(우선순위 순서로 평가)으로 구성됩니다.

| 우선순위 | 규칙 이름 | 타입 | 설명 |
|----------|----------|------|------|
| 100 | RateLimit | Custom | 단일 IP 주소가 5분 내 3000건 초과 시 차단 |
| 200 | AWSIPReputationList | AWS Managed | 봇넷, DDoS 소스 등 악성 IP 주소 차단 |
| 300 | AWSCommonRuleSet | AWS Managed | OWASP Top 10 준수 일반 규칙 (XSS, LFI, RFI 등). RAG 요청 호환성을 위해 `GenericRFI_BODY`, `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` 제외 |
| 400 | AWSKnownBadInputs | AWS Managed | Log4j(CVE-2021-44228) 등 알려진 취약점을 악용하는 요청 차단 |
| 500 | AWSSQLiRuleSet | AWS Managed | SQL 인젝션 공격 패턴 탐지 및 차단 |
| 600 | IPAllowList | Custom (선택 사항) | `allowedIps` 구성 시에만 활성화. 목록에 없는 IP 차단 |

### 지리적 제한

CloudFront 수준에서 지리적 접근 제한을 적용합니다. WAF와는 별도의 보호 계층입니다.

- 기본값: 일본(`JP`)만
- CloudFront의 `GeoRestriction.allowlist`로 구현
- 허용되지 않은 국가에서의 접근은 `403 Forbidden` 반환

### 구성

`cdk.context.json`에서 다음 값을 수정합니다.

```json
{
  "allowedIps": ["203.0.113.0/24", "198.51.100.1/32"],
  "allowedCountries": ["JP", "US"]
}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `allowedIps` | string[] | `[]` (제한 없음) | 허용 IP 주소 CIDR 목록. 비어있으면 IP 필터 규칙 자체가 생성되지 않음 |
| `allowedCountries` | string[] | `["JP"]` | CloudFront Geo 제한에서 허용하는 국가 코드 (ISO 3166-1 alpha-2) |

### 커스터마이징 예시

속도 제한 임계값을 변경하거나 규칙을 추가/제외하려면 `lib/stacks/demo/demo-waf-stack.ts`를 직접 편집합니다.

```typescript
// 속도 제한을 1000 req/5min으로 변경
rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' },

// Common Rule Set 제외 규칙 변경
excludedRules: [
  { name: 'GenericRFI_BODY' },
  { name: 'SizeRestrictions_BODY' },
  // 이 줄을 제거하면 CrossSiteScripting_BODY가 제외 목록에서 제거됨 (활성화)
],
```

변경 후 `npx cdk deploy --all --app "npx ts-node bin/demo-app.ts"`로 적용합니다. WAF 스택은 `us-east-1`에 배포되므로 크로스 리전 배포가 자동으로 수행됩니다.

## 임베딩 서버 (선택 사항)

FlexCache Cache 볼륨을 CIFS로 마운트하여 임베딩을 수행하는 EC2 서버입니다. FSx ONTAP S3 Access Point를 사용할 수 없는 경우(2026년 3월 기준 FlexCache Cache 볼륨에서 미지원)의 대체 경로로 사용됩니다.

### 데이터 수집 경로

이 시스템은 단일 경로 아키텍처를 사용합니다: FSx ONTAP → S3 Access Point → Bedrock KB. Bedrock KB가 모든 문서 검색, 청킹, 벡터화, 저장을 관리합니다.

```
FSx ONTAP Volume (/data)
  ├── public/company-overview.md
  ├── public/company-overview.md.metadata.json
  ├── confidential/financial-report.md
  ├── confidential/financial-report.md.metadata.json
  └── ...
      │ S3 Access Point
      ▼
  Bedrock KB Data Source (S3 AP alias)
      │ Ingestion Job (chunking + vectorization with Titan Embed v2)
      ▼
  Vector Store (selected via vectorStoreType)
    ├── S3 Vectors (default: low cost, sub-second latency)
    └── OpenSearch Serverless (high performance, ~$700/month)
```

Bedrock KB Ingestion Job이 수행하는 처리:
1. S3 Access Point를 통해 FSx ONTAP에서 문서와 `.metadata.json` 읽기
2. 문서 청킹
3. Amazon Titan Embed Text v2(1024차원)로 벡터화
4. 벡터 + 메타데이터(`allowed_group_sids` 포함)를 벡터 스토어에 저장

> **Ingestion Job 할당량 및 설계 고려 사항**: 작업당 100GB/파일당 50MB, 동일 KB에 대한 병렬 동기화 불가, StartIngestionJob API 속도 0.1 req/sec(10초에 1회) 등의 제약이 있습니다. 주기적 동기화 스케줄링 방법 등 자세한 내용은 [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md#bedrock-kb-ingestion-job--クォータと設計考慮点)를 참조하세요.

검색 흐름:
```
App → Bedrock KB Retrieve API → Vector Store (vector search)
  → Search results + metadata (allowed_group_sids) returned
  → App-side SID filtering → Converse API (response generation)
```

### 임베딩 대상 문서 구성

Bedrock KB에 임베딩되는 문서는 FSx ONTAP 볼륨의 파일 구조에 의해 결정됩니다.

#### 디렉토리 구조와 SID 메타데이터

```
FSx ONTAP Volume (/data)
  ├── public/                          ← 모든 사용자 접근 가능
  │   ├── product-catalog.md           ← 문서 본문
  │   └── product-catalog.md.metadata.json  ← SID 메타데이터
  ├── confidential/                    ← 관리자 전용
  │   ├── financial-report.md
  │   └── financial-report.md.metadata.json
  └── restricted/                      ← 특정 그룹 전용
      ├── project-plan.md
      └── project-plan.md.metadata.json
```

#### .metadata.json 형식

각 문서에 대응하는 `.metadata.json` 파일에 SID 기반 접근 제어를 설정합니다.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public",
    "doc_type": "catalog"
  }
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `allowed_group_sids` | ✅ | 접근이 허용된 SID의 JSON 배열 문자열. `S-1-1-0`은 Everyone |
| `access_level` | 선택 사항 | UI 표시용 접근 레벨 (`public`, `confidential`, `restricted`) |
| `doc_type` | 선택 사항 | 문서 유형 (향후 필터링용) |

#### 주요 SID 값

| SID | 이름 | 용도 |
|-----|------|------|
| `S-1-1-0` | Everyone | 모든 사용자에게 공개된 문서 |
| `S-1-5-21-...-512` | Domain Admins | 관리자만 접근 가능한 문서 |
| `S-1-5-21-...-1100` | Engineering | 엔지니어링 그룹용 문서 |

> **상세 내용**: SID 필터링 메커니즘에 대해서는 [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md)를 참조하세요.

#### S3 Vectors 메타데이터 제약 및 고려 사항

S3 Vectors 구성(`vectorStoreType=s3vectors`) 사용 시 다음 메타데이터 제약에 유의하세요.

| 제약 | 값 | 영향 |
|------|-----|------|
| 필터링 가능 메타데이터 | 2KB/벡터 | Bedrock KB 내부 메타데이터(~1KB) 포함 시 커스텀 메타데이터는 실질적으로 **1KB 이하** |
| 필터링 불가 메타데이터 키 | 최대 10개 키/인덱스 | Bedrock KB 자동 키(5개) + 커스텀 키(5개)로 한도 도달 |
| 전체 메타데이터 | 40KB/벡터 | 일반적으로 문제 없음 |

CDK 코드에 다음 완화 조치가 구현되어 있습니다:
- Bedrock KB 자동 할당 메타데이터 키(`x-amz-bedrock-kb-chunk-id` 등, 5개 키)를 `nonFilterableMetadataKeys`로 설정
- `allowed_group_sids`를 포함한 모든 커스텀 메타데이터도 필터링 불가로 설정
- SID 필터링은 Bedrock KB Retrieve API 메타데이터 반환 + 앱 측 매칭으로 구현 (S3 Vectors QueryVectors 필터 미사용)

커스텀 메타데이터 추가 시 주의 사항:
- `.metadata.json`의 키 수를 5개 이하로 유지 (필터링 불가 키 10개 한도)
- 값 크기를 작게 유지 (단축 SID 값 권장, 예: `S-1-5-21-...-512` → `S-1-5-21-512`)
- PDF 파일은 페이지 번호 메타데이터가 자동 할당되어 커스텀 메타데이터 합계가 2KB를 초과하기 쉬움
- OpenSearch Serverless 구성(`vectorStoreType=opensearch-serverless`)에는 이러한 제약 없음

> **상세 내용**: S3 Vectors 메타데이터 제약 검증 결과에 대해서는 [docs/s3-vectors-sid-architecture-guide.md](docs/s3-vectors-sid-architecture-guide.md)를 참조하세요.

### 데이터 수집 경로 선택

| 경로 | 방법 | CDK 활성화 | 상태 |
|------|------|-----------|------|
| 메인 | FSx ONTAP → S3 Access Point → Bedrock KB → Vector Store | CDK 배포 후 `post-deploy-setup.sh` 실행 | ✅ |
| 폴백 | 직접 S3 버킷 업로드 → Bedrock KB → Vector Store | 수동 (`upload-demo-data.sh`) | ✅ |
| 대체 (선택 사항) | 임베딩 서버 (CIFS 마운트) → 직접 AOSS 기록 | `-c enableEmbeddingServer=true` | ✅ (AOSS 구성 전용) |

> **폴백 경로**: FSx ONTAP S3 AP를 사용할 수 없는 경우(예: Organization SCP 제한), 문서 + `.metadata.json`을 S3 버킷에 직접 업로드하고 KB 데이터 소스로 구성할 수 있습니다. SID 필터링은 데이터 소스 유형에 의존하지 않습니다.

### 임베딩 대상 문서의 수동 관리

CDK 배포 없이 임베딩 대상 문서를 추가, 수정, 삭제할 수 있습니다.

#### 문서 추가

FSx ONTAP S3 Access Point 경유 (메인 경로):

```bash
# VPC 내 EC2 또는 WorkSpaces에서 SMB를 통해 FSx ONTAP에 파일 배치
SVM_IP=<SVM_SMB_IP>
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put new-document.md; put new-document.md.metadata.json"

# KB 동기화 실행 (문서 추가 후 필요)
# S3 AP 데이터 소스의 경우, Bedrock KB가 S3 AP를 통해 FSx에서 파일을 자동 검색
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

직접 S3 버킷 업로드 (폴백 경로):

```bash
# S3 버킷에 문서 + 메타데이터 업로드
aws s3 cp new-document.md s3://<DATA_BUCKET>/public/new-document.md
aws s3 cp new-document.md.metadata.json s3://<DATA_BUCKET>/public/new-document.md.metadata.json

# KB 동기화
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 문서 업데이트

문서를 덮어쓴 후 KB 동기화를 다시 실행합니다. Bedrock KB가 변경된 문서를 자동으로 감지하여 재임베딩합니다.

```bash
# SMB를 통해 문서 덮어쓰기
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put updated-document.md product-catalog.md"

# KB 동기화 (변경 감지 + 재임베딩)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 문서 삭제

```bash
# SMB를 통해 문서 삭제
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; del old-document.md; del old-document.md.metadata.json"

# KB 동기화 (삭제 감지 + 벡터 스토어에서 제거)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### SID 메타데이터 변경 (접근 권한 변경)

문서 접근 권한을 변경하려면 `.metadata.json`을 업데이트하고 KB 동기화를 실행합니다.

```bash
# 예: 공개 문서를 기밀로 변경
cat > financial-report.md.metadata.json << 'EOF'
{"metadataAttributes":{"allowed_group_sids":"[\"S-1-5-21-...-512\"]","access_level":"confidential","doc_type":"financial"}}
EOF

smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd confidential; put financial-report.md.metadata.json"

# KB 동기화
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

### FSx for ONTAP 볼륨 임베딩 대상 관리

기존 FSx ONTAP 볼륨을 Bedrock KB 임베딩 대상으로 추가하거나 제거하는 절차입니다. 볼륨 생성/삭제 자체는 FSx 관리자가 수행합니다.

#### 볼륨을 임베딩 대상으로 추가

```bash
# 1. 대상 볼륨용 S3 Access Point 생성
aws fsx create-and-attach-s3-access-point \
  --name <S3AP_NAME> \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "<VOLUME_ID>",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "demo.local\\Admin"}
    }
  }' --region ap-northeast-1

# S3 AP가 AVAILABLE이 될 때까지 대기 (약 1분)
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[?Name==\`<S3AP_NAME>\`].Lifecycle' --output text"

# 2. S3 AP 정책 구성
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
aws s3control put-access-point-policy \
  --account-id $ACCOUNT_ID \
  --name <S3AP_NAME> \
  --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::'$ACCOUNT_ID':root"},"Action":"s3:*","Resource":["arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/<S3AP_NAME>","arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/<S3AP_NAME>/object/*"]}]}' \
  --region ap-northeast-1

# 3. Bedrock KB 데이터 소스로 등록
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[?Name==`<S3AP_NAME>`].S3AccessPoint.Alias' --output text)

aws bedrock-agent create-data-source \
  --knowledge-base-id <KB_ID> \
  --name "<DATA_SOURCE_NAME>" \
  --data-source-configuration '{"type":"S3","s3Configuration":{"bucketArn":"arn:aws:s3:::'$S3AP_ALIAS'"}}' \
  --region ap-northeast-1

# 4. KB 동기화 실행 (볼륨의 문서 임베딩)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### 볼륨을 임베딩 대상에서 제거

```bash
# 1. Bedrock KB에서 데이터 소스 삭제 (벡터 스토어에서도 제거)
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1

# 2. S3 Access Point 삭제
aws fsx detach-and-delete-s3-access-point \
  --name <S3AP_NAME> --region ap-northeast-1
```

> **참고**: 데이터 소스를 삭제하면 벡터 스토어에서 해당 벡터도 제거됩니다. 볼륨의 파일 자체에는 영향이 없습니다.

#### 현재 임베딩 대상 볼륨 확인

```bash
# 등록된 데이터 소스 목록
aws bedrock-agent list-data-sources \
  --knowledge-base-id <KB_ID> \
  --region ap-northeast-1 \
  --query 'dataSourceSummaries[*].{name:name,id:dataSourceId,status:status}'

# S3 AP 목록 (FSx ONTAP 볼륨과의 연결)
aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Volume:OntapConfiguration.VolumeId,Status:Lifecycle}'
```

#### KB 동기화 상태 확인

```bash
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --ingestion-job-id <JOB_ID> \
  --region ap-northeast-1 \
  --query 'ingestionJob.{status:status,scanned:statistics.numberOfDocumentsScanned,indexed:statistics.numberOfNewDocumentsIndexed,deleted:statistics.numberOfDocumentsDeleted,failed:statistics.numberOfDocumentsFailed}'
```

> **참고**: 문서 추가, 업데이트, 삭제 후에는 반드시 KB 동기화를 실행하세요. 동기화 없이는 변경 사항이 벡터 스토어에 반영되지 않습니다. 동기화는 일반적으로 30초에서 2분 내에 완료됩니다.

#### S3 Access Point 데이터 소스 설정

CDK 배포 후 `post-deploy-setup.sh`가 S3 AP 생성 → 데이터 업로드 → KB 동기화를 한 번에 수행합니다.

S3 AP 사용자 유형은 AD 구성에 따라 자동으로 선택됩니다:

| AD 구성 | 볼륨 스타일 | S3 AP 사용자 유형 | 동작 |
|---------|-----------|-----------------|------|
| `adPassword` 설정 | NTFS | WINDOWS (`DOMAIN\Admin`) | NTFS ACL이 자동 적용. SMB 사용자 파일 권한이 그대로 반영 |
| `adPassword` 미설정 | NTFS | UNIX (`root`) | 모든 파일 접근 가능. 권한 제어는 `.metadata.json`의 SID로 구현 |

> **프로덕션 권장**: AD 통합 + WINDOWS 사용자 유형을 사용하면 SMB를 통해 설정된 NTFS ACL이 S3 AP를 통한 접근에도 자동으로 적용됩니다.

```bash
# 배포 후 설정 (S3 AP 생성 + 데이터 + KB 동기화 + 사용자 생성)
bash demo-data/scripts/post-deploy-setup.sh
```

### 임베딩 서버 배포

```bash
# 1단계: Embedding 스택 배포
CIFSDATA_VOL_NAME=smb_share RAGDB_VOL_PATH=/smb_share/ragdb \
  npx cdk deploy perm-rag-demo-demo-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=arn:aws:secretsmanager:ap-northeast-1:<ACCOUNT_ID>:secret:<SECRET_NAME> \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local

# 2단계: ECR에 Embedding 컨테이너 이미지 푸시
# CloudFormation 출력에서 ECR 리포지토리 URI 가져오기
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

### 임베딩 서버 컨텍스트 파라미터

| 파라미터 | 환경 변수 | 기본값 | 설명 |
|----------|----------|--------|------|
| `enableEmbeddingServer` | - | `false` | Embedding 스택 활성화 |
| `cifsdataVolName` | `CIFSDATA_VOL_NAME` | `smb_share` | CIFS 마운트용 FlexCache Cache 볼륨 이름 |
| `ragdbVolPath` | `RAGDB_VOL_PATH` | `/smb_share/ragdb` | ragdb용 CIFS 마운트 경로 |
| `embeddingAdSecretArn` | - | (필수) | AD 관리자 비밀번호용 Secrets Manager ARN |
| `embeddingAdUserName` | - | `Admin` | AD 서비스 계정 사용자 이름 |
| `embeddingAdDomain` | - | `demo.local` | AD 도메인 이름 |

### 작동 방식

EC2 인스턴스(m5.large)는 시작 시 다음을 수행합니다:

1. Secrets Manager에서 AD 비밀번호 검색
2. FSx API에서 SVM SMB 엔드포인트 IP 가져오기
3. CIFS를 통해 FlexCache Cache 볼륨을 `/tmp/data`에 마운트
4. ragdb 디렉토리를 `/tmp/db`에 마운트
5. ECR에서 Embedding 컨테이너 이미지를 풀하여 실행
6. 컨테이너가 마운트된 문서를 읽고 벡터 데이터를 OpenSearch Serverless에 기록 (AOSS 구성 시)

## 권한 인식 RAG 작동 방식

### 처리 흐름 (2단계 방식: Retrieve + Converse)

```
User              Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 1.Send question  │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ 2.Get user SIDs    │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ 3.Retrieve API (vector search + metadata)              │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ Search results + metadata (SID)      │                │
  │                  │                    │                  │                │
  │                  │ 4.SID matching     │                  │                │
  │                  │ User SID ∩         │                  │                │
  │                  │ Document SID       │                  │                │
  │                  │                    │                  │                │
  │                  │ 5.Generate response with permitted documents only      │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 6.Filtered result│                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

1. 사용자가 채팅으로 질문 전송
2. DynamoDB `user-access` 테이블에서 사용자의 SID 목록(개인 SID + 그룹 SID) 검색
3. Bedrock KB Retrieve API가 벡터 검색을 수행하여 관련 문서 검색 (메타데이터에 SID 정보 포함)
4. 각 문서의 `allowed_group_sids`와 사용자의 SID 목록을 매칭하여 일치하는 문서만 허용
5. 사용자가 접근 가능한 문서만을 컨텍스트로 사용하여 Converse API로 응답 생성
6. 필터링된 응답과 인용 정보 표시

### SID 필터링 작동 방식

각 문서에는 `.metadata.json`을 통해 NTFS ACL SID 정보가 첨부됩니다. 검색 시 사용자 SID와 문서 SID를 매칭하여 일치하는 경우에만 접근을 허용합니다.

```
■ 관리자 사용자: SID = [...-512 (Domain Admins), S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 match → ✅ 허용
  confidential/ (Domain Admins) → ...-512 match → ✅ 허용
  restricted/ (Engineering+DA) → ...-512 match → ✅ 허용

■ 일반 사용자: SID = [...-1001, S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 match → ✅ 허용
  confidential/ (Domain Admins) → No match    → ❌ 거부
  restricted/ (Engineering+DA) → No match    → ❌ 거부
```

자세한 내용은 [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md)를 참조하세요.

## 기술 스택

| 계층 | 기술 |
|------|------|
| IaC | AWS CDK v2 (TypeScript) |
| 프론트엔드 | Next.js 15 + React 18 + Tailwind CSS |
| 인증 | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + S3 Vectors / OpenSearch Serverless |
| 임베딩 | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024차원) |
| 스토리지 | Amazon FSx for NetApp ONTAP + S3 |
| 컴퓨팅 | Lambda Web Adapter + CloudFront |
| 권한 | DynamoDB (user-access: SID 데이터, perm-cache: 권한 캐시) |
| 보안 | AWS WAF + IAM Auth + OAC + Geo Restriction |

## 프로젝트 구조

```
├── bin/
│   └── demo-app.ts                  # CDK 엔트리 포인트 (7-스택 구성)
├── lib/stacks/demo/
│   ├── demo-waf-stack.ts             # WAF WebACL (us-east-1)
│   ├── demo-networking-stack.ts      # VPC, Subnets, SG
│   ├── demo-security-stack.ts        # Cognito
│   ├── demo-storage-stack.ts         # FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD
│   ├── demo-ai-stack.ts             # Bedrock KB, S3 Vectors / OpenSearch Serverless
│   ├── demo-webapp-stack.ts          # Lambda (IAM Auth + OAC), CloudFront
│   └── demo-embedding-stack.ts       # (선택 사항) 임베딩 서버 (FlexCache CIFS)
├── lambda/permissions/
│   ├── permission-filter-handler.ts  # 권한 필터링 Lambda (ACL 기반, 향후 확장용)
│   ├── metadata-filter-handler.ts    # 권한 필터링 Lambda (메타데이터 기반, 데모 스택용)
│   ├── permission-calculator.ts      # SID/ACL 매칭 로직
│   └── types.ts                      # 타입 정의
├── lambda/agent-core-scheduler/      # Agent 예약 실행 Lambda (EventBridge Scheduler용)
│   └── index.ts                      # InvokeAgent + DynamoDB 실행 이력 기록
├── docker/nextjs/                    # Next.js 애플리케이션
│   ├── src/app/[locale]/genai/       # 메인 채팅 페이지 (KB/Agent 모드 전환)
│   ├── src/app/[locale]/genai/agents/ # Agent Directory 페이지
│   ├── src/components/agents/        # Agent Directory UI (AgentCard, AgentCreator, AgentEditor 등)
│   ├── src/components/bedrock/       # AgentModeSidebar, AgentInfoSection, ModelSelector 등
│   ├── src/components/cards/         # CardGrid, TaskCard, InfoBanner, CategoryFilter
│   ├── src/constants/                # card-constants.ts (카드 데이터 정의)
│   ├── src/hooks/                    # useAgentMode, useAgentsList, useAgentInfo 등
│   ├── src/services/cardAgentBindingService.ts  # Agent 검색 & 동적 생성 서비스
│   ├── src/store/                    # useAgentStore, useAgentDirectoryStore, useFavoritesStore (Zustand)
│   ├── src/store/useCardAgentMappingStore.ts    # 카드-Agent 매핑 영속화
│   ├── src/store/useSidebarStore.ts             # 사이드바 접기 상태 관리
│   ├── src/types/agent-directory.ts             # Agent Directory 타입 정의
│   ├── src/utils/agentCategoryUtils.ts          # 카테고리 추정 & 필터링
│   ├── src/components/ui/CollapsiblePanel.tsx   # 접을 수 있는 패널
│   ├── src/components/ui/WorkflowSection.tsx    # 워크플로우 섹션
│   └── src/app/api/bedrock/          # KB/Agent API 라우트
├── demo-data/
│   ├── documents/                    # 검증 문서 + .metadata.json (SID 정보)
│   ├── scripts/                      # 설정 스크립트 (사용자 생성, SID 데이터 등록 등)
│   └── guides/                       # 검증 시나리오 & ONTAP 설정 가이드
├── docs/
│   ├── implementation-overview.md    # 상세 구현 설명 (8가지 관점)
│   ├── ui-specification.md           # UI 사양 (KB/Agent 모드 전환, 사이드바 설계)
│   ├── stack-architecture-comparison.md # CDK 스택 아키텍처 가이드
│   ├── embedding-server-design.md    # 임베딩 서버 설계 (ONTAP ACL 자동 검색 포함)
│   ├── SID-Filtering-Architecture.md # SID 필터링 아키텍처 상세
│   ├── demo-recording-guide.md       # 검증 데모 영상 녹화 가이드 (6개 증거 항목)
│   ├── demo-environment-guide.md     # 검증 환경 설정 가이드
│   ├── verification-report.md        # 배포 후 검증 절차 및 테스트 케이스
│   └── DOCUMENTATION_INDEX.md        # 문서 인덱스
├── tests/unit/                       # 단위 테스트 & 속성 테스트
└── .env.example                      # 환경 변수 템플릿
```

## 검증 시나리오

권한 필터링 검증 절차는 [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md)를 참조하세요.

두 가지 유형의 사용자(관리자와 일반 사용자)가 동일한 질문을 했을 때, 접근 권한에 따라 다른 검색 결과가 반환되는 것을 확인할 수 있습니다.

## 문서 목록

| 문서 | 내용 |
|------|------|
| [docs/implementation-overview.md](docs/implementation-overview.md) | 상세 구현 설명 (8가지 관점) |
| [docs/ui-specification.md](docs/ui-specification.md) | UI 사양 (KB/Agent 모드 전환, Agent Directory, 사이드바 설계, Citation 표시) |
| [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) | SID 기반 권한 필터링 아키텍처 상세 |
| [docs/embedding-server-design.md](docs/embedding-server-design.md) | 임베딩 서버 설계 (ONTAP ACL 자동 검색 포함) |
| [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md) | CDK 스택 아키텍처 가이드 (벡터 스토어 비교, 구현 인사이트) |
| [docs/verification-report.md](docs/verification-report.md) | 배포 후 검증 절차 및 테스트 케이스 |
| [docs/demo-recording-guide.md](docs/demo-recording-guide.md) | 검증 데모 영상 녹화 가이드 (6개 증거 항목) |
| [docs/demo-environment-guide.md](docs/demo-environment-guide.md) | 검증 환경 설정 가이드 |
| [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) | 문서 인덱스 (권장 읽기 순서) |
| [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) | 검증 시나리오 (관리자 vs. 일반 사용자 권한 차이 확인) |
| [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD 통합, CIFS 공유, NTFS ACL 구성 |

## FSx ONTAP + Active Directory 설정

FSx ONTAP AD 통합, CIFS 공유, NTFS ACL 구성 절차는 [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md)를 참조하세요.

CDK 배포는 AWS Managed Microsoft AD와 FSx ONTAP(SVM + Volume)을 생성합니다. SVM AD 도메인 가입은 배포 후 CLI를 통해 실행됩니다 (타이밍 제어를 위해).

```bash
# AD DNS IP 가져오기
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# SVM을 AD에 가입
# 참고: AWS Managed AD의 경우 OrganizationalUnitDistinguishedName을 지정해야 합니다
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins",
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1
```

> **중요**: AWS Managed AD의 경우 `OrganizationalUnitDistinguishedName`을 지정하지 않으면 SVM AD 가입이 `MISCONFIGURED` 상태가 됩니다. OU 경로 형식은 `OU=Computers,OU=<AD ShortName>,DC=<domain>,DC=<tld>`입니다.

S3 Access Point(WINDOWS 사용자 유형, 인터넷 접근)에 대한 설계 결정도 가이드에 문서화되어 있습니다.

## 라이선스

[Apache License 2.0](LICENSE)
