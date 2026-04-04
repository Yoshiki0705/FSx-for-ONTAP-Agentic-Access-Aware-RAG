# Guía de escenarios de verificación

## Descripción general

Procedimientos de verificación del sistema Permission-aware RAG. El filtrado basado en SID garantiza resultados de búsqueda diferentes para distintos usuarios que hacen la misma pregunta.

---

## Escenario 4: Verificación OIDC + LDAP Federation

> **Requisitos previos**: CDK desplegado con `oidcProviderConfig` + `ldapConfig`. Servidor OpenLDAP en ejecución en el VPC.

### 4-1. Configuración de OpenLDAP

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. Usuarios de prueba LDAP

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Puntos de verificación

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Scripts de verificación

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Consideraciones para la configuración de OpenLDAP

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Ver [Guía de configuración por modo de autenticación](es/auth-mode-setup-guide.md).
