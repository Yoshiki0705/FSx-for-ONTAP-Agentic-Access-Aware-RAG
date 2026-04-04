# Guide des scénarios de vérification

## Aperçu

Procédures de vérification du système Permission-aware RAG. Le filtrage basé sur les SID garantit des résultats de recherche différents pour différents utilisateurs posant la même question.

---

## Scénario 4 : Vérification OIDC + LDAP Federation

> **Prérequis** : CDK déployé avec `oidcProviderConfig` + `ldapConfig`. Serveur OpenLDAP en fonctionnement dans le VPC.

### 4-1. Configuration OpenLDAP

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. Utilisateurs de test LDAP

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Points de vérification

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Scripts de vérification

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Considérations pour la configuration OpenLDAP

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Voir [Guide de configuration par mode d'authentification](fr/auth-mode-setup-guide.md).
