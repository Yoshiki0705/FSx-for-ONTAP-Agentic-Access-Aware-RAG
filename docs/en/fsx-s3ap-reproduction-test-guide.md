# FSx ONTAP S3 Access Point Reproduction Test Guide

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | **English** | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**Purpose**: Isolate whether the FSx ONTAP S3 AP AccessDenied issue is specific to Organization SCP or an inherent limitation of FSx ONTAP S3 AP

---

## Prerequisites

- An AWS account without Organization SCP restrictions (or an account with confirmed restrictions)
- ap-northeast-1 (Tokyo) region
- AWS CLI v2, CDK v2

## Reproduction Steps

### Step 1: FSx ONTAP + Managed AD Deployment

```bash
# CDK bootstrap (use --method=direct to bypass CloudFormation Hook if present)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# Deploy all stacks (Networking + Security + Storage + AI + WebApp)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### Step 2: SVM AD Join

```bash
# Get AD DNS IPs
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# Get SVM ID
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# Join SVM to AD (OU specification is required)
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

# Wait for AD join to complete (2-3 minutes)
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# Success when Lifecycle: CREATED, AD: DEMO.LOCAL
```

> **Note**: Without OU specification, the status becomes MISCONFIGURED. AD ports (636, 135, 464, 3268-3269, 1024-65535) are required in the FSx SG (already reflected in CDK code).

### Step 3: FSx ONTAP Admin Password Setup + CIFS Share Creation

```bash
# Set FSx admin password
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# Get ONTAP management IP
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# Create CIFS share from an EC2 instance within the VPC (ONTAP REST API)
# SVM name is generated from CDK projectName+environment (e.g., s3aptestval + svm)
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### Step 4: Place Files via SMB

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# Place files via SMB from an EC2 instance within the VPC
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# Create and upload test documents
echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# Verify files
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### Step 5: Create S3 Access Point

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# Create WINDOWS S3 AP
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

# Wait for AVAILABLE status (approximately 1 minute)
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### Step 6: Configure S3 AP Policy

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

### Step 7: S3 AP Access Test (Reproduction Verification Point)

```bash
# Get S3 AP alias
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# Test 1: ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# Test 2: GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# Test 3: s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# Test 4: PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## Expected Results

### If the Issue Is Organization SCP (Currently Occurring in This Account)
- All tests in Step 7 return AccessDenied
- Succeeds in a different account (without SCP restrictions)

### If the Issue Is an Inherent FSx ONTAP S3 AP Limitation
- Same AccessDenied occurs in a different account as well

## Verified Settings (Confirmed Not to Be the Cause)

| Item | Status | Notes |
|------|--------|-------|
| ONTAP version | 9.17.1P4 | Meets S3 AP requirement (9.17.1 or later) |
| S3 protocol | Enabled | `allowed_protocols` includes `s3` |
| SVM AD join | CREATED | Succeeded with OU specification |
| S3 AP status | AVAILABLE | Created with AD-joined SVM |
| NTFS ACL | Everyone: Full Control | Volume root ACL |
| S3 AP policy | s3:* for account root | Access point ARN format |
| IAM policy | AdministratorAccess | Includes s3:* |
| Network | Same VPC/subnet | FSx and AD in the same subnet |
| Block Public Access | Not configured (account level) | FSx S3 AP enforces by default |
| UNIX user mapping | root (UID 0) registered | Resolvable via name-service |

## Cleanup

```bash
# Delete S3 AP
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# Delete all stacks
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## Isolation Results (2026-03-31)

### Test Results

| Account | Organization | S3 AP Access | Result |
|---------|-------------|-------------|--------|
| Old account (personal) | None | ✅ Success (empty response) | No AccessDenied |
| New account (CDS) | Yes (SCP restrictions) | ❌ AccessDenied | Organization SCP is blocking |

### Conclusion

**The FSx ONTAP S3 AP AccessDenied issue is caused by Organization SCP.**

Confirmed that the same S3 AP access pattern works correctly in the old account (not part of an Organization). AccessDenied only occurs in the new account (part of an Organization with SCP restrictions).

### Remediation

Perform one of the following in the Organization management account:
1. Add a statement to the SCP that allows access to FSx ONTAP S3 AP
2. Exclude the target account from SCP restrictions
3. Identify the S3 actions/resource patterns being blocked by the SCP and exclude the FSx S3 AP ARN pattern (`arn:aws:s3:<region>:<account>:accesspoint/*`)
