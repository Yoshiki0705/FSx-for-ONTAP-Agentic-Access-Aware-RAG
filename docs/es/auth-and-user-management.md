# Guía de autenticación y gestión de usuarios

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | [Deutsch](../de/auth-and-user-management.md) | **Español**

**Fecha de creación**: 2026-04-02
**Versión**: 3.4.0

---

## Descripción general

Este sistema ofrece dos modos de autenticación. Puede alternar entre ellos mediante los parámetros de contexto CDK durante el despliegue.

| Modo | Parámetro CDK | Creación de usuario | Registro de SID | Uso recomendado |
|------|--------------|--------------------|-----------------|-----------------| 
| Correo/Contraseña | `enableAdFederation=false` (predeterminado) | El administrador crea manualmente | El administrador registra manualmente | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Creación automática en el primer inicio de sesión | Registro automático al iniciar sesión | Producción / Empresa |
| OIDC/LDAP Federation | `oidcProviderConfig` especificado | Creación automática en el primer inicio de sesión | Registro automático al iniciar sesión | Multi-IdP / Entornos LDAP |

### Aprovisionamiento de usuarios sin intervención

Los modos AD Federation y OIDC/LDAP Federation logran un "aprovisionamiento de usuarios sin intervención". Este mecanismo mapea automáticamente los permisos de usuario existentes del servidor de archivos (FSx for NetApp ONTAP) a los usuarios de la interfaz RAG.

- Los administradores no necesitan crear usuarios manualmente en el sistema RAG
- Los usuarios no necesitan auto-registrarse
- Cuando un usuario gestionado por un IdP (AD/Keycloak/Okta/Entra ID, etc.) inicia sesión por primera vez, la creación del usuario en Cognito → obtención de permisos → registro en DynamoDB se realizan automáticamente
- Los cambios de permisos en el servidor de archivos se reflejan automáticamente en el siguiente inicio de sesión después de que expire el TTL de la caché (24 horas)

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

## Modo 3: OIDC/LDAP Federation (Multi-IdP / Entornos LDAP)

### Funcionamiento

```
OIDC User -> CloudFront UI -> "Sign in with OIDC" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Cuando un usuario OIDC inicia sesión, las siguientes operaciones se realizan automáticamente:

1. **Creación automática de usuario en Cognito** — Se genera automáticamente un usuario de Cognito a partir del atributo email en la aserción OIDC
2. **Obtención automática de permisos** — Identity Sync Lambda obtiene información de SID/UID/GID/grupos desde el servidor LDAP o los claims OIDC
3. **Registro automático en DynamoDB** — Los datos de permisos obtenidos se guardan en la tabla `user-access` (caché de 24 horas)

### Activación automática basada en configuración

Cada método de autenticación se activa automáticamente cuando se proporciona su configuración. Costo adicional de recursos AWS prácticamente nulo.

| Funcionalidad | Condición de activación | Costo adicional |
|--------------|------------------------|----------------|
| OIDC Federation | `oidcProviderConfig` especificado | Ninguno (registro de IdP en Cognito gratuito) |
| Obtención de permisos LDAP | `ldapConfig` especificado | Ninguno (solo cobro por ejecución de Lambda) |
| Permisos por claims OIDC | `oidcProviderConfig` especificado + sin `ldapConfig` | Ninguno |
| Filtrado de permisos UID/GID | `permissionMappingStrategy` es `uid-gid` o `hybrid` | Ninguno |
| ONTAP Name-Mapping | `ontapNameMappingEnabled=true` | Ninguno |

> **Configuración automática de CDK**: Al desplegar CDK con `oidcProviderConfig` especificado, se configura automáticamente lo siguiente:
> - El IdP OIDC se registra en el Cognito User Pool
> - Se crea el Cognito Domain (si no fue creado por `enableAdFederation=true`)
> - El IdP OIDC se agrega como proveedor soportado al User Pool Client
> - Se crea el Identity Sync Lambda y se registra como Post-Authentication Trigger
> - Las variables de entorno OAuth (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`) se configuran automáticamente en el Lambda de WebAppStack
>
> Cuando se especifican simultáneamente `enableAdFederation=true` y `oidcProviderConfig`, se soportan tanto SAML como OIDC y se muestran ambos botones de inicio de sesión.

### Patrón C: OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak)

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password",
    "userSearchFilter": "(mail={email})",
    "groupSearchFilter": "(member={dn})"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

### Patrón D: OIDC Claims Only (sin LDAP)

