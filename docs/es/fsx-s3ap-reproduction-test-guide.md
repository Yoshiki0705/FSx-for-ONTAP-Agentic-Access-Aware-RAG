# Guía de Prueba de Reproducción de FSx ONTAP S3 Access Point

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | [Français](../fr/fsx-s3ap-reproduction-test-guide.md) | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | **Español**

**Propósito**: Aislar si el problema de AccessDenied de FSx ONTAP S3 AP es específico de Organization SCP o una limitación inherente de FSx ONTAP S3 AP

---

## Requisitos previos

- Una cuenta de AWS sin restricciones de Organization SCP (o una cuenta con restricciones confirmadas)
- Región ap-northeast-1 (Tokio)
- AWS CLI v2, CDK v2

## Pasos de reproducción

### Paso 1: Despliegue de FSx ONTAP + Managed AD

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

### Paso 2: Unión de SVM a AD

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

> **Nota**: Sin especificación de OU, el estado se convierte en MISCONFIGURED. Los puertos AD (636, 135, 464, 3268-3269, 1024-65535) son necesarios en el FSx SG (ya reflejado en el código CDK).

### Paso 3: Configuración de contraseña de administrador de FSx ONTAP + Creación de CIFS Share

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
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### Paso 4: Colocar archivos a través de SMB

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# Place files via SMB from an EC2 instance within the VPC
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### Paso 5: Crear S3 Access Point

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

watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### Paso 6: Configurar política de S3 AP

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

### Paso 7: Prueba de acceso a S3 AP (Punto de verificación de reproducción)

```bash
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

## Resultados esperados

### Si el problema es Organization SCP (ocurriendo actualmente en esta cuenta)
- Todas las pruebas del Paso 7 devuelven AccessDenied
- Tiene éxito en una cuenta diferente (sin restricciones SCP)

### Si el problema es una limitación inherente de FSx ONTAP S3 AP
- El mismo AccessDenied ocurre también en una cuenta diferente

## Configuraciones verificadas (confirmado que no son la causa)

| Elemento | Estado | Notas |
|----------|--------|-------|
| Versión de ONTAP | 9.17.1P4 | Cumple el requisito de S3 AP (9.17.1 o posterior) |
| Protocolo S3 | Habilitado | `allowed_protocols` incluye `s3` |
| Unión SVM a AD | CREATED | Exitosa con especificación de OU |
| Estado de S3 AP | AVAILABLE | Creado con SVM unida a AD |
| NTFS ACL | Everyone: Full Control | ACL raíz del volumen |
| Política de S3 AP | s3:* para account root | Formato ARN de access point |
| Política IAM | AdministratorAccess | Incluye s3:* |
| Red | Misma VPC/subred | FSx y AD en la misma subred |
| Block Public Access | No configurado (nivel de cuenta) | FSx S3 AP lo aplica por defecto |
| Mapeo de usuario UNIX | root (UID 0) registrado | Resoluble a través de name-service |

## Limpieza

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

## Resultados de aislamiento (2026-03-31)

### Resultados de las pruebas

| Cuenta | Organization | Acceso S3 AP | Resultado |
|--------|-------------|-------------|-----------|
| Cuenta antigua (personal) | Ninguna | ✅ Éxito (respuesta vacía) | Sin AccessDenied |
| Cuenta nueva (CDS) | Sí (restricciones SCP) | ❌ AccessDenied | Organization SCP está bloqueando |

### Conclusión

**El problema de AccessDenied de FSx ONTAP S3 AP es causado por Organization SCP.**

Se confirmó que el mismo patrón de acceso S3 AP funciona correctamente en la cuenta antigua (no forma parte de una Organization). AccessDenied solo ocurre en la cuenta nueva (parte de una Organization con restricciones SCP).

### Remediación

Realice una de las siguientes acciones en la cuenta de gestión de la Organization:
1. Agregue una declaración a la SCP que permita el acceso a FSx ONTAP S3 AP
2. Excluya la cuenta objetivo de las restricciones SCP
3. Identifique las acciones/patrones de recursos S3 que están siendo bloqueados por la SCP y excluya el patrón ARN de FSx S3 AP (`arn:aws:s3:<region>:<account>:accesspoint/*`)
