# Guía de configuración de FSx for ONTAP + Active Directory e intercambio CIFS

**Last updated**: 2026-04-04

---

## 10. Configuración ONTAP Name-Mapping (mapeo UNIX→Windows)

```bash
# Get SVM UUID
SVM_UUID=$(aws fsx describe-storage-virtual-machines \
  --region ap-northeast-1 \
  --query 'StorageVirtualMachines[?FileSystemId==`<FS_ID>`].UUID' \
  --output text)

# Create name-mapping rule (UNIX→Windows)
MGMT_IP=<FSx Management Endpoint IP>
curl -sk -X POST -u "fsxadmin:${ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  "https://${MGMT_IP}/api/name-services/name-mappings" \
  -d '{
    "svm": {"uuid": "'${SVM_UUID}'"},
    "direction": "unix_win",
    "index": 1,
    "pattern": "alice",
    "replacement": "DEMO\\alice"
  }'

# Verify rules
curl -sk -u "fsxadmin:${ADMIN_PASSWORD}" \
  "https://${MGMT_IP}/api/name-services/name-mappings?svm.uuid=${SVM_UUID}&direction=unix_win&fields=pattern,replacement"
```

### cdk.context.json

```json
{
  "ontapNameMappingEnabled": true,
  "ontapMgmtIp": "<Management Endpoint IP>",
  "ontapSvmUuid": "<SVM UUID>",
  "ontapAdminSecretArn": "arn:aws:secretsmanager:ap-northeast-1:<ACCOUNT>:secret:<SECRET>"
}
```

### Setup Scripts

```bash
bash demo-data/scripts/setup-ontap-namemapping.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

| Item | Details |
|------|---------|
| Management Endpoint | VPC internal access only |
| fsxadmin password | Must be set via `aws fsx update-file-system` |
| Security Group | Port 443 inbound required (VPC CIDR or Lambda SG) |
| Secrets Manager | fsxadmin password stored as plain text string |
| ONTAP version | Verified on ONTAP 9.17.1P4 |

---

## Automatización de Operaciones (Opcional)

Una suite de automatización independiente con Lambda + Step Functions está disponible en `automation/fsxn-ops/`.

### Requisitos previos

- VPC Endpoints (5 requeridos): `secretsmanager`, `fsx`, `monitoring`, `sns` (Interface) + `s3` (Gateway)
- Secrets Manager: formato `{"username": "fsxadmin", "password": "xxx"}`
- La contraseña de fsxadmin debe coincidir entre Secrets Manager y FSx for ONTAP

### Funcionalidades

| Funcionalidad | Descripción |
|---------------|-------------|
| Monitoreo de capacidad | EventBridge cada 5 min, auto-expansión + notificación SNS |
| SnapMirror DR | Orquestación de failover/failback con Step Functions |
| Ejecución API ONTAP | Ejecución segura de ONTAP REST API vía Lambda |
| Preprocesamiento de datos | Preprocesamiento IA/análisis vía FSx for ONTAP S3 Access Point |

Detalles: [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md)