```json
{
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com",
    "groupClaimName": "groups"
  }
}
```

> **Nota importante para usuarios de Auth0**: Las aplicaciones compatibles con OIDC de Auth0 requieren que los claims personalizados en los ID tokens utilicen un espacio de nombres (prefijo URL). Los claims `groups` sin espacio de nombres se eliminan silenciosamente de los ID tokens. Configure su Auth0 Post Login Action con claims con espacio de nombres:
>
> ```javascript
> // Auth0 Post Login Action
> exports.onExecutePostLogin = async (event, api) => {
>   const groups = ['developers', 'rag-users']; // Grupos del usuario
>   api.idToken.setCustomClaim('https://rag-system/groups', groups);
>   api.accessToken.setCustomClaim('https://rag-system/groups', groups);
> };
> ```
>
> El `groupClaimName` de CDK puede permanecer como `groups`. CDK configura automáticamente el mapeo de atributos `https://rag-system/groups` → `custom:oidc_groups`.

### Patrón E: Híbrido SAML + OIDC

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com"
  },
  "permissionMappingStrategy": "hybrid",
  "cloudFrontUrl": "https://dxxxxxxxx.cloudfront.net"
}
```

### Lista de parámetros CDK (OIDC/LDAP)

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|---------------|-------------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | Nombre de visualización del IdP (mostrado en el botón de inicio de sesión) |
| `oidcProviderConfig.clientId` | string | **Requerido** | ID de cliente OIDC |
| `oidcProviderConfig.clientSecret` | string | **Requerido** | Secreto de cliente OIDC (se recomienda ARN de Secrets Manager) |
| `oidcProviderConfig.issuerUrl` | string | **Requerido** | URL del emisor OIDC |
| `oidcProviderConfig.groupClaimName` | string | `groups` | Nombre del claim de información de grupo |
| `ldapConfig.ldapUrl` | string | - | URL LDAP/LDAPS (ej.: `ldaps://ldap.example.com:636`) |
| `ldapConfig.baseDn` | string | - | DN base de búsqueda (ej.: `dc=example,dc=com`) |
| `ldapConfig.bindDn` | string | - | DN de enlace (ej.: `cn=readonly,dc=example,dc=com`) |
| `ldapConfig.bindPasswordSecretArn` | string | - | ARN de Secrets Manager de la contraseña de enlace |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | Filtro de búsqueda de usuario |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | Filtro de búsqueda de grupo |
| `permissionMappingStrategy` | string | `sid-only` | Estrategia de mapeo de permisos: `sid-only`, `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | Integración ONTAP name-mapping |

---

## Integración con el filtrado de permisos

Independientemente del modo de autenticación, el mecanismo de filtrado de permisos funciona de la misma manera. El Permission Resolver selecciona automáticamente la estrategia de filtrado apropiada según la fuente de autenticación.

### Estrategias de filtrado

| Estrategia | Condición | Comportamiento |
|-----------|-----------|---------------|
| SID Matching | Solo existe `userSID` | Coincidencia de `allowed_group_sids` del documento con los SID del usuario |
| UID/GID Matching | Solo existen `uid` + `gid` | Coincidencia de `allowed_uids` / `allowed_gids` del documento con UID/GID del usuario |
| Hybrid Matching | Existen tanto `userSID` como `uid` | Prioridad a SID, respaldo con UID/GID |
| Deny All (Fail-Closed) | Sin datos de permisos | Denegar todo acceso a documentos |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (selección automática de estrategia)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID prioridad → UID/GID respaldo
  v
Match -> ALLOW, No match -> DENY
```

**Diferencias en la fuente de registro de datos SID:**

