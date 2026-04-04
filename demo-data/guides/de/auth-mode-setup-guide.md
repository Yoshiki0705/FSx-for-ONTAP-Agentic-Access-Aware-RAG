# Authentifizierungsmodus Demo-Umgebung Einrichtungsanleitung

**Erstellt am**: 2026-04-04
**Erstellt am**: Reproduzierbare Demo-Umgebungen für jeden der 5 Authentifizierungsmodi erstellen

---

## Übersicht

Dieses System unterstützt 5 Authentifizierungsmodi. Beispielkonfigurationsdateien befinden sich in `demo-data/configs/` — einfach nach `cdk.context.json` kopieren und bereitstellen.

| Modus | Konfigurationsdatei | Auth-Methode | Berechtigungsquelle | Zusätzliche Infra |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | E-Mail/Passwort | Manuelle SID-Registrierung | Keine |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | Nur OIDC Claims | OIDC-Token | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## Gemeinsame Schritte

### Voraussetzungen

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### Bereitstellung

```bash
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
bash demo-data/scripts/verify-deployment.sh
```

---

## Bereinigung

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Fehlerbehebung

| | Modus | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Verwandte Dokumente

- [Authentifizierungs- und Benutzerverwaltungsanleitung](../../docs/de/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
