# Guía de experimentación segura

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | [한국어](../ko/safe-experimentation-guide.md) | [简体中文](../zh-CN/safe-experimentation-guide.md) | [繁體中文](../zh-TW/safe-experimentation-guide.md) | [Français](../fr/safe-experimentation-guide.md) | [Deutsch](../de/safe-experimentation-guide.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Usuarios de PoC, desarrolladores, evaluadores

---

## Descripción general

Este documento proporciona definiciones de alcance, acciones prohibidas y procedimientos de reversión para experimentar de forma segura con el sistema RAG con reconocimiento de permisos. Aclara "un entorno donde se puede experimentar por ensayo y error dentro de los límites de las políticas de IA Responsable y seguridad."

---

## Alcance de experimentación segura

### ✅ Recomendado: Experimentar solo con datos de demostración

| Operación | Riesgo | Notas |
|-----------|--------|-------|
| Pruebas de búsqueda con datos de demostración | Ninguno | Verificar operación con datos de muestra incluidos |
| Verificación de permisos mediante cambio de usuario | Ninguno | Confirmar diferencias en resultados de búsqueda entre admin / user |
| Experimentación con modo Agent | Ninguno | Creación y prueba de Agent en Agent Directory |
| Personalización de UI | Ninguno | Cambios en el código fuente de Next.js |
| Cambios de parámetros CDK | Bajo | Cambios en `cdk.context.json` → redespliegue |
| Agregar nuevos documentos | Bajo | Agregar a la carpeta de datos de demostración |
| Ajustes de política de Guardrails | Bajo | Cambios en `guardrailsConfig` |
| Smart Routing ON/OFF | Ninguno | Toggle en la barra lateral |
| Cambios de selección de modelo | Bajo | Posible variación de costos |
| Experimentación con chat de voz | Bajo | Habilitar con `enableVoiceChat=true` |

### ⚠️ Precaución: Lista de verificación antes de la ingesta de datos reales

Verifique lo siguiente antes de ingestar datos empresariales reales:

- [ ] **Clasificación de datos completada**: El nivel de confidencialidad de los datos a ingestar ha sido clasificado
- [ ] **Verificación de PII**: Si se incluye información personal, el enmascaramiento o la aprobación está completa
- [ ] **Verificación del diseño de permisos**: `allowed_group_sids` en `.metadata.json` está configurado correctamente
- [ ] **Registro de auditoría habilitado**: CloudWatch Logs / CloudTrail están habilitados
- [ ] **Restricciones de acceso verificadas**: WAF / Restricciones geográficas / Restricciones de IP están configuradas apropiadamente
- [ ] **Verificación de respaldo**: El respaldo automático de FSx está habilitado
- [ ] **Notificación a usuarios**: Los participantes del PoC han sido informados de las reglas de manejo de datos
- [ ] **Procedimiento de eliminación de datos confirmado**: El procedimiento de eliminación de datos después de la finalización del PoC ha sido confirmado

### ❌ Acciones prohibidas

| Acción prohibida | Razón | Alternativa |
|------------------|-------|-------------|
| Conexión directa a AD de producción (etapa PoC) | Riesgo de impacto al entorno de producción | Usar AD de prueba / autenticación por correo de Cognito |
| Ingestar datos sin clasificación de PII | Riesgo de fuga de información personal | Ingestar después del escaneo de PII |
| Usar datos confidenciales sin registro de auditoría | Violación de cumplimiento | Ingestar después de habilitar registros de auditoría |
| Almacenar datos confidenciales sin cifrado | Riesgo de fuga de datos | Establecer `enableKmsEncryption=true` |
| Permitir acceso desde internet público | Riesgo de acceso no autorizado | Usar restricciones de IP / VPN |
| Ejecutar PoC en cuenta de producción | Impacto al entorno de producción | Usar cuenta sandbox |
| Usar datos confidenciales con Guardrails deshabilitado | Riesgo de generación de respuestas inapropiadas | Establecer `enableGuardrails=true` |

---

## Procedimiento para experimentar solo con datos de demostración

### Paso 1: Desplegar con configuración mínima

```bash
# cdk.context.json mínimo
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# Desplegar
npx cdk deploy --all --require-approval never

# Datos de prueba + creación de usuarios
bash demo-data/scripts/post-deploy-setup.sh
```

### Paso 2: Verificar operación

```bash
# Obtener URL de CloudFront
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "URL de acceso: $URL"
```

### Paso 3: Verificar filtrado de permisos

1. Iniciar sesión como `admin@example.com` → Todos los documentos son buscables
2. Iniciar sesión como `user@example.com` → Solo los documentos públicos son buscables
3. Confirmar que se devuelven respuestas diferentes para la misma pregunta

### Paso 4: Evaluación

Realizar la evaluación del PoC utilizando la plantilla de evaluación en [evaluation.md](evaluation.md).

---

## Procedimiento de ingesta de datos reales (después de completar la lista de verificación)

### Paso 1: Preparación de datos

```bash
# 1. Clasificar documentos
# Crear .metadata.json para cada documento
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. Escaneo de PII (recomendado)
# Detectar PII con Amazon Comprehend
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### Paso 2: Ingesta de datos

```bash
# Colocar archivos en el volumen FSx (vía SMB)
# O usar la ruta de respaldo del bucket S3
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### Paso 3: Sincronización de KB

```bash
# Ejecutar sincronización de KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# Esperar a que se complete la sincronización
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### Paso 4: Pruebas de permisos

```bash
# Ejecutar pruebas de matriz de permisos
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## Procedimiento de reversión / eliminación del entorno

### Reversión parcial (solo eliminación de datos)

```bash
# 1. Limpiar sincronización de fuente de datos de KB
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. Eliminar datos del bucket S3
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. Eliminar datos de usuario de DynamoDB
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### Eliminación completa (todos los recursos)

```bash
# 1. Vaciar bucket S3 (si el versionado está habilitado)
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy (eliminar todos los stacks)
npx cdk destroy --all --force

# 3. Eliminar recursos de CDK Bootstrap (si es necesario)
# ⚠️ No eliminar si existen otros proyectos CDK
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### Verificación de limpieza de costos

```bash
# Verificar recursos restantes
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# Verificar sistemas de archivos FSx (la eliminación toma tiempo)
aws fsx describe-file-systems --region ap-northeast-1

# Verificar colecciones de OpenSearch Serverless
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## Solución de problemas

### Problemas comunes y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| El despliegue toma más de 40 minutos | La creación de FSx for ONTAP toma tiempo | Normal. La creación de FSx toma 20–30 min |
| La búsqueda devuelve 0 resultados | Sincronización de KB incompleta o fuente de datos no configurada | Verificar ejecución de `StartIngestionJob` |
| Mismos resultados para todos los usuarios | Datos de SID no registrados | Verificar tabla `user-access` de DynamoDB |
| Fail-Closed deniega todo | Error de conexión a DynamoDB o sin registro de SID | Verificar registros de Lambda |
| Agent no funciona | Agent no creado o no en estado PREPARED | Verificar estado del Agent en la consola de Bedrock |
| Costo mayor al esperado | OCU de OpenSearch Serverless | Cambiar a `vectorStoreType=s3vectors` |

### Recursos de soporte

| Recurso | URL |
|---------|-----|
| GitHub Issues | Pestaña Issues del repositorio |
| Documentación AWS (Bedrock) | https://docs.aws.amazon.com/bedrock/ |
| Documentación AWS (FSx ONTAP) | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [evaluation.md](evaluation.md) | Métricas de evaluación RAG / Agent |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción |
| [governance-and-audit.md](governance-and-audit.md) | Diseño de gobernanza y auditoría |
| [permission-consistency.md](permission-consistency.md) | Modelo de consistencia de cambios de permisos |
