# Runbook de operaciones

**🌐 Idioma:** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **Español**

**Creación**: 2026-06-08  
**Estado**: Operativo  
**Audiencia**: Personal de operaciones, Desarrolladores, Partners

---

## Descripción general

Runbook que consolida los procedimientos de operación diaria, verificación y resolución de problemas del sistema Permission-aware RAG. El conocimiento adquirido durante la verificación del despliegue se sistematiza en procedimientos reproducibles.

---

## 1. Verificación de la versión de ONTAP

### Contexto

Los S3 Access Points requieren ONTAP 9.14.1 o superior. La API AWS de FSx for ONTAP (`describe-file-systems`) no devuelve información de versión, lo que requiere acceso directo a la API REST de ONTAP.

### Requisitos previos

- IP del Management endpoint de FSx (ej.: `10.0.3.72`)
- Contraseña de `fsxadmin` (almacenada en Secrets Manager)
- Instancia habilitada para SSM en el mismo VPC (el Management endpoint solo es accesible por IP privada)

### Procedimiento

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### Salida esperada

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### Notas

- El Security Group del Management endpoint debe permitir tráfico entrante HTTPS (443)
- El rol IAM de la instancia SSM NO necesita `secretsmanager:GetSecretValue` (la contraseña se obtiene localmente y se incorpora en el comando SSM)
- `curl -sk`: `-s` (silencioso), `-k` (aceptar certificado autofirmado)

---

## 2. Ingesta de datos de demostración Industry-Packs

### Contexto

7 industrias × 5 documentos = 35 documentos + 35 archivos de metadatos para la demostración de Permission-aware RAG multisectorial.

### Procedimiento

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### Mapeo de SID por industria

| Industria | Carpeta | SID (además de Domain Admins) |
|-----------|---------|------------------------------|
| Construcción | `construction/` | `-8100` |
| Educación | `education/` | `-2200` |
| Gobierno | `government/` | `-2100` |
| Salud | `healthcare/` | `-2200` |
| Seguros | `insurance/` | `-8200` |
| Legal | `legal/` | `-8300` |
| Manufactura | `manufacturing/` | `-2300` |

---

## 3. Build y despliegue Docker de la WebApp

### Contexto

Después de cambios en el código fuente, la caché de capas Docker reutiliza fuentes antiguas. Usar `--no-cache` por defecto resuelve este problema.

### Procedimiento recomendado

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### Resolución de problemas: cambios no reflejados

| Causa | Verificación | Solución |
|-------|-------------|----------|
| Caché de capas Docker | Marca de tiempo en `docker images` | Reconstruir con `--no-cache` |
| Tag `latest` en ECR obsoleto | Digest en `aws ecr describe-images` | Usar tags explícitos |
| Lambda aún actualizándose | `get-function` LastUpdateStatus | `wait function-updated` |
| Caché de CloudFront | Pestaña de red en DevTools | `create-invalidation` |
| Caché `.next` | Existencia de `docker/nextjs/.next/` | `rm -rf docker/nextjs/.next` y reconstruir |

---

## 4. Depuración del filtro de permisos

### Pasos de verificación

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### Variaciones del formato de metadatos

| Formato | Ejemplo | Método de análisis |
|---------|---------|-------------------|
| Array | `["S-1-1-0", "S-1-5-21-xxx-512"]` | Usar directamente |
| Cadena separada por comas | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| Cadena JSON | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| Valor único | `"S-1-1-0"` | `[value]` |

---

## 5. Verificación del Prompt Caching

### Requisitos previos

- **Solo modelos Anthropic Claude** (Nova, OpenAI no soportados)
- Claude Sonnet 4.6 u Opus 4.8 seleccionado en la UI
- TTL del Prompt Cache de Bedrock: 5 minutos (ephemeral)

### Procedimiento de verificación

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### ¿El caché no funciona?

| Causa | Verificación |
|-------|-------------|
| Usando modelo Nova / OpenAI | Verificar `modelId` en la respuesta |
| Prompt del sistema < 2048 caracteres | Verificar tamaño de `prompt-templates.ts` |
| Intervalo entre consultas > 5 min | Verificar marcas de tiempo en CloudWatch |
| Sesión de usuario diferente | Prompt Cache es por usuario × modelo |

---

## 6. Lista de verificación completa del despliegue

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## Documentos relacionados

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — Soluciones por tipo de error
- [Production Readiness Checklist](../production-readiness-checklist.md) — Requisitos previos a producción
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — Estimaciones de costos mensuales
- [metadata-json-schema](../metadata-json-schema.md) — Especificación formal de .metadata.json
