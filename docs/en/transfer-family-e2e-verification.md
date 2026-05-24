# Transfer Family FSx ONTAP E2E Verification Report

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | **English**

**Verification Date**: 2026-05-13
**Region**: ap-northeast-1
**Server ID**: s-fb47244ef5ac43a28
**Endpoint**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## E2E Flow Verification Results

| Step | Result | Details |
|------|--------|---------|
| 1. SSH key generation | ✅ | RSA 4096bit |
| 2. Transfer Family user key registration | ✅ | `import-ssh-public-key` API |
| 3. SFTP connection | ✅ | Authentication successful (publickey) |
| 4. File listing (ls) | ✅ | 2 files displayed |
| 5. File upload (put) | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 1 file change detected |
| 7. KB StartIngestionJob | ✅ | Job ID `JIGLRZMPEU` |
| 8. Ingestion complete | ✅ | `COMPLETE`, 1 document newly indexed |

---

## Required Configuration for Operation

### 1. CDK Context Parameters

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **Important**: `transferFamilyS3ApAlias` must be obtained after S3 Access Point creation (unknown at CDK synth time).

### 2. How to Obtain the S3 Access Point Alias

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. HomeDirectoryMappings Target Format

```
✅ Correct: /{s3-access-point-alias}/uploads/demo-user
❌ Wrong: /{ap-name}/uploads/demo-user
❌ Wrong: /{ap-arn}/uploads/demo-user
❌ Wrong: /{alias}/uploads/demo-user/  (trailing slash)
```

### 4. IAM Policy Resource Format

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ Do not use the alias in IAM Resource
```

### 5. s3:prefix Condition

```
✅ Correct: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ Wrong: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
No leading slash required.

### 6. Required IAM Actions

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. SFTP Connection Command

```bash
# Connection from macOS/Linux (HostKeyAlgorithms specification required)
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

### 8. FSx ONTAP File System Permissions

For Transfer Family users to read and write files, the S3 Access Point's file system user (e.g., `root`) on the FSx ONTAP volume must have read/write permissions on the upload destination directory.

---

## Issues Discovered and Solutions

### Issue 1: StructuredLogDestinations EarlyValidation

**Symptom**: `AWS::EarlyValidation::PropertyValidation` error during ChangeSet creation
**Solution**: Remove the `structuredLogDestinations` property. Standard log output via `loggingRole` only.

### Issue 2: HomeDirectoryMappings Trailing Slash

**Symptom**: `Target in mapping has a trailing '/'`
**Solution**: Change `homeDirectoryPrefix` default to `/uploads/${userName}` (no trailing slash)

### Issue 3: Using AP Name in HomeDirectoryMappings Target

**Symptom**: `No such file or directory` on `ls`
**Solution**: Use the S3 AP **alias** instead of the AP name. Format: `/{alias}/path`.

### Issue 4: Leading Slash in IAM s3:prefix

**Symptom**: `Permission denied` on `ls`
**Solution**: Remove leading slash from `s3:prefix` condition. `uploads/user/*` is correct.

### Issue 5: SSH HostKeyAlgorithms Mismatch

**Symptom**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**Solution**: Add `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` to the SFTP command.

### Issue 6: Placeholder SSH Key

**Symptom**: `Permission denied (publickey)` — old placeholder key remains
**Solution**: Delete old keys with `aws transfer delete-ssh-public-key`, keeping only the actual key.

---

## Post-Deployment Manual Setup Steps

1. **Create S3 Access Point** (outside CDK)
2. **Obtain S3 AP Alias** → set in `cdk.context.json`
3. **CDK Deploy** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **Generate SSH key** (`ssh-keygen -t rsa -b 4096`)
5. **Register SSH public key** (`aws transfer import-ssh-public-key`)
6. **Delete placeholder key** (`aws transfer delete-ssh-public-key`)
7. **SFTP connection test**
8. **Manual Ingestion Trigger Lambda execution** to confirm detection

---

## AWS Console Screenshots

### Transfer Family Server Details

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Ingestion Trigger Lambda Monitoring

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Lambda function name: `v4-test-demo-ingestion-trigger`
- Execution success confirmed

### Bedrock KB Ingestion Complete

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
