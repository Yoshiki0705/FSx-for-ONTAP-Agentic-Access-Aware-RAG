# FSx ONTAP S3 Access Point — Reproduktionstestleitfaden

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | **Deutsch** | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**Zweck**: Isolieren, ob das FSx ONTAP S3 AP AccessDenied-Problem spezifisch für Organization SCP ist oder eine inhärente Einschränkung von FSx ONTAP S3 AP darstellt

---

## Voraussetzungen

- Ein AWS-Konto ohne Organization SCP-Einschränkungen (oder ein Konto mit bestätigten Einschränkungen)
- ap-northeast-1 (Tokio) Region
- AWS CLI v2, CDK v2

## Reproduktionsschritte

### Schritt 1: FSx ONTAP + Managed AD Deployment

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

### Schritt 2: SVM AD-Beitritt

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

> **Hinweis**: Ohne OU-Angabe wird der Status MISCONFIGURED. AD-Ports (636, 135, 464, 3268-3269, 1024-65535) sind in der FSx SG erforderlich (bereits im CDK-Code berücksichtigt).

### Schritt 3: FSx ONTAP Admin-Passwort einrichten + CIFS-Share erstellen

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

### Schritt 4: Dateien über SMB platzieren

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

### Schritt 5: S3 Access Point erstellen

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

### Schritt 6: S3 AP-Policy konfigurieren

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

### Schritt 7: S3 AP-Zugriffstest (Reproduktions-Verifizierungspunkt)

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

## Erwartete Ergebnisse

### Wenn das Problem Organization SCP ist (tritt derzeit in diesem Konto auf)
- Alle Tests in Schritt 7 geben AccessDenied zurück
- Erfolgreich in einem anderen Konto (ohne SCP-Einschränkungen)

### Wenn das Problem eine inhärente FSx ONTAP S3 AP-Einschränkung ist
- Gleicher AccessDenied tritt auch in einem anderen Konto auf

## Verifizierte Einstellungen (bestätigt, dass sie nicht die Ursache sind)

| Element | Status | Hinweise |
|---------|--------|----------|
| ONTAP-Version | 9.17.1P4 | Erfüllt S3 AP-Anforderung (9.17.1 oder höher) |
| S3-Protokoll | Aktiviert | `allowed_protocols` enthält `s3` |
| SVM AD-Beitritt | CREATED | Erfolgreich mit OU-Angabe |
| S3 AP-Status | AVAILABLE | Erstellt mit AD-beigetretener SVM |
| NTFS ACL | Everyone: Full Control | Volume-Root-ACL |
| S3 AP-Policy | s3:* für Account Root | Access Point ARN-Format |
| IAM-Policy | AdministratorAccess | Enthält s3:* |
| Netzwerk | Gleiche VPC/Subnetz | FSx und AD im gleichen Subnetz |
| Block Public Access | Nicht konfiguriert (Kontoebene) | FSx S3 AP erzwingt standardmäßig |
| UNIX-Benutzerzuordnung | root (UID 0) registriert | Auflösbar über name-service |

## Bereinigung

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

## Isolierungsergebnisse (2026-03-31)

### Testergebnisse

| Konto | Organization | S3 AP-Zugriff | Ergebnis |
|-------|-------------|---------------|----------|
| Altes Konto (persönlich) | Keine | ✅ Erfolgreich (leere Antwort) | Kein AccessDenied |
| Neues Konto (CDS) | Ja (SCP-Einschränkungen) | ❌ AccessDenied | Organization SCP blockiert |

### Schlussfolgerung

**Das FSx ONTAP S3 AP AccessDenied-Problem wird durch Organization SCP verursacht.**

Es wurde bestätigt, dass das gleiche S3 AP-Zugriffsmuster im alten Konto (nicht Teil einer Organization) korrekt funktioniert. AccessDenied tritt nur im neuen Konto (Teil einer Organization mit SCP-Einschränkungen) auf.

### Behebung

Führen Sie eine der folgenden Maßnahmen im Organization-Verwaltungskonto durch:
1. Fügen Sie der SCP eine Anweisung hinzu, die den Zugriff auf FSx ONTAP S3 AP erlaubt
2. Schließen Sie das Zielkonto von SCP-Einschränkungen aus
3. Identifizieren Sie die S3-Aktionen/Ressourcenmuster, die von der SCP blockiert werden, und schließen Sie das FSx S3 AP ARN-Muster aus (`arn:aws:s3:<region>:<account>:accesspoint/*`)
