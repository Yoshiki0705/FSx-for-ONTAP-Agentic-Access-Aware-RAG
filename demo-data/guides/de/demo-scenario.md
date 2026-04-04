# Verifizierungsszenario-Leitfaden

## Übersicht

Verifizierungsverfahren für das Permission-aware RAG-System. SID-basierte Berechtigungsfilterung stellt sicher, dass verschiedene Benutzer bei derselben Frage unterschiedliche Suchergebnisse erhalten.

---

## Szenario 4: OIDC + LDAP Federation Verifizierung

> **Voraussetzungen**: CDK mit `oidcProviderConfig` + `ldapConfig` bereitgestellt. OpenLDAP-Server im VPC aktiv.

### 4-1. OpenLDAP-Einrichtung

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP-Testbenutzer

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Überprüfungspunkte

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Überprüfungsskripte

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Überlegungen zur OpenLDAP-Einrichtung

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Siehe [Authentifizierungsmodus-Einrichtungsanleitung](de/auth-mode-setup-guide.md).
