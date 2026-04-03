# Leitfaden für Authentifizierung und Benutzerverwaltung

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | **Deutsch** | [Español](../es/auth-and-user-management.md)

**Erstellungsdatum**: 2026-04-02
**Version**: 3.4.0

---

## Übersicht

Dieses System bietet zwei Authentifizierungsmodi. Sie können beim Deployment über CDK-Kontextparameter zwischen ihnen wechseln.

| Modus | CDK-Parameter | Benutzererstellung | SID-Registrierung | Empfohlene Verwendung |
|-------|--------------|-------------------|-------------------|----------------------|
| E-Mail/Passwort | `enableAdFederation=false` (Standard) | Administrator erstellt manuell | Administrator registriert manuell | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Automatische Erstellung bei erster Anmeldung | Automatische Registrierung bei Anmeldung | Produktion / Enterprise |
| OIDC/LDAP Federation | `oidcProviderConfig` angegeben | Automatische Erstellung bei erster Anmeldung | Automatische Registrierung bei Anmeldung | Multi-IdP / LDAP-Umgebungen |

### Zero-Touch-Benutzerbereitstellung

Die Modi AD Federation und OIDC/LDAP Federation realisieren eine „Zero-Touch-Benutzerbereitstellung". Dieser Mechanismus ordnet bestehende Benutzerberechtigungen des Dateiservers (FSx for NetApp ONTAP) automatisch den RAG-System-UI-Benutzern zu.

- Administratoren müssen keine Benutzer manuell im RAG-System erstellen
- Benutzer müssen sich nicht selbst registrieren
- Wenn sich ein von einem IdP (AD/Keycloak/Okta/Entra ID usw.) verwalteter Benutzer zum ersten Mal anmeldet, werden Cognito-Benutzererstellung → Berechtigungsabfrage → DynamoDB-Registrierung automatisch durchgeführt
- Berechtigungsänderungen auf der Dateiserverseite werden nach Ablauf des Cache-TTL (24 Stunden) bei der nächsten Anmeldung automatisch übernommen

---

## Modus 1: E-Mail/Passwort-Authentifizierung (Standard)

### Funktionsweise

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Benutzer werden direkt im Cognito User Pool erstellt und melden sich mit ihrer E-Mail-Adresse und ihrem Passwort an.

### Administratoraufgaben

**Schritt 1: Cognito-Benutzer erstellen**

```bash
# post-deploy-setup.sh wird automatisch ausgeführt, oder manuell:
bash demo-data/scripts/create-demo-users.sh
```

**Schritt 2: DynamoDB SID-Daten registrieren**

```bash
# SID-Daten manuell registrieren
bash demo-data/scripts/setup-user-access.sh
```

Dieses Skript registriert folgende Einträge in der DynamoDB `user-access`-Tabelle:

| userId | userSID | groupSIDs | Zugriffsbereich |
|--------|---------|-----------|----------------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | Alle Dokumente |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | Nur öffentlich |

### Einschränkungen

- Bei jedem Hinzufügen eines Benutzers muss der Administrator sowohl Cognito als auch DynamoDB manuell aktualisieren
- Änderungen der AD-Gruppenmitgliedschaft werden nicht automatisch übernommen
- Nicht geeignet für den Betrieb im großen Maßstab

---

## Modus 2: AD Federation (empfohlen: Enterprise)

### Funktionsweise

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Wenn sich ein AD-Benutzer über SAML anmeldet, werden folgende Schritte automatisch durchgeführt:

1. **Automatische Cognito-Benutzererstellung** — Ein Cognito-Benutzer wird automatisch aus dem E-Mail-Attribut der SAML-Assertion generiert
2. **Automatische SID-Abfrage** — AD Sync Lambda ruft die Benutzer-SID + Gruppen-SIDs von AD ab
3. **Automatische DynamoDB-Registrierung** — Die abgerufenen SID-Daten werden in der `user-access`-Tabelle gespeichert (24-Stunden-Cache)

