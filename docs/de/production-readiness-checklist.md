# Checkliste für die Produktionsbereitschaft

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | [한국어](../ko/production-readiness-checklist.md) | [简体中文](../zh-CN/production-readiness-checklist.md) | [繁體中文](../zh-TW/production-readiness-checklist.md) | [Français](../fr/production-readiness-checklist.md) | **Deutsch** | [Español](../es/production-readiness-checklist.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Teams, die eine Migration von PoC zur Produktion in Betracht ziehen

---

## Überblick

Dieses Dokument bietet eine Checkliste der zu überprüfenden Punkte bei der Migration des Permission-aware RAG-Systems von einer PoC-Umgebung in eine Produktionsumgebung.

---

## Definitionen der Reifegrade

| Stufe | Name | Beschreibung | Ziel |
|-------|------|--------------|------|
| L1 | Demo | Betrieb mit mitgelieferten Beispieldaten und Benutzern verifizieren. Schnellste Bereitstellung | Technische Validierung, interne Demos |
| L2 | PoC | Kunden-AD/IdP verbinden, echte Dateien einlesen, Evaluierungsprotokolle sammeln | Kundenvorschläge, Wirksamkeitsüberprüfung |
| L3 | Produktion | Multi-Account, Audit-Log-Aufbewahrung, DR, SLO, Bedrohungsmodell, Betriebs-Runbook | Produktiver Geschäftsbetrieb |

---

## L1 → L2 (Demo → PoC) Checkliste

### Authentifizierung & ID-Föderation

- [ ] Cognito User Pool mit Kunden-IdP verbinden (OIDC / SAML / LDAP)
- [ ] Erfolgreiche SSO-Anmeldung mit Testbenutzern bestätigen
- [ ] Automatische SID / UID+GID-Abfrage funktioniert bestätigen
- [ ] `authFailureMode` auf `fail-closed` setzen und Blockierungsverhalten bei Berechtigungsabfragefehler bestätigen

### Datenaufnahme

- [ ] Echte Dateien (10–100) auf FSx for ONTAP-Volume platzieren
- [ ] Korrekte Generierung von `.metadata.json` bestätigen
- [ ] Erfolgreichen Abschluss der Bedrock KB-Datenquellensynchronisierung bestätigen
- [ ] Korrekte Filterung der Suchergebnisse für Benutzer mit unterschiedlichen Berechtigungen bestätigen

### Evaluierung

- [ ] Qualitative Bewertung der Antwortgenauigkeit (10+ Fragen)
- [ ] Null Berechtigungsverletzungen bestätigen
- [ ] Antwortzeiten messen (P50 / P95 / P99)

---

## L2 → L3 (PoC → Produktion) Checkliste

### 1. Sicherheit

#### Verschlüsselung

- [ ] KMS CMK-Verschlüsselung für S3 / DynamoDB / FSx (`enableKmsEncryption=true`)
- [ ] KMS-Schlüsselrotation aktivieren
- [ ] TLS 1.2 oder höher erzwingen (CloudFront, ALB, FSx)
- [ ] Passwörter und API-Schlüssel mit Secrets Manager verwalten (nicht in `cdk.context.json` hartcodieren)

#### Netzwerk

- [ ] VPC-Endpunkte aktivieren (`enableVpcEndpoints=true`)
  - S3, DynamoDB, Bedrock, Bedrock Agent, CloudWatch Logs, STS
- [ ] Sicherheitsgruppenberechtigungen minimieren (unnötige Eingangsregeln entfernen)
- [ ] Ausgehenden Datenverkehr über NAT Gateway einschränken
- [ ] Geeignete CloudFront Geo-Einschränkungen konfigurieren

#### WAF

- [ ] Produktions-Ratenlimitwerte festlegen (Standard: 2000 Anfragen/5 Min.)
- [ ] IP-Zulassungsliste konfigurieren (nur interne IPs)
- [ ] WAF-Protokollspeicherung in S3 aktivieren
- [ ] Hinzufügen von Bot Control-Regeln in Betracht ziehen

#### IAM

- [ ] Lambda-Ausführungsrollenberechtigungen minimieren
- [ ] Bedrock KB-Rollenberechtigungen minimieren
- [ ] Kontoübergreifenden Zugriff einschränken
- [ ] Ungenutzte Berechtigungen mit IAM Access Analyzer erkennen

### 2. Audit & Protokollierung

- [ ] CloudTrail aktivieren (alle Regionen, Management-Events + Daten-Events)
- [ ] CloudWatch Logs-Aufbewahrungszeitraum festlegen (mindestens 1 Jahr)
- [ ] S3-Zugriffsprotokollierung aktivieren
- [ ] Berechtigungsänderungen über DynamoDB Streams verfolgen
- [ ] Bedrock-Modellaufrufprotokollierung aktivieren
- [ ] Manipulation von Audit-Protokollen verhindern (S3 Object Lock / Glacier Vault Lock)
- [ ] RAG-Suchprotokolle speichern (Benutzer-ID, Abfrage, referenzierte Dokumente, Filterergebnisse)

### 3. Verfügbarkeit & DR

- [ ] FSx for ONTAP Multi-AZ-Konfiguration bestätigen
- [ ] DynamoDB Point-in-Time Recovery (PITR) aktivieren
- [ ] S3-Versionierung aktivieren
- [ ] Backup-Zeitplan konfigurieren (automatische FSx-Backups)
- [ ] RTO / RPO definieren und verifizieren
- [ ] DR-Region auswählen und SnapMirror-Replikation entwerfen
- [ ] Dokumentation für manuelles Failover-Verfahren erstellen

### 4. Betrieb

- [ ] CloudWatch-Dashboard konfigurieren (`enableMonitoring=true`)
- [ ] Alarmschwellenwerte festlegen
  - Lambda-Fehlerrate > 1%
  - Bedrock-Latenz P95 > 10s
  - DynamoDB-Drosselung
  - FSx-Speicherauslastung > 80%
- [ ] Betriebs-Runbook erstellen
  - KB-Resynchronisierungsverfahren
  - Verfahren zur erzwungenen Berechtigungscache-Löschung
  - Verfahren zur Notfall-Berechtigungsentzug
  - Rollback-Verfahren
- [ ] Incident-Response-Ablauf definieren
- [ ] Bereitschaftsstruktur einrichten

### 5. Kostenmanagement

- [ ] Kostenalarme mit AWS Budgets einrichten
- [ ] Tagging-Strategie definieren (Environment, Project, CostCenter)
- [ ] S3-Lifecycle-Richtlinie (Glacier-Migration für Protokolle)
- [ ] Geeignete Lambda-Speicher- und Timeout-Werte festlegen
- [ ] Bedrock-Modellnutzung überwachen
- [ ] Monatlichen Kostenüberprüfungsprozess einrichten

### 6. Skalierbarkeit

- [ ] DynamoDB-Kapazitätsmodus auswählen (On-Demand vs. Provisioned)
- [ ] Lambda-Parallelitätslimits konfigurieren
- [ ] Bedrock-Durchsatz verifizieren (Provisioned Throughput in Betracht ziehen)
- [ ] Geeignete FSx-Durchsatzkapazität festlegen
- [ ] CloudFront-Caching-Strategie optimieren

### 7. Compliance

- [ ] Datenklassifizierungsrichtlinie erstellen (Vertraulich, Intern, Öffentlich)
- [ ] Regeln für den Umgang mit personenbezogenen Daten definieren
- [ ] Datenaufbewahrungsfristen definieren
- [ ] Nutzungsbedingungen und Datenschutzrichtlinie vorbereiten
- [ ] Branchenspezifische Vorschriften berücksichtigen (Gesundheitswesen: HIPAA, Finanzen: FISC, Öffentlich: ISMAP)

### 8. Tests

- [ ] Berechtigungsmatrix-Tests ausführen (siehe [tests/permission-matrix/](../tests/permission-matrix/))
- [ ] Lasttests (2x erwartete gleichzeitige Benutzer)
- [ ] Sicherheitstests (Penetrationstests)
- [ ] DR-Tests (Failover / Failback)
- [ ] Tests zur Berechtigungsänderungspropagierung (ACL-Änderung → Reflexion in Suchergebnissen)

---

## Abschließende Überprüfung vor der Produktionsbereitstellung

```bash
# 1. Änderungen mit CDK diff verifizieren
npx cdk diff --all

# 2. Sicherheitsscan
npx cdk synth --quiet | cfn-nag

# 3. Tests ausführen
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. Bereitstellung (mit Genehmigung)
npx cdk deploy --all --require-approval broadening
```

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [permission-consistency.md](permission-consistency.md) | Konsistenzmodell für Berechtigungsänderungen |
| [governance-and-audit.md](governance-and-audit.md) | Governance- und Audit-Design |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-Tenant-Bereitstellungsmuster |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Leitfaden für sicheres Experimentieren |
| [evaluation.md](evaluation.md) | RAG / Agent Bewertungsmetriken |
