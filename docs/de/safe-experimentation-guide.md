# Leitfaden für sicheres Experimentieren

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | [한국어](../ko/safe-experimentation-guide.md) | [简体中文](../zh-CN/safe-experimentation-guide.md) | [繁體中文](../zh-TW/safe-experimentation-guide.md) | [Français](../fr/safe-experimentation-guide.md) | **Deutsch** | [Español](../es/safe-experimentation-guide.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: PoC-Benutzer, Entwickler, Evaluierer

---

## Überblick

Dieses Dokument bietet Bereichsdefinitionen, verbotene Aktionen und Rollback-Verfahren für sicheres Experimentieren mit dem Permission-aware RAG-System. Es verdeutlicht „eine Umgebung, in der Sie innerhalb der Grenzen von Responsible AI-Richtlinien und Sicherheit experimentieren können."

---

## Bereich für sicheres Experimentieren

### ✅ Empfohlen: Nur mit Demodaten experimentieren

| Operation | Risiko | Hinweise |
|-----------|--------|----------|
| Suchtests mit Demodaten | Keines | Betrieb mit mitgelieferten Beispieldaten verifizieren |
| Berechtigungsüberprüfung durch Benutzerwechsel | Keines | Suchergebnisunterschiede zwischen Admin / Benutzer bestätigen |
| Agent-Modus-Experimente | Keines | Agent-Erstellung und -Tests im Agent Directory |
| UI-Anpassung | Keines | Änderungen am Next.js-Quellcode |
| CDK-Parameteränderungen | Niedrig | Änderungen an `cdk.context.json` → erneute Bereitstellung |
| Hinzufügen neuer Dokumente | Niedrig | Hinzufügen zum Demodaten-Ordner |
| Guardrails-Richtlinienanpassungen | Niedrig | Änderungen an `guardrailsConfig` |
| Smart Routing EIN/AUS | Keines | Seitenleisten-Umschalter |
| Modellauswahländerungen | Niedrig | Kostenvariation möglich |
| Sprachchat-Experimente | Niedrig | Aktivieren mit `enableVoiceChat=true` |

### ⚠️ Vorsicht: Checkliste vor der Aufnahme realer Daten

Überprüfen Sie Folgendes, bevor Sie tatsächliche Geschäftsdaten aufnehmen:

- [ ] **Datenklassifizierung abgeschlossen**: Vertraulichkeitsstufe der aufzunehmenden Daten wurde klassifiziert
- [ ] **PII-Überprüfung**: Wenn personenbezogene Daten enthalten sind, ist Maskierung oder Genehmigung abgeschlossen
- [ ] **Berechtigungsdesign-Überprüfung**: `allowed_group_sids` in `.metadata.json` ist korrekt konfiguriert
- [ ] **Audit-Protokollierung aktiviert**: CloudWatch Logs / CloudTrail sind aktiviert
- [ ] **Zugriffsbeschränkungen überprüft**: WAF / Geo-Einschränkungen / IP-Einschränkungen sind angemessen konfiguriert
- [ ] **Backup-Überprüfung**: Automatisches FSx-Backup ist aktiviert
- [ ] **Benutzerbenachrichtigung**: PoC-Teilnehmer wurden über Datenhandhabungsregeln informiert
- [ ] **Datenlöschungsverfahren bestätigt**: Datenlöschungsverfahren nach PoC-Abschluss wurde bestätigt

### ❌ Verbotene Aktionen

| Verbotene Aktion | Grund | Alternative |
|------------------|-------|-------------|
| Direkte Verbindung zum Produktions-AD (PoC-Phase) | Risiko der Auswirkung auf die Produktionsumgebung | Test-AD / Cognito-E-Mail-Authentifizierung verwenden |
| Aufnahme von PII-unklassifizierten Daten | Risiko der Offenlegung personenbezogener Daten | Nach PII-Scan aufnehmen |
| Verwendung vertraulicher Daten ohne Audit-Protokollierung | Compliance-Verstoß | Nach Aktivierung der Audit-Logs aufnehmen |
| Speicherung vertraulicher Daten ohne Verschlüsselung | Risiko der Datenoffenlegung | `enableKmsEncryption=true` setzen |
| Zugriff aus dem öffentlichen Internet erlauben | Risiko unbefugten Zugriffs | IP-Einschränkungen / VPN verwenden |
| PoC im Produktionskonto ausführen | Auswirkung auf die Produktionsumgebung | Sandbox-Konto verwenden |
| Verwendung vertraulicher Daten bei deaktivierten Guardrails | Risiko unangemessener Antwortgenerierung | `enableGuardrails=true` setzen |

---

## Verfahren zum Experimentieren nur mit Demodaten

### Schritt 1: Mit Minimalkonfiguration bereitstellen

```bash
# Minimale cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# Bereitstellen
npx cdk deploy --all --require-approval never

# Testdaten + Benutzererstellung
bash demo-data/scripts/post-deploy-setup.sh
```

### Schritt 2: Betrieb verifizieren

```bash
# CloudFront-URL abrufen
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "Zugriffs-URL: $URL"
```

### Schritt 3: Berechtigungsfilterung verifizieren

1. Als `admin@example.com` anmelden → Alle Dokumente sind durchsuchbar
2. Als `user@example.com` anmelden → Nur öffentliche Dokumente sind durchsuchbar
3. Bestätigen, dass für dieselbe Frage unterschiedliche Antworten zurückgegeben werden

### Schritt 4: Evaluierung

PoC-Evaluierung mit der Bewertungsvorlage in [evaluation.md](evaluation.md) durchführen.

---

## Verfahren zur Aufnahme realer Daten (nach Abschluss der Checkliste)

### Schritt 1: Datenvorbereitung

```bash
# 1. Dokumente klassifizieren
# .metadata.json für jedes Dokument erstellen
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII-Scan (empfohlen)
# PII mit Amazon Comprehend erkennen
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### Schritt 2: Datenaufnahme

```bash
# Dateien auf FSx-Volume platzieren (über SMB)
# Oder S3-Bucket-Fallback-Pfad verwenden
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### Schritt 3: KB-Synchronisierung

```bash
# KB-Synchronisierung ausführen
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# Auf Synchronisierungsabschluss warten
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### Schritt 4: Berechtigungstests

```bash
# Berechtigungsmatrix-Tests ausführen
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## Rollback / Umgebungslöschungsverfahren

### Teilweiser Rollback (nur Datenlöschung)

```bash
# 1. KB-Datenquellensynchronisierung löschen
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. S3-Bucket-Daten löschen
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. DynamoDB-Benutzerdaten löschen
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### Vollständige Löschung (alle Ressourcen)

```bash
# 1. S3-Bucket leeren (wenn Versionierung aktiviert ist)
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy (alle Stacks löschen)
npx cdk destroy --all --force

# 3. CDK Bootstrap-Ressourcen löschen (falls erforderlich)
# ⚠️ Nicht löschen, wenn andere CDK-Projekte existieren
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### Kostenbereinigungsüberprüfung

```bash
# Auf verbleibende Ressourcen prüfen
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# FSx-Dateisysteme prüfen (Löschung dauert)
aws fsx describe-file-systems --region ap-northeast-1

# OpenSearch Serverless-Collections prüfen
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## Fehlerbehebung

### Häufige Probleme und Lösungen

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Bereitstellung dauert über 40 Minuten | FSx for ONTAP-Erstellung benötigt Zeit | Normal. FSx-Erstellung dauert 20–30 Min. |
| Suche gibt 0 Ergebnisse zurück | KB-Synchronisierung unvollständig oder Datenquelle nicht konfiguriert | `StartIngestionJob`-Ausführung überprüfen |
| Gleiche Ergebnisse für alle Benutzer | SID-Daten nicht registriert | DynamoDB `user-access`-Tabelle prüfen |
| Fail-Closed verweigert alles | DynamoDB-Verbindungsfehler oder kein SID-Datensatz | Lambda-Logs prüfen |
| Agent funktioniert nicht | Agent nicht erstellt oder nicht im PREPARED-Status | Agent-Status in der Bedrock-Konsole prüfen |
| Kosten höher als erwartet | OpenSearch Serverless OCU | Zu `vectorStoreType=s3vectors` wechseln |

### Support-Ressourcen

| Ressource | URL |
|-----------|-----|
| GitHub Issues | Repository Issues-Tab |
| AWS-Dokumentation (Bedrock) | https://docs.aws.amazon.com/bedrock/ |
| AWS-Dokumentation (FSx for ONTAP) | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [evaluation.md](evaluation.md) | RAG / Agent Bewertungsmetriken |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsbereitschaft |
| [governance-and-audit.md](governance-and-audit.md) | Governance- und Audit-Design |
| [permission-consistency.md](permission-consistency.md) | Konsistenzmodell für Berechtigungsänderungen |