Keine manuelle Administratorarbeit erforderlich.

### Verhalten von AD Sync Lambda

| AD-Typ | SID-Abfragemethode | Erforderliche Infrastruktur |
|--------|-------------------|---------------------------|
| Managed AD | LDAP oder PowerShell über SSM | AWS Managed AD + (optional) Windows EC2 |
| Self-managed AD | PowerShell über SSM | Windows EC2 (AD-beigetreten) |

**Cache-Verhalten:**
- Erste Anmeldung: Fragt AD ab, um SIDs zu erhalten, speichert in DynamoDB
- Folgende Anmeldungen (innerhalb von 24 Stunden): Verwendet DynamoDB-Cache, überspringt AD-Abfrage
- Nach 24 Stunden: Erneute Abfrage von AD bei der nächsten Anmeldung

**Verhalten bei Fehlern:**
- Die Anmeldung wird auch bei einem Fehler von AD Sync Lambda nicht blockiert (nur Fehlerprotokoll)
- Wenn keine SID-Daten vorhanden sind, arbeitet die SID-Filterung im Fail-Closed-Modus (alle Dokumente abgelehnt)

### Muster A: AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Einrichtungsschritte:**
1. CDK-Deployment (erstellt Managed AD + SAML IdP + Cognito Domain)
2. SVM AD-Beitritt (`post-deploy-setup.sh` wird automatisch ausgeführt)
3. SAML-Anwendung für Cognito in IAM Identity Center erstellen (oder externen IdP mit `samlMetadataUrl` angeben)
4. AD-Authentifizierung über die Schaltfläche „AD-Anmeldung" in der Cognito Hosted UI ausführen

### Muster B: Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Einrichtungsschritte:**
1. Windows EC2-Instanz dem AD beitreten lassen und SSM Agent aktivieren
2. SAML-Anwendung in Entra ID erstellen und Metadaten-URL abrufen
3. CDK-Deployment
4. AD-Authentifizierung über die Schaltfläche „AD-Anmeldung" in der CloudFront-Oberfläche ausführen

### CDK-Parameterliste

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|---------|-------------|
| `enableAdFederation` | boolean | `false` | SAML-Föderation aktivieren |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Managed AD-Administratorpasswort |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | AD-beigetretene Windows EC2-Instanz-ID |
| `samlMetadataUrl` | string | - | SAML IdP-Metadaten-URL |
| `adDomainName` | string | - | AD-Domänenname (z. B. demo.local) |
| `adDnsIps` | string | - | AD DNS-IPs (kommagetrennt) |
| `cloudFrontUrl` | string | - | OAuth-Callback-URL |

---

## Modus 3: OIDC/LDAP Federation (Multi-IdP / LDAP-Umgebungen)

### Funktionsweise

