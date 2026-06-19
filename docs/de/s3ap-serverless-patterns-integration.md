# S3AP Serverless Patterns Integrationsarchitektur

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | [한국어](../ko/s3ap-serverless-patterns-integration.md) | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | [Français](../fr/s3ap-serverless-patterns-integration.md) | **Deutsch** | [Español](../es/s3ap-serverless-patterns-integration.md)

**Erstellungsdatum**: 2026-05-23  
**Status**: Entwurf  
**Zielgruppe**: Architekten, Partner-SAs

---

## Überblick

Dieses Dokument beschreibt die Integrationsarchitektur zwischen [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) (serverlose Verarbeitungsmuster für 17 UC) und diesem Projekt (Permission-aware Agentic RAG).

---

## Positionierung der beiden Projekte

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (Unternehmens-Dateiserver)                                │
│                                                                         │
│  NAS-Daten: Baupläne, Verträge, Krankenakten, Finanzberichte...         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (Verarbeitung /              │  │ (Berechtigungsbasierte       │
│  Transformation / Analyse)   │  │  KI-Suche & Dialog)          │
│                              │  │                              │
│ • Step Functions (Batch)     │  │ • Bedrock KB + Converse API  │
│ • AI/ML-Integration          │  │ • SID-Filterung              │
│ • Ergebnisse zurück nach FSx │  │ • Chat-UI (Next.js)          │
│                              │  │ • Agent-Modus                │
│ 17 Branchen-UCs              │  │ 14 Agent-Vorlagen            │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## Integrationsmuster

### Muster A: Verarbeitungsergebnisse über das RAG durchsuchbar machen

Die von den S3AP Serverless Patterns verarbeiteten und analysierten Ergebnisse werden als durchsuchbare Dokumente im RAG verwendet.

```
FSx for ONTAP (Rohdaten: DICOM-Bilder, Vertrags-PDFs, IoT-Protokolle)
  ↓ S3 AP (Lesen)
S3AP Serverless Patterns
  ├─ UC5: DICOM → Metadatenextraktion & Anonymisierung
  ├─ UC1: Verträge → Entitätsextraktion & Klassifizierung
  └─ UC3: IoT-Protokolle → Anomalieerkennung & Berichterstellung
  ↓ S3 AP (Zurückschreiben) oder S3-Bucket
FSx for ONTAP (verarbeitete Daten + .metadata.json)
  ↓ S3 AP (Lesen)
Permission-aware RAG (Bedrock KB)
  ↓ SID-Filterung
Benutzer: „Welche Produkte wiesen letzten Monat Anomalien bei der Qualitätsprüfung auf?"
```

**Vorteile**:
- Rohdaten (Bilder, Binärdaten) werden vor der Aufnahme in das RAG in für KI verständlichen Text umgewandelt
- Den Verarbeitungsergebnissen werden Berechtigungsmetadaten hinzugefügt, wodurch die abteilungsbezogene Zugriffskontrolle erhalten bleibt
- Beide Systeme nutzen dasselbe FSx for ONTAP-Volume gemeinsam (kein Kopieren von Daten erforderlich)

### Muster B: Verarbeitungs-Pipelines aus dem RAG auslösen

Wenn der Benutzer im Agent-Modus „Eine Analyse ausführen" anweist, werden die Step Functions des S3AP-Musters ausgelöst.

```
Benutzer: „Analysiere die neuesten Qualitätsprüfungsbilder und erstelle einen Bericht"
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: Fertigungsanalyse)
  ↓ Verarbeitung abgeschlossen
Agent: „Die Analyse ist abgeschlossen. Hier sind die Ergebnisse: ..."
```

### Muster C: Integration von Audit & Compliance

Die Audit-Ergebnisse von S3AP UC1 (Recht/Compliance) werden über das RAG durchsuchbar gemacht, sodass der Compliance-Status interaktiv überprüft werden kann.

```
S3AP UC1: Dateiserver-Audit → Erstellung des Audit-Berichts
  ↓
RAG: „Gibt es Dateien mit Compliance-Verstößen?"
  → Antworten aus Audit-Berichten im Rahmen der Berechtigungen des Benutzers
```

---

## Branchenspezifische Integrationszuordnung

| S3AP UC | Branche | RAG-Nutzung | Agent-Vorlage |
|---------|------|----------------|------------------|
| UC1 | Recht | Suche in Audit-Berichten, Überprüfung des Compliance-Status | `legalCompliance` |
| UC2 | Finanzen | Suche in per OCR verarbeiteten Rechnungen & Verträgen | `financial` |
| UC3 | Fertigung | Suche in Qualitätsprüfungsberichten & Anomalieerkennungsergebnissen | `search` |
| UC5 | Gesundheitswesen | Suche in DICOM-Metadaten & anonymisierten Befunden | `medicalGuideline` |
| UC10 | Bauwesen | Suche in BIM-Metadaten & Sicherheits-Compliance-Berichten | `project` |
| UC13 | Bildung | Suche in Ergebnissen der Artikelklassifizierung & Zitationsnetzwerken | `search` |
| UC14 | Versicherung | Suche in Gutachtenberichten & Schadensbewertungsergebnissen | `insuranceClaim` |
| UC16 | Öffentlicher Sektor | Suche in Dokumentklassifizierung & geschwärzten Dokumenten | `publicDocument` |

---

## Beispiele für Bereitstellungskonfigurationen

### Minimale Konfiguration (einzelnes Konto)

```
AWS Account
├── FSx for ONTAP (gemeinsames Volume)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (selektive Bereitstellung)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### Enterprise-Konfiguration (mehrere Konten)

```
Management Account
├── StackSets (Verteilung der S3AP-Muster)
└── CDK Pipelines (Verteilung des RAG)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## Zugehörige Dokumente

| Dokument | Inhalt |
|----------|---------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-Tenant-Bereitstellungsmuster |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR (Vektorspeicher, Berechtigungsfilter usw.) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Details zu den 17 UC |