| Modo de autenticación | Fuente de datos SID | Campo `source` |
|----------------------|--------------------|-----------------| 
| Correo/Contraseña | `setup-user-access.sh` (manual) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automático) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automático) | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda (automático) | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda (automático) | `OIDC-Claims` |

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
| Todos los documentos denegados después de iniciar sesión | No hay datos SID/UID/GID en DynamoDB | AD Federation: verificar los registros de AD Sync Lambda. OIDC: verificar los registros de Identity Sync Lambda. Manual: ejecutar `setup-user-access.sh` |
| El botón "Iniciar sesión con AD" no se muestra | `enableAdFederation=false` | Verificar los parámetros CDK y volver a desplegar |
| El botón "Iniciar sesión con OIDC" no se muestra | `oidcProviderConfig` no configurado | Agregar `oidcProviderConfig` a los parámetros CDK y volver a desplegar |
| Fallo en la autenticación SAML | URL de metadatos SAML incorrecta | Managed AD: verificar la configuración de IAM Identity Center. Self-managed: verificar la URL de metadatos de Entra ID |
| Fallo en la autenticación OIDC | `clientId` / `issuerUrl` incorrecto | Verificar que la configuración del cliente del IdP OIDC coincida con los parámetros CDK |
| Fallo en la obtención de permisos LDAP | Error de conexión LDAP | Verificar los errores de Identity Sync Lambda en CloudWatch Logs. El inicio de sesión no se bloquea (Fail-Open) |
| Los cambios de grupo AD no se reflejan | Caché SID (24 horas) | Esperar 24 horas o eliminar el registro correspondiente en DynamoDB e iniciar sesión de nuevo |
| Tiempo de espera agotado en AD Sync Lambda | La ejecución de PowerShell a través de SSM es lenta | Aumentar la variable de entorno `SSM_TIMEOUT` (predeterminado: 60 segundos) |
| Grupos OIDC no obtenidos | Claim de grupo no configurado en el IdP, o claims sin espacio de nombres | Los IdP compatibles con OIDC como Auth0 requieren claims personalizados con espacio de nombres en los ID tokens. Para Auth0, use `api.idToken.setCustomClaim('https://rag-system/groups', groups)` en un Post Login Action, y asegúrese de que el mapeo de atributos de Cognito coincida con `https://rag-system/groups` → `custom:oidc_groups` |
| Datos de permisos no registrados en DynamoDB después del inicio de sesión OIDC | Post-Auth Trigger o Identity Sync Lambda no creado | Desplegar CDK con `oidcProviderConfig` crea automáticamente el Identity Sync Lambda y el Post-Auth Trigger. Verificar los logs de ejecución Lambda en CloudWatch Logs |
| Atributos personalizados vacíos en el trigger PostConfirmation | Cognito puede no incluir atributos personalizados en el evento PostConfirmation | Identity Sync Lambda incluye un mecanismo de respaldo mediante la API Cognito AdminGetUser. Verificar que el rol de ejecución Lambda tenga el permiso `cognito-idp:AdminGetUser` |
| Error de callback OAuth (configuración OIDC) | `cloudFrontUrl` no configurado | `cloudFrontUrl` también es necesario para la configuración OIDC. Configurar en `cdk.context.json` y redesplegar |

---

## Resultados de verificación

### Verificación CDK Synth + Despliegue (v3.4.0)

- CDK synth/deploy: ✅ Éxito
- Registro de Cognito OIDC IdP: ✅ Auth0
- Página de inicio de sesión: ✅ Híbrido SAML + OIDC
- Flujo de autenticación OIDC: ✅ Éxito de extremo a extremo
- Post-Auth Trigger: ✅ PostConfirmation
- Guardado automático en DynamoDB: ✅ OIDC-Claims
- Pipeline de claims de grupos OIDC: ✅ Auth0 Post Login Action → claim con espacio de nombres (`https://rag-system/groups`) → Cognito `custom:oidc_groups` → Identity Sync Lambda → DynamoDB `oidcGroups: ["developers","rag-users"]`
- Respaldo API Cognito AdminGetUser: ✅ Cuando el evento del trigger PostConfirmation no contiene atributos personalizados, Lambda los obtiene a través de la API de Cognito
- Pruebas unitarias: ✅ 130 aprobadas
- Pruebas de propiedades: ✅ 52 aprobadas

![Página de inicio de sesión (Híbrido SAML + OIDC)](../docs/screenshots/signin-page-saml-oidc-hybrid.png)

![Página de inicio de sesión Auth0 OIDC](../docs/screenshots/oidc-auth0-login-page.png)

![Página de chat después del inicio de sesión OIDC exitoso](../docs/screenshots/oidc-auth0-signin-success.png)

---

## Documentos relacionados

- [README.md — Federación AD SAML](../../README.es.md#federación-ad-saml-opción) — Instrucciones de despliegue CDK
- [docs/implementation-overview.md — Sección 3: Autenticación IAM](../es/implementation-overview.md#3-autenticación-iam--lambda-function-url-iam-auth--cloudfront-oac) — Diseño de autenticación a nivel de infraestructura
- [docs/SID-Filtering-Architecture.md](../es/SID-Filtering-Architecture.md) — Diseño detallado del filtrado SID
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — Configuración de integración AD de FSx ONTAP