```
OIDC User -> CloudFront UI -> "Sign in with OIDC" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Wenn sich ein OIDC-Benutzer anmeldet, werden folgende Schritte automatisch durchgeführt:

1. **Automatische Cognito-Benutzererstellung** — Ein Cognito-Benutzer wird automatisch aus dem E-Mail-Attribut der OIDC-Assertion generiert
2. **Automatische Berechtigungsabfrage** — Identity Sync Lambda ruft SID/UID/GID/Gruppeninformationen vom LDAP-Server oder aus OIDC-Claims ab
3. **Automatische DynamoDB-Registrierung** — Die abgerufenen Berechtigungsdaten werden in der `user-access`-Tabelle gespeichert (24-Stunden-Cache)

### Konfigurationsgesteuerte automatische Aktivierung

Jede Authentifizierungsmethode wird automatisch aktiviert, wenn ihre Konfiguration bereitgestellt wird. Nahezu keine zusätzlichen AWS-Ressourcenkosten.

| Funktion | Aktivierungsbedingung | Zusätzliche Kosten |
|----------|----------------------|-------------------|
| OIDC Federation | `oidcProviderConfig` angegeben | Keine (Cognito IdP-Registrierung kostenlos) |
| LDAP-Berechtigungsabfrage | `ldapConfig` angegeben | Keine (nur Lambda-Nutzungsgebühren) |
| OIDC-Claims-Berechtigungen | `oidcProviderConfig` angegeben + kein `ldapConfig` | Keine |
| UID/GID-Berechtigungsfilterung | `permissionMappingStrategy` ist `uid-gid` oder `hybrid` | Keine |
| ONTAP Name-Mapping | `ontapNameMappingEnabled=true` | Keine |

> **Automatische CDK-Konfiguration**: Bei der CDK-Bereitstellung mit `oidcProviderConfig` werden folgende Elemente automatisch konfiguriert:
> - OIDC IdP wird im Cognito User Pool registriert
> - Cognito Domain wird erstellt (falls nicht bereits durch `enableAdFederation=true` erstellt)
> - OIDC IdP wird als unterstützter Anbieter zum User Pool Client hinzugefügt
> - Identity Sync Lambda wird erstellt und als Post-Authentication Trigger registriert
> - OAuth-Umgebungsvariablen (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`) werden automatisch auf der WebAppStack-Lambda konfiguriert
>
> Wenn sowohl `enableAdFederation=true` als auch `oidcProviderConfig` angegeben sind, werden SAML + OIDC unterstützt und beide Anmeldeschaltflächen angezeigt.

### Muster C: OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak)

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

### Muster D: OIDC Claims Only (ohne LDAP)

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

### Muster E: SAML + OIDC Hybrid

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

### CDK-Parameterliste (OIDC/LDAP)

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|---------|-------------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | IdP-Anzeigename (auf der Anmeldeschaltfläche angezeigt) |
| `oidcProviderConfig.clientId` | string | **Erforderlich** | OIDC-Client-ID |
| `oidcProviderConfig.clientSecret` | string | **Erforderlich** | OIDC-Client-Secret (Secrets Manager ARN empfohlen) |
| `oidcProviderConfig.issuerUrl` | string | **Erforderlich** | OIDC-Issuer-URL |
| `oidcProviderConfig.groupClaimName` | string | `groups` | Name des Gruppen-Claims |
| `ldapConfig.ldapUrl` | string | - | LDAP/LDAPS-URL (z. B. `ldaps://ldap.example.com:636`) |
| `ldapConfig.baseDn` | string | - | Such-Basis-DN (z. B. `dc=example,dc=com`) |
| `ldapConfig.bindDn` | string | - | Bind-DN (z. B. `cn=readonly,dc=example,dc=com`) |
| `ldapConfig.bindPasswordSecretArn` | string | - | Bind-Passwort Secrets Manager ARN |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | Benutzersuchfilter |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | Gruppensuchfilter |
| `permissionMappingStrategy` | string | `sid-only` | Berechtigungszuordnungsstrategie: `sid-only`, `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | ONTAP Name-Mapping-Integration |

---

## Integration mit Berechtigungsfilterung

Unabhängig vom Authentifizierungsmodus funktioniert der Berechtigungsfilterungsmechanismus auf die gleiche Weise. Der Permission Resolver wählt automatisch die geeignete Filterungsstrategie basierend auf der Authentifizierungsquelle aus.

### Filterungsstrategien

| Strategie | Bedingung | Verhalten |
|-----------|-----------|----------|
| SID Matching | Nur `userSID` vorhanden | Abgleich von `allowed_group_sids` des Dokuments mit Benutzer-SIDs |
| UID/GID Matching | Nur `uid` + `gid` vorhanden | Abgleich von `allowed_uids` / `allowed_gids` des Dokuments mit Benutzer-UID/GID |
| Hybrid Matching | Sowohl `userSID` als auch `uid` vorhanden | SID-Abgleich hat Priorität, UID/GID als Fallback |
| Deny All (Fail-Closed) | Keine Berechtigungsdaten | Zugriff auf alle Dokumente verweigert |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (automatische Strategieauswahl)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID Priorität → UID/GID Fallback
  v
Match -> ALLOW, No match -> DENY
```

