# Governance- und Audit-Design

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | [한국어](../ko/governance-and-audit.md) | [简体中文](../zh-CN/governance-and-audit.md) | [繁體中文](../zh-TW/governance-and-audit.md) | [Français](../fr/governance-and-audit.md) | **Deutsch** | [Español](../es/governance-and-audit.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Sicherheitsbeauftragte, Compliance-Beauftragte, öffentlicher/Gesundheits-/Finanzsektor

---

## Überblick

Dieses Dokument organisiert das Audit-Log-Design, das Governance-Framework und die Richtlinien zur Implementierung verantwortungsvoller KI für das Permission-aware RAG-System. Das Ziel ist es, erklärbar zu machen: „Wer hat wann, basierend auf welchen Dokumenten, welche Antworten erhalten."

---

## Audit-Log-Schema

### RAG-Such-Audit-Log

Die folgenden Informationen werden für alle RAG-Suchanfragen aufgezeichnet.

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Agent-Modus-Audit-Log

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### Berechtigungsänderungs-Audit-Log

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## Protokollspeicherung & Schutzarchitektur

```
┌──────────────────────────────────────────────────────────────────┐
│                        Audit-Log-Fluss                             │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (Audit-Log-Bucket)   │ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ Retention:1yr│    │ ・KMS-Verschlüsselung   │ │
│                  └──────────────┘    │ ・Lifecycle:            │ │
│                                      │   90d→IA, 365d→Glacier  │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API-Aufr.│    │ (Data events)│                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ Perm-    │    │ Streams      │───▶ Berechtigungsänderungs-     │
│  │ Änderung │    └──────────────┘     Audit-Log                  │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Empfohlene Konfiguration

| Komponente | Einstellung | Zweck |
|------------|-------------|-------|
| CloudWatch Logs | Aufbewahrung: 1 Jahr | Betriebsprotokolle, Debugging |
| S3 Audit-Log-Bucket | Object Lock (Governance-Modus) | Manipulationsschutz |
| KMS CMK | Auto-Rotation aktiviert | Verschlüsselung |
| CloudTrail | Management + Daten-Events | API-Aufrufverfolgung |
| S3 Lifecycle | 90 Tage → IA, 365 Tage → Glacier | Kostenoptimierung |
| Athena | Partitionierte Tabellen | Protokollanalyse und -suche |

---

## Verantwortungsvolle KI / Guardrails-Design

### Nutzung von Bedrock Guardrails

Guardrails-Konfiguration aktiviert mit `enableGuardrails=true`:

| Richtlinie | Zweck | Konfigurationsbeispiel |
|------------|-------|------------------------|
| Inhaltsfilter | Schädliche Inhalte erkennen und blockieren | HATE: HIGH, VIOLENCE: HIGH |
| Themenrichtlinie | Verbotene Themen definieren | Wettbewerberinformationen, Anlageberatung |
| PII-Erkennung | Personenbezogene Daten erkennen und maskieren | Namen, Telefonnummern, E-Mail-Adressen |
| Wortfilter | Verbotene Phrasen blockieren | Interne Codenamen, unveröffentlichte Informationen |

### Guardrails-Beispielrichtlinie

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### Kontrollen nach Datenklassifizierung

| Datenklassifizierung | Suche | Zusammenfassung | Zitat | Agent-Nutzung |
|---------------------|-------|-----------------|-------|---------------|
| Öffentlich | ✅ Erlaubt | ✅ Erlaubt | ✅ Erlaubt | ✅ Erlaubt |
| Intern | ✅ Erlaubt | ✅ Erlaubt | ⚠️ Nur Zusammenfassung | ✅ Erlaubt |
| Vertraulich | ✅ Erlaubt (nur Autorisierte) | ⚠️ Eingeschränkt | ❌ Kein wörtliches Zitat | ⚠️ Mit Genehmigung |
| Streng geheim | ⚠️ Mit Genehmigung | ❌ Verboten | ❌ Verboten | ❌ Verboten |

### Menschliche Genehmigung für Agent-Modus

Design, bei dem der Agent vor der Ausführung externer Aktionen eine menschliche Genehmigung anfordert:

```
Agent versucht "E-Mail senden"-Tool aufzurufen
  → AgentCore-Richtlinie erkennt Kategorie "Externe Kommunikation"
  → Generiert Anfrage zur menschlichen Genehmigung
  → UI zeigt dem Benutzer Genehmigungs-/Ablehnungsaufforderung
  → Aktion wird nur nach Genehmigung ausgeführt
```

---

## Branchenspezifische Anwendungsfälle und regulatorische Compliance

### Gesundheitswesen

| Anforderung | Implementierung |
|-------------|-----------------|
| Patienteninformationsisolierung | Abteilungsspezifische SID-Gruppen + PII-Maskierung |
| Abteilungsspezifische Verfahrenssuche | Filtern nach Abteilungs-SID |
| Audit-Trail | 5-jährige Aufbewahrung aller Suchprotokolle |
| Einwilligungsverwaltung | Patienteneinwilligungsflag in Metadaten aufnehmen |
| Medizinische Diagnose verbieten | DENY über Guardrails-Themenrichtlinie |

**Regulatorische Compliance**: Richtlinien für das Sicherheitsmanagement von Gesundheitsinformationssystemen

### Regierung / Öffentlicher Sektor

| Anforderung | Implementierung |
|-------------|-----------------|
| Behördenspezifische Dokumentenisolierung | Behörden-SID-Gruppen |
| Trennung von Richtlinien und nicht-öffentlichen Materialien | `access_level`-Metadaten + SID |
| Unterstützung von Informationsfreiheitsanfragen | Suchprotokollaufbewahrung und Exportfähigkeit |
| Schutz personenbezogener Daten | PII-Erkennung + Maskierung |
| Verwaltungsdokumentenmanagement | Dokumentenklassifizierungs-Metadatenzuweisung |

**Regulatorische Compliance**: Datenschutzgesetz, ISMAP

### Finanzinstitute

| Anforderung | Implementierung |
|-------------|-----------------|
| Strenge Kundeninformationsisolierung | Kunden-ID-basierte Zugriffskontrolle |
| Anlageberatung verbieten | Guardrails-Themenrichtlinie |
| Transaktionsaufzeichnungsaufbewahrung | 10-jährige Audit-Log-Aufbewahrung |
| Interne Kontrollen | Periodische Überprüfung der Betriebsprotokolle |
| Verschlüsselungsanforderungen | KMS CMK + TLS 1.2 |

**Regulatorische Compliance**: FISC-Sicherheitsrichtlinien, Finanzinstrumente- und Börsengesetz

### Bildungseinrichtungen

| Anforderung | Implementierung |
|-------------|-----------------|
| Fakultäts-/Studierenden-Berechtigungstrennung | Rollenbasierte SID-Gruppen |
| Laborspezifische Materialisolierung | Labor-SID-Gruppen |
| Schutz personenbezogener Daten von Studierenden | PII-Maskierung |
| Vertraulichkeit von Forschungsdaten | Zugriffskontrolle pro Forschungsprojekt |

---

## Audit-Berichtsgenerierung

### Periodische Berichtselemente

| Bericht | Häufigkeit | Inhalt |
|---------|------------|--------|
| Zugriffszusammenfassung | Täglich | Suchanzahl pro Benutzer, Ablehnungsanzahl |
| Berechtigungsverletzungsbericht | Täglich | Fail-Closed-Auslöser, anomale Zugriffsmuster |
| Guardrails-Interventionsbericht | Wöchentlich | Filterauslöseranzahl, Statistiken nach Thema |
| Kosten- & Nutzungsbericht | Monatlich | Token-Verbrauch, API-Aufrufanzahl, Speichernutzung |
| Compliance-Bericht | Vierteljährlich | Status der regulatorischen Anforderungskonformität, Verbesserungspunkte |

### Athena-Abfragebeispiele

```sql
-- Berechtigungsablehnungsereignisse der letzten 7 Tage
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- Suchmusteranalyse nach Benutzer
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## Umgang mit personenbezogenen und sensiblen Daten

### Maskierungs- / Klassifizierungsfluss

```
Dokumentenaufnahme
  → PII-Scan (Comprehend / Guardrails)
  → Klassifizierungslabel-Zuweisung (Vertraulichkeitsstufe + PII-Vorhandensein)
  → Klassifizierungsinformationen in .metadata.json aufzeichnen
  → KB-Sync
  
Bei der Suche
  → SID-Filterung (Zugriffsberechtigungen)
  → Guardrails PII-Erkennung (Ausgabemaskierung)
  → Antwortgenerierung (maskiert)
```

### Genehmigungsfluss (Zugriff auf vertrauliche Daten)

Genehmigungsfluss, wenn Zugriff auf streng geheime Daten erforderlich ist:

1. Benutzer sendet Suchanfrage
2. SID-Abgleich identifiziert Kategorie „Genehmigung erforderlich"
3. Genehmigungsanfrage-Benachrichtigung an Admin gesendet (SNS / Slack)
4. Admin genehmigt → temporäres Zugriffstoken ausgestellt
5. Zugriff nur während der Token-Gültigkeitsdauer verfügbar
6. Zugriffsprotokoll in Audit-Tabelle aufgezeichnet

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsbereitschaft |
| [permission-consistency.md](permission-consistency.md) | Konsistenzmodell für Berechtigungsänderungen |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID-Filterarchitektur |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Leitfaden für sicheres Experimentieren |
