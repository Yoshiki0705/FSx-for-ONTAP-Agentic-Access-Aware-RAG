# Guía de configuración del entorno de demostración por modo de autenticación

**Fecha de creación**: 2026-04-04
**Fecha de creación**: Construir entornos de demostración reproducibles para cada uno de los 5 modos de autenticación

---

## Descripción general

Este sistema soporta 5 modos de autenticación. Los archivos de configuración de ejemplo se encuentran en `demo-data/configs/` — simplemente copie a `cdk.context.json` y despliegue.

| Modo | Archivo de config | Método de auth | Fuente de permisos | Infra adicional |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | Email/Contraseña | Registro SID manual | Ninguna |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | Solo OIDC Claims | Token OIDC | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## Pasos comunes

### Requisitos previos

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### Despliegue

```bash
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
bash demo-data/scripts/verify-deployment.sh
```

---

## Guía de selección del modo de autenticación

### Diagrama de decisión

Seleccione el modo de autenticación óptimo según su infraestructura de autenticación existente.

```
What is your existing authentication infrastructure?
│
├─ None (new setup)
│   └─ → Mode A (Email/Password) to start
│       Can migrate to Mode C/D later
│
├─ Windows Active Directory (on-premises or Managed AD)
│   ├─ IAM Identity Center configured?
│   │   ├─ Yes → Mode B (SAML AD Federation)
│   │   └─ No  → Configure SAML via AD FS / Entra ID → Mode B
│   │
│   └─ Want to also use an OIDC IdP?
│       └─ Yes → Mode E (SAML + OIDC Hybrid)
│
├─ OIDC IdP (Keycloak / Okta / Entra ID / Auth0)
│   ├─ Also have LDAP/FreeIPA server?
│   │   └─ Yes → Mode C (OIDC + LDAP)
│   │       UID/GID-based permission filtering available
│   │
│   └─ No LDAP (IdP group claims only)
│       └─ → Mode D (OIDC Claims Only)
│           Group claim configuration required on IdP side
│
└─ Multiple IdPs simultaneously (Okta + Keycloak, etc.)
    └─ → oidcProviders array (Phase 2 Multi-OIDC)
        Each IdP button dynamically displayed on sign-in screen
```

### Selección de la estrategia de mapeo de permisos

El parámetro `permissionMappingStrategy` controla cómo funciona el control de acceso a documentos.

| Estrategia | Valor | Condición | Metadatos del documento | Entorno recomendado |
|----------|-------|-----------|-------------------|------------------------|
| Solo SID | `sid-only` | Entorno Windows AD | `allowed_group_sids` | Permisos de archivos gestionados por ACL NTFS |
| Solo UID/GID | `uid-gid` | Entorno UNIX/Linux | `allowed_uids`, `allowed_gids` | Archivos gestionados por permisos POSIX |
| Híbrido | `hybrid` | Entorno mixto | Ambos SID + UID/GID | Coexistencia de usuarios AD y LDAP |

### Lista de verificación para la integración de OIDC IdP

Al integrar un OIDC IdP, se requieren las siguientes configuraciones en el lado del IdP.

#### Común (todos los OIDC IdP)

- [ ] Crear una aplicación cliente (Regular Web Application) para el sistema RAG
- [ ] Obtener `clientId` y `clientSecret`
- [ ] Almacenar `clientSecret` en AWS Secrets Manager
- [ ] Configurar Allowed Callback URLs como `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
- [ ] Configurar Allowed Logout URLs como `https://{cloudfront-url}/signin`
- [ ] Obtener `issuerUrl` del campo `issuer` de `/.well-known/openid-configuration` (atención a la barra final)
- [ ] Verificar que los scopes `openid`, `email`, `profile` estén habilitados

#### Específico de Auth0

- [ ] Agregar barra final a `issuerUrl` (ej: `https://xxx.auth0.com/`)
- [ ] Claims de grupo: configurar Post Login Action con claims personalizados con espacio de nombres

#### Específico de Keycloak

- [ ] Sin barra final en `issuerUrl` (ej: `https://keycloak.example.com/realms/main`)
- [ ] Client Protocol: `openid-connect`, Access Type: `confidential`
- [ ] Claims de grupo: agregar mapper `groups` en Client Scopes

#### Específico de Okta

- [ ] Sin barra final en `issuerUrl` (ej: `https://company.okta.com`)
- [ ] Application Type: `Web Application`
- [ ] Claims de grupo: Authorization Server → Claims → Agregar claim `groups`

#### Específico de Entra ID (anteriormente Azure AD)

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Agregar URI de redirección
- [ ] Token Configuration → Optional Claims → Agregar `groups`

---

## Verificación del chequeo de salud LDAP (Modo C)

Cuando se configura `ldapConfig`, se crea automáticamente un Lambda de chequeo de salud LDAP. Utilice los siguientes comandos para verificar que funciona correctamente.

```bash
# Invocación manual del Lambda (verificar resultados de los pasos connect/bind/search)
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# Estado de la alarma CloudWatch (OK = saludable, ALARM = fallo de conexión LDAP)
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# Regla EventBridge (ejecución programada cada 5 minutos)
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# Registros CloudWatch (registros JSON estructurados)
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **Verificado (2026-04-10)**: Invocación manual del Lambda de chequeo de salud LDAP contra OpenLDAP EC2 (10.0.2.187:389) — todos los pasos SUCCESS (connect: 12ms, bind: 12ms, search: 16ms, total: 501ms). CloudWatch Alarm: OK, EventBridge Rule: 5min ENABLED. Acceso a Secrets Manager + CloudWatch Metrics a través de NAT Gateway confirmado.

---

## Migración entre modos

### Mode A → Mode C/D (Email/Contraseña → OIDC Federation)

El patrón de migración más común. Comience con Mode A para el PoC y luego migre a OIDC Federation para producción.

```bash
# Step 1: Respaldar el cdk.context.json actual
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: Agregar configuración OIDC a cdk.context.json
# Step 3: Redesplegar (solo los stacks Security + WebApp)
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: Configurar Callback URLs en el lado del OIDC IdP
# Step 5: Verificar - los usuarios existentes de email/contraseña aún pueden iniciar sesión
```

**Notas:**
- Los usuarios Cognito existentes (email/contraseña) no se eliminan
- Los datos SID de DynamoDB existentes se conservan
- Use `permissionMappingStrategy: "hybrid"` para la coexistencia de usuarios SID + UID/GID
- Si `email.mutable` del Cognito User Pool es `false`, se requiere recrear el User Pool

### Mode B → Mode E (SAML AD → SAML + OIDC Híbrido)

Agregar un OIDC IdP a la federación SAML AD existente.

```bash
# Step 1: Agregar oidcProviderConfig a cdk.context.json (mantener enableAdFederation: true)
# Step 2: Redesplegar los stacks Security + WebApp
# Step 3: Verificar que aparezcan ambos botones "Sign in with AD" y "{providerName}"
```

---

## Limpieza

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Solución de problemas

| | Modo | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings. `issuerUrl` must match IdP's `/.well-known/openid-configuration` `issuer` value (Auth0 requires trailing `/`) |
| OIDC `invalid_request` | C,D,E | issuerUrl trailing slash mismatch | Auth0: `https://xxx.auth0.com/` (trailing `/` required), Keycloak: no trailing `/` |
| OIDC `Attribute cannot be updated` | C,D,E | email attribute `mutable: false` | User Pool must be recreated (`mutable` cannot be changed after creation) |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Documentos relacionados

- [Guía de autenticación y gestión de usuarios](../../docs/es/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