**Unterschiede bei der SID-Datenquelle:**

| Authentifizierungsmodus | SID-Datenquelle | `source`-Feld |
|------------------------|----------------|---------------|
| E-Mail/Passwort | `setup-user-access.sh` (manuell) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatisch) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatisch) | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda (automatisch) | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda (automatisch) | `OIDC-Claims` |

### DynamoDB user-access Tabellenschema

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

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| Alle Dokumente nach der Anmeldung abgelehnt | Keine SID/UID/GID-Daten in DynamoDB | AD Federation: AD Sync Lambda-Protokolle prüfen. OIDC: Identity Sync Lambda-Protokolle prüfen. Manuell: `setup-user-access.sh` ausführen |
| Schaltfläche „AD-Anmeldung" wird nicht angezeigt | `enableAdFederation=false` | CDK-Parameter prüfen und erneut deployen |
| Schaltfläche „OIDC-Anmeldung" wird nicht angezeigt | `oidcProviderConfig` nicht konfiguriert | `oidcProviderConfig` zu den CDK-Parametern hinzufügen und erneut deployen |
| SAML-Authentifizierung fehlgeschlagen | Ungültige SAML-Metadaten-URL | Managed AD: IAM Identity Center-Einstellungen prüfen. Self-managed: Entra ID-Metadaten-URL prüfen |
| OIDC-Authentifizierung fehlgeschlagen | Ungültige `clientId` / `issuerUrl` | Überprüfen, ob die OIDC-IdP-Client-Einstellungen mit den CDK-Parametern übereinstimmen |
| LDAP-Berechtigungsabfrage fehlgeschlagen | LDAP-Verbindungsfehler | Identity Sync Lambda-Fehler in CloudWatch Logs prüfen. Die Anmeldung wird nicht blockiert (Fail-Open) |
| AD-Gruppenänderungen werden nicht übernommen | SID-Cache (24 Stunden) | 24 Stunden warten oder den betreffenden DynamoDB-Eintrag löschen und erneut anmelden |
| AD Sync Lambda-Zeitüberschreitung | PowerShell-Ausführung über SSM ist langsam | Umgebungsvariable `SSM_TIMEOUT` erhöhen (Standard: 60 Sekunden) |
| OIDC-Gruppen werden nicht abgerufen | Gruppen-Claim im IdP nicht konfiguriert | Überprüfen, ob der IdP den `groups`-Claim im Token enthält. `groupClaimName`-Parameter prüfen |
| DynamoDB-Berechtigungsdaten nach OIDC-Anmeldung nicht registriert | Post-Auth Trigger oder Identity Sync Lambda nicht erstellt | CDK-Bereitstellung mit `oidcProviderConfig` erstellt automatisch Identity Sync Lambda und Post-Auth Trigger. Lambda-Ausführungsprotokolle in CloudWatch Logs prüfen |
| OAuth-Callback-Fehler (OIDC-Konfiguration) | `cloudFrontUrl` nicht gesetzt | `cloudFrontUrl` ist auch für die OIDC-Konfiguration erforderlich. In `cdk.context.json` festlegen und erneut bereitstellen |

---

## Verwandte Dokumente

- [README.md — AD SAML-Föderation](../../README.de.md#ad-saml-föderation-option) — CDK-Deployment-Anleitung
- [docs/implementation-overview.md — Abschnitt 3: IAM-Authentifizierung](../de/implementation-overview.md#3-iam-authentifizierung--lambda-function-url-iam-auth--cloudfront-oac) — Authentifizierungsdesign auf Infrastrukturebene
- [docs/SID-Filtering-Architecture.md](../de/SID-Filtering-Architecture.md) — Detailliertes Design der SID-Filterung
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD-Integrationseinrichtung
