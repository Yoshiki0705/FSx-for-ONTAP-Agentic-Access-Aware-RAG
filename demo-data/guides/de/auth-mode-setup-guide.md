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

## Leitfaden zur Auswahl des Authentifizierungsmodus

### Entscheidungsdiagramm

Wählen Sie den optimalen Authentifizierungsmodus basierend auf Ihrer bestehenden Authentifizierungsinfrastruktur.

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

### Auswahl der Berechtigungszuordnungsstrategie

Der Parameter `permissionMappingStrategy` steuert die Funktionsweise der Dokumentenzugriffskontrolle.

| Strategie | Wert | Bedingung | Dokumentmetadaten | Empfohlene Umgebung |
|----------|-------|-----------|-------------------|------------------------|
| Nur SID | `sid-only` | Windows AD-Umgebung | `allowed_group_sids` | NTFS-ACL-verwaltete Dateiberechtigungen |
| Nur UID/GID | `uid-gid` | UNIX/Linux-Umgebung | `allowed_uids`, `allowed_gids` | POSIX-berechtigungsverwaltete Dateien |
| Hybrid | `hybrid` | Gemischte Umgebung | Sowohl SID als auch UID/GID | AD- und LDAP-Benutzer koexistieren |

### OIDC IdP-Integrations-Checkliste

Bei der Integration eines OIDC IdP sind die folgenden Einstellungen auf der IdP-Seite erforderlich.

#### Allgemein (alle OIDC IdPs)

- [ ] Client-Anwendung (Regular Web Application) für das RAG-System erstellen
- [ ] `clientId` und `clientSecret` erhalten
- [ ] `clientSecret` in AWS Secrets Manager speichern
- [ ] Allowed Callback URLs auf `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse` setzen
- [ ] Allowed Logout URLs auf `https://{cloudfront-url}/signin` setzen
- [ ] `issuerUrl` aus dem `issuer`-Feld von `/.well-known/openid-configuration` abrufen (auf abschließenden Schrägstrich achten)
- [ ] Überprüfen, dass die Scopes `openid`, `email`, `profile` aktiviert sind

#### Auth0-spezifisch

- [ ] Abschließenden Schrägstrich zu `issuerUrl` hinzufügen (z.B. `https://xxx.auth0.com/`)
- [ ] Gruppen-Claims: Post Login Action mit Namespace-Custom-Claims konfigurieren

#### Keycloak-spezifisch

- [ ] Kein abschließender Schrägstrich bei `issuerUrl` (z.B. `https://keycloak.example.com/realms/main`)
- [ ] Client Protocol: `openid-connect`, Access Type: `confidential`
- [ ] Gruppen-Claims: `groups`-Mapper in Client Scopes hinzufügen

#### Okta-spezifisch

- [ ] Kein abschließender Schrägstrich bei `issuerUrl` (z.B. `https://company.okta.com`)
- [ ] Application Type: `Web Application`
- [ ] Gruppen-Claims: Authorization Server → Claims → `groups`-Claim hinzufügen

#### Entra ID (ehemals Azure AD)-spezifisch

- [ ] `issuerUrl`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Redirect-URI hinzufügen
- [ ] Token Configuration → Optional Claims → `groups` hinzufügen

---

## LDAP-Gesundheitsprüfung Verifizierung (Modus C)

Wenn `ldapConfig` konfiguriert ist, wird automatisch ein LDAP-Gesundheitsprüfung-Lambda erstellt. Verwenden Sie die folgenden Befehle, um die korrekte Funktionsweise zu überprüfen.

```bash
# Manuelle Lambda-Ausführung (connect/bind/search Schrittergebnisse prüfen)
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# CloudWatch Alarm-Status (OK = gesund, ALARM = LDAP-Verbindungsfehler)
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# EventBridge-Regel (geplante Ausführung im 5-Minuten-Intervall)
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# CloudWatch-Protokolle (strukturierte JSON-Protokolle)
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **Verifiziert (2026-04-10)**: Manuelle Ausführung des LDAP-Gesundheitsprüfung-Lambda gegen OpenLDAP EC2 (10.0.2.187:389) — alle Schritte SUCCESS (connect: 12ms, bind: 12ms, search: 16ms, total: 501ms). CloudWatch Alarm: OK, EventBridge Rule: 5min ENABLED. Zugriff auf Secrets Manager + CloudWatch Metrics über NAT Gateway bestätigt.

---

## Migration zwischen Modi

### Mode A → Mode C/D (E-Mail/Passwort → OIDC Federation)

Das häufigste Migrationsmuster. Beginnen Sie mit Mode A für den PoC und migrieren Sie dann zu OIDC Federation für die Produktion.

```bash
# Step 1: Aktuelle cdk.context.json sichern
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: OIDC-Konfiguration zu cdk.context.json hinzufügen
# Step 3: Erneut bereitstellen (nur Security + WebApp Stacks)
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: Callback-URLs auf der OIDC IdP-Seite konfigurieren
# Step 5: Überprüfen - bestehende E-Mail/Passwort-Benutzer können sich weiterhin anmelden
```

**Hinweise:**
- Bestehende Cognito-Benutzer (E-Mail/Passwort) werden nicht gelöscht
- Bestehende DynamoDB-SID-Daten bleiben erhalten
- Verwenden Sie `permissionMappingStrategy: "hybrid"` für die Koexistenz von SID + UID/GID-Benutzern
- Wenn `email.mutable` des Cognito User Pools `false` ist, muss der User Pool neu erstellt werden

### Mode B → Mode E (SAML AD → SAML + OIDC Hybrid)

Einen OIDC IdP zur bestehenden AD SAML Federation hinzufügen.

```bash
# Step 1: oidcProviderConfig zu cdk.context.json hinzufügen (enableAdFederation: true beibehalten)
# Step 2: Security + WebApp Stacks erneut bereitstellen
# Step 3: Überprüfen, ob sowohl "Sign in with AD" als auch "{providerName}"-Buttons angezeigt werden
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
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings. `issuerUrl` must match IdP's `/.well-known/openid-configuration` `issuer` value (Auth0 requires trailing `/`) |
| OIDC `invalid_request` | C,D,E | issuerUrl trailing slash mismatch | Auth0: `https://xxx.auth0.com/` (trailing `/` required), Keycloak: no trailing `/` |
| OIDC `Attribute cannot be updated` | C,D,E | email attribute `mutable: false` | User Pool must be recreated (`mutable` cannot be changed after creation) |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Verwandte Dokumente

- [Authentifizierungs- und Benutzerverwaltungsanleitung](../../docs/de/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
