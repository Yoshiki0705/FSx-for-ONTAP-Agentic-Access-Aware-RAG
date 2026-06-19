# Informe de verificación E2E de Transfer Family FSx for ONTAP

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | [한국어](../ko/transfer-family-e2e-verification.md) | [简体中文](../zh-CN/transfer-family-e2e-verification.md) | [繁體中文](../zh-TW/transfer-family-e2e-verification.md) | [Français](../fr/transfer-family-e2e-verification.md) | [Deutsch](../de/transfer-family-e2e-verification.md) | **Español**

**Fecha de verificación**: 2026-05-13
**Región**: ap-northeast-1
**ID del servidor**: s-fb47244ef5ac43a28
**Punto de enlace**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## Resultados de la verificación del flujo E2E

| Paso | Resultado | Detalles |
|---------|------|------|
| 1. Generación de la clave SSH | ✅ | RSA 4096bit |
| 2. Registro de la clave de usuario de Transfer Family | ✅ | API `import-ssh-public-key` |
| 3. Conexión SFTP | ✅ | Autenticación exitosa (publickey) |
| 4. Listado de archivos (ls) | ✅ | 2 archivos mostrados |
| 5. Carga de archivo (put) | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 1 cambio de archivo detectado |
| 7. KB StartIngestionJob | ✅ | ID de trabajo `JIGLRZMPEU` |
| 8. Ingesta completada | ✅ | `COMPLETE`, 1 documento indexado por primera vez |

---

## Configuración requerida para el funcionamiento

### 1. Parámetros de contexto de CDK

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **Importante**: `transferFamilyS3ApAlias` debe obtenerse después de crear el S3 Access Point (desconocido en el momento del CDK synth).

### 2. Cómo obtener el alias del S3 Access Point

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. Formato del Target de HomeDirectoryMappings

```
✅ Correcto: /{s3-access-point-alias}/uploads/demo-user
❌ Incorrecto: /{ap-name}/uploads/demo-user
❌ Incorrecto: /{ap-arn}/uploads/demo-user
❌ Incorrecto: /{alias}/uploads/demo-user/  (barra diagonal final)
```

### 4. Formato del Resource de la política IAM

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ No utilice el alias en IAM Resource
```

### 5. Condición s3:prefix

```
✅ Correcto: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ Incorrecto: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
No se requiere barra diagonal inicial.

### 6. Acciones IAM requeridas

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. Comando de conexión SFTP

```bash
# Conexión desde macOS/Linux (se requiere especificar HostKeyAlgorithms)
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ Nota para el entorno de producción**: El `StrictHostKeyChecking=no` anterior es para la verificación inicial. En el entorno de producción, registre la HostKey del servidor Transfer Family en `~/.ssh/known_hosts` y opere con `StrictHostKeyChecking=yes` (valor predeterminado). La HostKey se puede obtener con `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'`.

### 8. Permisos del sistema de archivos de FSx for ONTAP

Para que los usuarios de Transfer Family puedan leer y escribir archivos, el usuario del sistema de archivos del S3 Access Point (por ejemplo, `root`) en el volumen de FSx for ONTAP debe tener permisos de lectura/escritura sobre el directorio de destino de la carga.

---

## Problemas detectados y soluciones

### Problema 1: StructuredLogDestinations EarlyValidation

**Síntoma**: Error `AWS::EarlyValidation::PropertyValidation` durante la creación del ChangeSet
**Solución**: Eliminar la propiedad `structuredLogDestinations`. Salida de registro estándar solo mediante `loggingRole`.

### Problema 2: Barra diagonal final en HomeDirectoryMappings

**Síntoma**: `Target in mapping has a trailing '/'`
**Solución**: Cambiar el valor predeterminado de `homeDirectoryPrefix` a `/uploads/${userName}` (sin barra diagonal final)

### Problema 3: Uso del nombre del AP en el Target de HomeDirectoryMappings

**Síntoma**: `No such file or directory` en `ls`
**Solución**: Usar el **alias** del S3 AP en lugar del nombre del AP. Formato: `/{alias}/path`.

### Problema 4: Barra diagonal inicial en IAM s3:prefix

**Síntoma**: `Permission denied` en `ls`
**Solución**: Eliminar la barra diagonal inicial de la condición `s3:prefix`. `uploads/user/*` es lo correcto.

### Problema 5: Incompatibilidad de SSH HostKeyAlgorithms

**Síntoma**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**Solución**: Agregar `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` al comando SFTP.

### Problema 6: Clave SSH de marcador de posición

**Síntoma**: `Permission denied (publickey)` — la antigua clave de marcador de posición permanece
**Solución**: Eliminar las claves antiguas con `aws transfer delete-ssh-public-key`, conservando solo la clave real.

---

## Pasos de configuración manual posteriores al despliegue

1. **Crear el S3 Access Point** (fuera de CDK)
2. **Obtener el alias del S3 AP** → configurarlo en `cdk.context.json`
3. **Despliegue de CDK** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **Generar la clave SSH** (`ssh-keygen -t rsa -b 4096`)
5. **Registrar la clave pública SSH** (`aws transfer import-ssh-public-key`)
6. **Eliminar la clave de marcador de posición** (`aws transfer delete-ssh-public-key`)
7. **Prueba de conexión SFTP**
8. **Ejecución manual de la Ingestion Trigger Lambda** para confirmar la detección

---

## Capturas de pantalla de la consola de AWS

### Detalles del servidor Transfer Family

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Supervisión de la Ingestion Trigger Lambda

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Nombre de la función Lambda: `v4-test-demo-ingestion-trigger`
- Éxito de ejecución confirmado

### Ingesta de Bedrock KB completada

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
