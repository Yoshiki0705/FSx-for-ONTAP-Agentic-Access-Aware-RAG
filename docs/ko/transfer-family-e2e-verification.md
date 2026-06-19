# Transfer Family FSx for ONTAP E2E 검증 보고서

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | **한국어** | [简体中文](../zh-CN/transfer-family-e2e-verification.md) | [繁體中文](../zh-TW/transfer-family-e2e-verification.md) | [Français](../fr/transfer-family-e2e-verification.md) | [Deutsch](../de/transfer-family-e2e-verification.md) | [Español](../es/transfer-family-e2e-verification.md)

**검증일**: 2026-05-13
**리전**: ap-northeast-1
**서버 ID**: s-fb47244ef5ac43a28
**엔드포인트**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## E2E 플로우 검증 결과

| 단계 | 결과 | 상세 |
|---------|------|------|
| 1. SSH 키 생성 | ✅ | RSA 4096bit |
| 2. Transfer Family 사용자 키 등록 | ✅ | `import-ssh-public-key` API |
| 3. SFTP 연결 | ✅ | 인증 성공(publickey) |
| 4. 파일 목록 표시(ls) | ✅ | 파일 2개 표시 |
| 5. 파일 업로드(put) | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 파일 변경 1건 감지 |
| 7. KB StartIngestionJob | ✅ | 작업 ID `JIGLRZMPEU` |
| 8. 인제스션 완료 | ✅ | `COMPLETE`, 문서 1건 신규 인덱싱 |

---

## 동작을 위한 필수 설정

### 1. CDK 컨텍스트 파라미터

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **중요**: `transferFamilyS3ApAlias`는 S3 Access Point 생성 후에 취득해야 합니다(CDK synth 시점에는 알 수 없음).

### 2. S3 Access Point Alias 취득 방법

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. HomeDirectoryMappings Target 포맷

```
✅ 올바름: /{s3-access-point-alias}/uploads/demo-user
❌ 잘못됨: /{ap-name}/uploads/demo-user
❌ 잘못됨: /{ap-arn}/uploads/demo-user
❌ 잘못됨: /{alias}/uploads/demo-user/  (끝 슬래시)
```

### 4. IAM 정책 Resource 포맷

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ IAM Resource에 alias를 사용해서는 안 됩니다
```

### 5. s3:prefix 조건

```
✅ 올바름: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ 잘못됨: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
선두 슬래시는 불필요합니다.

### 6. 필요한 IAM 액션

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. SFTP 연결 명령

```bash
# macOS/Linux에서 연결(HostKeyAlgorithms 지정 필요)
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ 프로덕션 환경에서의 주의**: 위의 `StrictHostKeyChecking=no`는 최초 검증용입니다. 프로덕션 환경에서는 Transfer Family 서버의 HostKey를 `~/.ssh/known_hosts`에 등록하고 `StrictHostKeyChecking=yes`(기본값)로 운영하십시오. HostKey는 `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'`로 취득할 수 있습니다.

### 8. FSx for ONTAP 파일 시스템 권한

Transfer Family 사용자가 파일을 읽고 쓰려면 FSx for ONTAP 볼륨에서 S3 Access Point의 파일 시스템 사용자(예: `root`)가 업로드 대상 디렉터리에 대한 읽기/쓰기 권한을 가지고 있어야 합니다.

---

## 발견된 문제와 해결책

### 문제 1: StructuredLogDestinations EarlyValidation

**증상**: ChangeSet 생성 시 `AWS::EarlyValidation::PropertyValidation` 오류
**해결**: `structuredLogDestinations` 속성을 제거. `loggingRole`만으로 표준 로그 출력.

### 문제 2: HomeDirectoryMappings 끝 슬래시

**증상**: `Target in mapping has a trailing '/'`
**해결**: `homeDirectoryPrefix`의 기본값을 `/uploads/${userName}`(끝 슬래시 없음)로 변경

### 문제 3: HomeDirectoryMappings Target에 AP 이름 사용

**증상**: `ls`에서 `No such file or directory`
**해결**: AP 이름이 아니라 S3 AP **alias**를 사용. `/{alias}/path` 형식.

### 문제 4: IAM s3:prefix에 선두 슬래시

**증상**: `ls`에서 `Permission denied`
**해결**: `s3:prefix` 조건에서 선두 슬래시를 제거. `uploads/user/*`가 올바름.

### 문제 5: SSH HostKeyAlgorithms 불일치

**증상**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**해결**: SFTP 명령에 `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512`를 추가.

### 문제 6: 플레이스홀더 SSH 키

**증상**: `Permission denied (publickey)` — 오래된 플레이스홀더 키가 남아 있음
**해결**: `aws transfer delete-ssh-public-key`로 오래된 키를 삭제하고 실제 키만 남김.

---

## 배포 후 수동 설정 절차

1. **S3 Access Point 생성**(CDK 외부)
2. **S3 AP Alias 취득** → `cdk.context.json`에 설정
3. **CDK 배포** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **SSH 키 생성** (`ssh-keygen -t rsa -b 4096`)
5. **SSH 공개 키 등록** (`aws transfer import-ssh-public-key`)
6. **플레이스홀더 키 삭제** (`aws transfer delete-ssh-public-key`)
7. **SFTP 연결 테스트**
8. **Ingestion Trigger Lambda 수동 실행**으로 감지 확인

---

## AWS 콘솔 스크린샷

### Transfer Family 서버 상세

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Ingestion Trigger Lambda 모니터링

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Lambda 함수명: `v4-test-demo-ingestion-trigger`
- 실행 성공 확인

### Bedrock KB 인제스션 완료

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
