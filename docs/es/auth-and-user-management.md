# Guía de autenticación y gestión de usuarios

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | **Español**

**Fecha de creación**: 2026-04-02
**Versión**: 3.3.0

---

## Descripción general

Este sistema ofrece dos modos de autenticación. Puede alternar entre ellos mediante los parámetros de contexto CDK durante el despliegue.

| Modo | Parámetro CDK | Creación de usuario | Registro de SID | Uso recomendado |
|------|--------------|--------------------|-----------------|-----------------| 
| Correo/Contraseña | `enableAdFederation=false` (predeterminado) | El administrador crea manualmente | El administrador registra manualmente | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Creación automática en el primer inicio de sesión | Registro automático al iniciar sesión | Producción / Empresa |

---

## Modo 1: Autenticación por correo/contraseña (predeterminado)

### Funcionamiento

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Los usuarios se crean directamente en el Cognito User Pool e inician sesión con su dirección de correo electrónico y contraseña.

### Tareas del administrador

**Paso 1: Crear usuarios en Cognito**

```bash
# post-deploy-setup.sh se ejecuta automáticamente, o manualmente:
bash demo-data/scripts/create-demo-users.sh
```

**Paso 2: Registrar datos SID en DynamoDB**

```bash
# Registrar datos SID manualmente
bash demo-data/scripts/setup-user-access.sh
```

Este script registra lo siguiente en la tabla DynamoDB `user-access`:

| userId | userSID | groupSIDs | Alcance de acceso |
|--------|---------|-----------|------------------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | Todos los documentos |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | Solo público |

### Limitaciones

- Cada vez que se añade un usuario, el administrador debe actualizar manualmente tanto Cognito como DynamoDB
- Los cambios en la pertenencia a grupos de AD no se reflejan automáticamente
- No es adecuado para operaciones a gran escala

---

## Modo 2: AD Federation (recomendado: empresa)

### Funcionamiento

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Cuando un usuario de AD inicia sesión a través de SAML, las siguientes operaciones se realizan automáticamente:

1. **Creación automática de usuario en Cognito** — Se genera automáticamente un usuario de Cognito a partir del atributo de correo electrónico en la aserción SAML
2. **Obtención automática de SID** — AD Sync Lambda obtiene el SID del usuario + SIDs de grupo desde AD
3. **Registro automático en DynamoDB** — Los datos SID obtenidos se guardan en la tabla `user-access` (caché de 24 horas)

No se requiere trabajo manual del administrador.

### Comportamiento de AD Sync Lambda

| Tipo de AD | Método de obtención de SID | Infraestructura requerida |
|-----------|--------------------------|--------------------------|
| Managed AD | LDAP o PowerShell a través de SSM | AWS Managed AD + (opcional) Windows EC2 |
| Self-managed AD | PowerShell a través de SSM | Windows EC2 (unido a AD) |

**Comportamiento de la caché:**
- Primer inicio de sesión: consulta AD para obtener SIDs, guarda en DynamoDB
- Inicios de sesión posteriores (dentro de 24 horas): usa la caché de DynamoDB, omite la consulta a AD
- Después de 24 horas: vuelve a obtener desde AD en el siguiente inicio de sesión

**Comportamiento en caso de error:**
- El inicio de sesión no se bloquea aunque AD Sync Lambda falle (solo registro de errores)
- Si no hay datos SID, el filtrado SID opera en modo Fail-Closed (todos los documentos denegados)

### Patrón A: AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Pasos de configuración:**
1. Despliegue CDK (crea Managed AD + SAML IdP + Cognito Domain)
2. Unión de SVM a AD (`post-deploy-setup.sh` se ejecuta automáticamente)
3. Crear una aplicación SAML para Cognito en IAM Identity Center (o especificar un IdP externo con `samlMetadataUrl`)
4. Ejecutar la autenticación AD desde el botón "Iniciar sesión con AD" en la interfaz Cognito Hosted UI

### Patrón B: Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Pasos de configuración:**
1. Unir una instancia Windows EC2 a AD y habilitar SSM Agent
2. Crear una aplicación SAML en Entra ID y obtener la URL de metadatos
3. Despliegue CDK
4. Ejecutar la autenticación AD desde el botón "Iniciar sesión con AD" en la interfaz CloudFront

### Lista de parámetros CDK

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|---------------|-------------|
| `enableAdFederation` | boolean | `false` | Habilitar federación SAML |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Contraseña de administrador de Managed AD |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | ID de instancia Windows EC2 unida a AD |
| `samlMetadataUrl` | string | - | URL de metadatos de SAML IdP |
| `adDomainName` | string | - | Nombre de dominio AD (ej.: demo.local) |
| `adDnsIps` | string | - | IPs DNS de AD (separadas por comas) |
| `cloudFrontUrl` | string | - | URL de callback OAuth |

---

## Integración con el filtrado SID

Independientemente del modo de autenticación, el mecanismo de filtrado SID funciona de la misma manera.

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs
  v
Bedrock KB Retrieve API -> Results + metadata (allowed_group_sids)
  |
  | userSIDs n documentSIDs
  v
Match -> ALLOW, No match -> DENY
```

**Diferencias en la fuente de registro de datos SID:**

| Modo de autenticación | Fuente de datos SID | Campo `source` |
|----------------------|--------------------|-----------------| 
| Correo/Contraseña | `setup-user-access.sh` (manual) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automático) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automático) | `AD-Sync-self-managed` |

### Esquema de la tabla DynamoDB user-access

```json
{
  "userId": "admin@example.com",
  "userSID": "S-1-5-21-...-500",
  "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
  "displayName": "Admin User",
  "email": "admin@example.com",
  "source": "AD-Sync-managed",
  "retrievedAt": 1705750800000,
  "ttl": 1705837200
}
```

---

## Solución de problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Todos los documentos denegados después de iniciar sesión | No hay datos SID en DynamoDB | AD Federation: verificar los registros de AD Sync Lambda. Manual: ejecutar `setup-user-access.sh` |
| El botón "Iniciar sesión con AD" no se muestra | `enableAdFederation=false` | Verificar los parámetros CDK y volver a desplegar |
| Fallo en la autenticación SAML | URL de metadatos SAML incorrecta | Managed AD: verificar la configuración de IAM Identity Center. Self-managed: verificar la URL de metadatos de Entra ID |
| Los cambios de grupo AD no se reflejan | Caché SID (24 horas) | Esperar 24 horas o eliminar el registro correspondiente en DynamoDB e iniciar sesión de nuevo |
| Tiempo de espera agotado en AD Sync Lambda | La ejecución de PowerShell a través de SSM es lenta | Aumentar la variable de entorno `SSM_TIMEOUT` (predeterminado: 60 segundos) |

---

## Documentos relacionados

- [README.md — Federación AD SAML](../../README.es.md#federación-ad-saml-opción) — Instrucciones de despliegue CDK
- [docs/implementation-overview.md — Sección 3: Autenticación IAM](../es/implementation-overview.md#3-autenticación-iam--lambda-function-url-iam-auth--cloudfront-oac) — Diseño de autenticación a nivel de infraestructura
- [docs/SID-Filtering-Architecture.md](../es/SID-Filtering-Architecture.md) — Diseño detallado del filtrado SID
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — Configuración de integración AD de FSx ONTAP
