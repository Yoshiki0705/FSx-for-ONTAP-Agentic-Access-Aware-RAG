# FSx ONTAP S3 Access Point 재현 테스트 가이드

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | **한국어** | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**목적**: FSx ONTAP S3 AP AccessDenied 문제가 Organization SCP에 특정된 것인지, FSx ONTAP S3 AP의 본질적 제한인지 분리

---

## 사전 요구 사항

- Organization SCP 제한이 없는 AWS 계정 (또는 제한이 확인된 계정)
- ap-northeast-1 (도쿄) 리전
- AWS CLI v2, CDK v2

## 재현 단계

### 단계 1: FSx ONTAP + Managed AD 배포

```bash
# CDK bootstrap (CloudFormation Hook이 있는 경우 --method=direct로 우회)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# 모든 스택 배포 (Networking + Security + Storage + AI + WebApp)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### 단계 2: SVM AD 가입

```bash
# AD DNS IP 가져오기
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# SVM ID 가져오기
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# SVM을 AD에 가입 (OU 지정 필수)
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1

# AD 가입 완료 대기 (2~3분)
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# Lifecycle: CREATED, AD: DEMO.LOCAL이면 성공
```

> **참고**: OU 지정 없이는 상태가 MISCONFIGURED가 됩니다. FSx SG에 AD 포트(636, 135, 464, 3268-3269, 1024-65535)가 필요합니다 (CDK 코드에 이미 반영됨).

### 단계 3: FSx ONTAP 관리자 비밀번호 설정 + CIFS 공유 생성

```bash
# FSx 관리자 비밀번호 설정
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# ONTAP 관리 IP 가져오기
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# VPC 내 EC2 인스턴스에서 CIFS 공유 생성 (ONTAP REST API)
# SVM 이름은 CDK projectName+environment에서 생성됨 (예: s3aptestval + svm)
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### 단계 4: SMB를 통한 파일 배치

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# VPC 내 EC2 인스턴스에서 SMB를 통해 파일 배치
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# 테스트 문서 생성 및 업로드
echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# 파일 확인
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### 단계 5: S3 Access Point 생성

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# WINDOWS S3 AP 생성
aws fsx create-and-attach-s3-access-point \
  --name s3ap-test-ap \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "'$VOL_ID'",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "demo.local\\Admin"}
    }
  }' --region ap-northeast-1

# AVAILABLE 상태 대기 (약 1분)
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### 단계 6: S3 AP 정책 구성

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

aws s3control put-access-point-policy \
  --account-id $ACCOUNT_ID \
  --name s3ap-test-ap \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "AllowAccountAccess",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::'$ACCOUNT_ID':root"},
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap",
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap/object/*"
      ]
    }]
  }' --region ap-northeast-1
```

### 단계 7: S3 AP 접근 테스트 (재현 검증 포인트)

```bash
# S3 AP 별칭 가져오기
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# 테스트 1: ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# 테스트 2: GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# 테스트 3: s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# 테스트 4: PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## 예상 결과

### 문제가 Organization SCP인 경우 (현재 이 계정에서 발생 중)
- 단계 7의 모든 테스트가 AccessDenied 반환
- 다른 계정(SCP 제한 없음)에서는 성공

### 문제가 FSx ONTAP S3 AP의 본질적 제한인 경우
- 다른 계정에서도 동일한 AccessDenied 발생

## 검증된 설정 (원인이 아님을 확인)

| 항목 | 상태 | 비고 |
|------|------|------|
| ONTAP 버전 | 9.17.1P4 | S3 AP 요구 사항 충족 (9.17.1 이상) |
| S3 프로토콜 | 활성화됨 | `allowed_protocols`에 `s3` 포함 |
| SVM AD 가입 | CREATED | OU 지정으로 성공 |
| S3 AP 상태 | AVAILABLE | AD 가입된 SVM으로 생성 |
| NTFS ACL | Everyone: Full Control | 볼륨 루트 ACL |
| S3 AP 정책 | 계정 루트에 s3:* | Access Point ARN 형식 |
| IAM 정책 | AdministratorAccess | s3:* 포함 |
| 네트워크 | 동일 VPC/서브넷 | FSx와 AD가 동일 서브넷 |
| Block Public Access | 미구성 (계정 수준) | FSx S3 AP가 기본적으로 강제 |
| UNIX 사용자 매핑 | root (UID 0) 등록됨 | name-service를 통해 해석 가능 |

## 정리

```bash
# S3 AP 삭제
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# 모든 스택 삭제
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## 분리 결과 (2026-03-31)

### 테스트 결과

| 계정 | Organization | S3 AP 접근 | 결과 |
|------|-------------|-----------|------|
| 이전 계정 (개인) | 없음 | ✅ 성공 (빈 응답) | AccessDenied 없음 |
| 새 계정 (CDS) | 있음 (SCP 제한) | ❌ AccessDenied | Organization SCP가 차단 중 |

### 결론

**FSx ONTAP S3 AP AccessDenied 문제는 Organization SCP에 의해 발생합니다.**

이전 계정(Organization에 속하지 않음)에서 동일한 S3 AP 접근 패턴이 정상적으로 작동하는 것을 확인했습니다. AccessDenied는 새 계정(SCP 제한이 있는 Organization에 속함)에서만 발생합니다.

### 해결 방법

Organization 관리 계정에서 다음 중 하나를 수행하세요:
1. FSx ONTAP S3 AP에 대한 접근을 허용하는 문을 SCP에 추가
2. 대상 계정을 SCP 제한에서 제외
3. SCP에서 차단하는 S3 액션/리소스 패턴을 식별하고 FSx S3 AP ARN 패턴(`arn:aws:s3:<region>:<account>:accesspoint/*`)을 제외
