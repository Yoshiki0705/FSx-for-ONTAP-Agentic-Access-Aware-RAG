# Guía de incorporación de socios de Transfer Family

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | [한국어](../ko/transfer-family-partner-onboarding.md) | [简体中文](../zh-CN/transfer-family-partner-onboarding.md) | [繁體中文](../zh-TW/transfer-family-partner-onboarding.md) | [Français](../fr/transfer-family-partner-onboarding.md) | [Deutsch](../de/transfer-family-partner-onboarding.md) | **Español**

**Última actualización**: 2026-05-23  
**Destinatarios**: configuración del acceso SFTP para socios externos (bufetes de abogados, firmas de auditoría, organismos reguladores, etc.)

---

## Descripción general

Esta guía explica los pasos de configuración para que los socios externos carguen documentos a través de SFTP mediante AWS Transfer Family, con ingesta automática en la Permission-aware RAG Knowledge Base.

### Arquitectura

```
Socio (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

Los socios solo necesitan un cliente SFTP. No se requiere acceso a la interfaz web ni a la consola de AWS.

---

## 1. Requisitos previos

### Lado del administrador del sistema

- [x] CDK implementado con `enableTransferFamily=true`
- [x] S3 Access Point conectado al volumen de FSx for ONTAP
- [x] Configuración de permisos del socio registrada en la tabla de asignación de permisos de DynamoDB

### Lado del socio

- [x] Cliente SFTP (FileZilla, WinSCP, OpenSSH, etc.)
- [x] Par de claves SSH (RSA 4096 bits o Ed25519)

---

## 2. Preparación de la clave SSH

### Cuando el socio genera la clave

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

Envíe la **clave pública** generada (`~/.ssh/transfer-family-key.pub`) al administrador del sistema.

> **Nota de seguridad**: nunca comparta la clave privada (`~/.ssh/transfer-family-key`).

### Cuando el administrador del sistema registra la clave

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. Parámetros de conexión SFTP

Proporcione la siguiente información de conexión al socio:

| Parámetro | Valor |
|-----------|-----|
| Host | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| Puerto | `22` |
| Protocolo | SFTP |
| Nombre de usuario | `partner-a` (asignado por el administrador) |
| Método de autenticación | Autenticación con clave pública SSH |
| Directorio principal | `/uploads/partner-a/` |

### Comando de conexión (OpenSSH)

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### Configuración de FileZilla

1. **Gestor de sitios** → Nuevo sitio
2. Protocolo: **SFTP**
3. Host: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. Tipo de acceso: **Archivo de clave**
5. Usuario: `partner-a`
6. Archivo de clave: especifique la ruta de la clave privada

### Configuración de WinSCP

1. **Nueva sesión**
2. Protocolo de archivo: **SFTP**
3. Nombre de host: punto de conexión de Transfer Family
4. Nombre de usuario: `partner-a`
5. **Configuración avanzada** → SSH → Autenticación → especifique el archivo de clave privada

---

## 4. Procedimiento de carga de archivos

### Estructura de directorios

El directorio principal del socio está limitado a `/uploads/partner-a/`.

```
/uploads/partner-a/
├── contracts/          ← Contratos
├── reports/            ← Informes
├── correspondence/     ← Correspondencia
└── misc/               ← Varios
```

### Operaciones de carga

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### Convenciones de nomenclatura de archivos

| Regla | Descripción |
|--------|------|
| Extensión | Se recomiendan `.pdf`, `.docx`, `.txt`, `.md`, `.html` |
| Nombre de archivo | Usar caracteres alfanuméricos, guiones y guiones bajos |
| Límite de tamaño | 5 GB (limitación de S3 Access Point) |
| Operaciones prohibidas | No se admiten el cambio de nombre (rename) ni la anexión (append) de archivos |

### Restricciones

- **Está prohibido crear, modificar o eliminar archivos `.metadata.json`** (IAM Deny)
- Los metadatos de permisos los genera automáticamente el sistema
- Las operaciones rename/append en archivos no se admiten debido a las limitaciones de S3 Access Point

---

## 5. Verificación de la ingesta

Tras la carga, los documentos se procesan según el siguiente cronograma:

| Paso | Duración | Descripción |
|---------|---------|------|
| Detección del archivo | Hasta 5 min | Sondeo mediante EventBridge Scheduler |
| Generación de metadatos | Segundos | `.metadata.json` generado automáticamente |
| Ingesta en la KB | 1-5 min | Indexación en Bedrock Knowledge Base |
| Búsqueda RAG disponible | Inmediata | Tras completar la ingesta |

### Método de verificación (para el administrador del sistema)

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. Solución de problemas

### No se puede conectar

| Síntoma | Causa | Solución |
|------|------|------|
| `Permission denied (publickey)` | Clave SSH no registrada o no coincidente | Solicitar al administrador que vuelva a registrar la clave pública |
| `Connection timed out` | Restricción de red (lista de IP permitidas) | Solicitar al administrador que agregue su dirección IP |
| `no matching host key type found` | Discrepancia de HostKeyAlgorithms | Agregar `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` |

### No se puede cargar

| Síntoma | Causa | Solución |
|------|------|------|
| `Permission denied` en `put` | Acceso fuera del directorio principal | Cargar solo en `/uploads/partner-a/` |
| `Permission denied` en `.metadata.json` | Política IAM Deny | Las operaciones en archivos de metadatos están prohibidas (comportamiento esperado) |
| `File too large` | Superación del límite de 5 GB | Dividir el archivo antes de cargarlo |

### El archivo no se refleja en el RAG

| Síntoma | Causa | Solución |
|------|------|------|
| No se refleja tras más de 5 min | Espera del intervalo de sondeo o error de Lambda | Solicitar al administrador que revise CloudWatch Logs |
| Trabajo de ingesta en estado FAILED | Formato de archivo no compatible | Verificar los formatos compatibles (PDF, DOCX, TXT, MD, HTML) |

---

## 7. Modelo de seguridad

### Alcance de acceso del socio

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### Generación automática de metadatos de permisos

Cuando un socio carga un archivo, el sistema genera automáticamente `.metadata.json`:

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

Esta información de permisos se deriva de la tabla de configuración gestionada por el administrador en DynamoDB. Los socios no pueden especificar permisos directamente.

---

## 8. Para el administrador: procedimiento para agregar un socio

### Agregar un nuevo socio

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### Desactivación de un socio

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## Documentación relacionada

- [Informe de verificación E2E de Transfer Family](transfer-family-e2e-verification.md)
- [Requisitos previos de red de Transfer Family](transfer-family-networking-prerequisites.md)
- [Documentación de AWS Transfer Family + FSx for ONTAP S3 AP](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
