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

## Limpieza

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Solución de problemas

| | Modo | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Documentos relacionados

- [Guía de autenticación y gestión de usuarios](../../docs/es/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
