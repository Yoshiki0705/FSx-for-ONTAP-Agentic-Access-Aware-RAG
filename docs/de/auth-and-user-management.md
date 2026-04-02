# Leitfaden für Authentifizierung und Benutzerverwaltung

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | [Français](../fr/auth-and-user-management.md) | **Deutsch** | [Español](../es/auth-and-user-management.md)

**Erstellungsdatum**: 2026-04-02
**Version**: 3.3.0

---

## Übersicht

Dieses System bietet zwei Authentifizierungsmodi. Sie können beim Deployment über CDK-Kontextparameter zwischen ihnen wechseln.

| Modus | CDK-Parameter | Benutzererstellung | SID-Registrierung | Empfohlene Verwendung |
|-------|--------------|-------------------|-------------------|----------------------|
| E-Mail/Passwort | `enableAdFederation=false` (Standard) | Administrator erstellt manuell | Administrator registriert manuell | PoC / Demo |
| AD Federation | `enableAdFederation=true` | Automatische Erstellung bei erster Anmeldung | Automatische Registrierung bei Anmeldung | Produktion / Enterprise |

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

## Integration mit SID-Filterung

Unabhängig vom Authentifizierungsmodus funktioniert der SID-Filterungsmechanismus auf die gleiche Weise.

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

**Unterschiede bei der SID-Datenquelle:**

| Authentifizierungsmodus | SID-Datenquelle | `source`-Feld |
|------------------------|----------------|---------------|
| E-Mail/Passwort | `setup-user-access.sh` (manuell) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatisch) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatisch) | `AD-Sync-self-managed` |

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
| Alle Dokumente nach der Anmeldung abgelehnt | Keine SID-Daten in DynamoDB | AD Federation: AD Sync Lambda-Protokolle prüfen. Manuell: `setup-user-access.sh` ausführen |
| Schaltfläche „AD-Anmeldung" wird nicht angezeigt | `enableAdFederation=false` | CDK-Parameter prüfen und erneut deployen |
| SAML-Authentifizierung fehlgeschlagen | Ungültige SAML-Metadaten-URL | Managed AD: IAM Identity Center-Einstellungen prüfen. Self-managed: Entra ID-Metadaten-URL prüfen |
| AD-Gruppenänderungen werden nicht übernommen | SID-Cache (24 Stunden) | 24 Stunden warten oder den betreffenden DynamoDB-Eintrag löschen und erneut anmelden |
| AD Sync Lambda-Zeitüberschreitung | PowerShell-Ausführung über SSM ist langsam | Umgebungsvariable `SSM_TIMEOUT` erhöhen (Standard: 60 Sekunden) |

---

## Verwandte Dokumente

- [README.md — AD SAML-Föderation](../../README.de.md#ad-saml-föderation-option) — CDK-Deployment-Anleitung
- [docs/implementation-overview.md — Abschnitt 3: IAM-Authentifizierung](../de/implementation-overview.md#3-iam-authentifizierung--lambda-function-url-iam-auth--cloudfront-oac) — Authentifizierungsdesign auf Infrastrukturebene
- [docs/SID-Filtering-Architecture.md](../de/SID-Filtering-Architecture.md) — Detailliertes Design der SID-Filterung
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — FSx ONTAP AD-Integrationseinrichtung
