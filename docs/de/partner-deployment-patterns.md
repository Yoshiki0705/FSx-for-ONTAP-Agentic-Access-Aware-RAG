# Multi-Tenant / Partner-Bereitstellungsmuster

**🌐 Language:** [日本語](../partner-deployment-patterns.md) | [English](../en/partner-deployment-patterns.md) | [한국어](../ko/partner-deployment-patterns.md) | [简体中文](../zh-CN/partner-deployment-patterns.md) | [繁體中文](../zh-TW/partner-deployment-patterns.md) | [Français](../fr/partner-deployment-patterns.md) | **Deutsch** | [Español](../es/partner-deployment-patterns.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Partnerunternehmen, SaaS-Anbieter, Multi-Tenant-Architekten

---

## Überblick

Dieses Dokument organisiert Architekturmuster für Partnerunternehmen, die das Permission-aware RAG-System für mehrere Kunden bereitstellen. Es bietet Designrichtlinien für kundenspezifische Datenisolierung, Authentifizierungsisolierung und Kostenisolierung.

---

## Zielkunden & Branchen

| Branche | Anwendungsfall | Berechtigungsanforderungen |
|---------|----------------|---------------------------|
| Fertigung | Abteilungsbasierte Suche in Konstruktionszeichnungen und technischen Dokumenten | Abteilung × Projekt × Vertraulichkeitsstufe |
| Finanzen | Berechtigungsbasierte Suche in regulatorischen Dokumenten und internen Berichten | Abteilung × Rolle × Kundeninformationsisolierung |
| Öffentlicher Sektor | Behördenbasierte Suche in Richtliniendokumenten und internen Materialien | Behörde × Position × Öffentlich/Nicht-öffentlich |
| Gesundheitswesen | Abteilungsbasierte Suche in Verfahrenshandbüchern und Forschungsmaterialien | Abteilung × Beruf × Patienteninformationsisolierung |
| Recht | Fallbasierte Suche in Verträgen und Präzedenzfällen | Fall × Bearbeiter × Mandantenisolierung |
| Bildung | Fakultätsbasierte Suche in Lehrmaterialien und Forschungsressourcen | Fakultät × Personal/Studierende × Labor |

---

## Vergleich der Bereitstellungsmuster

### Muster A: AWS-Kontoisolierung pro Kunde (Empfohlen: Enterprise)

```
┌─────────────────────────────────────────────────────────┐
│ Partner-Verwaltungskonto                                  │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ CDK Pipelines   │  │ StackSets       │               │
│ │ / CodePipeline  │  │ (Template dist) │               │
│ └────────┬────────┘  └────────┬────────┘               │
└──────────┼────────────────────┼─────────────────────────┘
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐      ┌──────────────┐
    │ Kunde A     │      │ Kunde B     │      │ Kunde C      │
    │ Konto       │      │ Konto       │      │ Konto        │
    │             │      │             │      │              │
    │ ・FSx ONTAP │      │ ・FSx ONTAP │      │ ・FSx ONTAP  │
    │ ・Bedrock KB│      │ ・Bedrock KB│      │ ・Bedrock KB │
    │ ・Cognito   │      │ ・Cognito   │      │ ・Cognito    │
    │ ・DynamoDB  │      │ ・DynamoDB  │      │ ・DynamoDB   │
    │ ・CloudFront│      │ ・CloudFront│      │ ・CloudFront │
    └─────────────┘      └─────────────┘      └──────────────┘
```

**Vorteile**:
- Vollständige Datenisolierung (AWS-Kontogrenze)
- Separate Abrechnung pro Kunde
- Begrenzter Wirkungsradius bei Sicherheitsvorfällen
- Unabhängiger Betrieb und Skalierung pro Kunde

**Nachteile**:
- Betriebsaufwand für Kontoverwaltung
- Doppelte Kosten für gemeinsame Komponenten
- Komplexität der Bereitstellungspipeline

**Anwendbar wenn**:
- Kunden eigene AWS-Konten haben
- Strenge Datenisolierungsanforderungen bestehen (Finanzen, Gesundheitswesen, öffentlicher Sektor)
- Kundenanzahl 10 oder weniger beträgt

### Muster B: SVM / Volume / Präfix-Isolierung innerhalb eines Kontos

```
┌─────────────────────────────────────────────────────────────────┐
│ Gemeinsames AWS-Konto                                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ FSx for ONTAP Dateisystem                                  │    │
│  │                                                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │ SVM-A    │  │ SVM-B    │  │ SVM-C    │               │    │
│  │  │(Kunde    │  │(Kunde    │  │(Kunde    │               │    │
│  │  │ A)       │  │ B)       │  │ C)       │               │    │
│  │  │ Vol-A1   │  │ Vol-B1   │  │ Vol-C1   │               │    │
│  │  │ Vol-A2   │  │ Vol-B2   │  │ Vol-C2   │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ KB-A     │  │ KB-B     │  │ KB-C     │  ← KB pro Mandant    │
│  │ S3 AP-A  │  │ S3 AP-B  │  │ S3 AP-C  │  ← AP pro Mandant   │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Gemeinsame Ressourcen                                      │    │
│  │ ・CloudFront + WAF (gemeinsam, pfadbasiertes Routing)     │    │
│  │ ・Cognito User Pool (isoliert durch Mandantenattribut)    │    │
│  │ ・DynamoDB (Mandanten-ID als Partitionsschlüssel)         │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteile**:
- Konsolidierter Betrieb (Verwaltung eines einzelnen Kontos)
- Geteilte Kosten für gemeinsame Komponenten
- Vereinfachte Bereitstellung

**Nachteile**:
- Datenisolierung auf Anwendungsebene (Fehlkonfigurationsrisiko)
- Abrechnungsaufteilung erforderlich
- Mögliche Noisy-Neighbor-Probleme

**Anwendbar wenn**:
- Kundenanzahl groß ist (10+ Unternehmen)
- Kosteneffizienz priorisiert wird
- Datenisolierungsanforderungen relativ gering sind

### Muster C: Hybrid (Gemeinsame Verwaltungsebene + Isolierte Datenebene)

```
┌─────────────────────────────────────────────────────────┐
│ Partner-Verwaltungskonto                                  │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Verwaltungsebene (Gemeinsam)                          │  │
│ │ ・CDK Pipelines / Bereitstellungsautomatisierung     │  │
│ │ ・Mandantenverwaltungs-API                           │  │
│ │ ・Überwachungs-Dashboard (aggregiert)                │  │
│ │ ・Abrechnungsverwaltung                              │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │ Datenebene (Isoliert pro Kunde)               │
    │                                              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │Kunde A   │  │Kunde B   │  │Kunde C   │  │
    │  │ VPC      │  │ VPC      │  │ VPC      │  │
    │  │ FSx+KB   │  │ FSx+KB   │  │ FSx+KB   │  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    └─────────────────────────────────────────────┘
```

---

## Designelemente der Mandantenisolierung

### 1. Speicherisolierung

| Isolierungsstufe | Methode | Datenisolierungsstärke | Kosten |
|------------------|---------|------------------------|--------|
| Dateisystemisolierung | FSx-Dateisystem pro Kunde | Höchste | Hoch |
| SVM-Isolierung | SVM-Isolierung innerhalb eines Dateisystems | Hoch | Mittel |
| Volume-Isolierung | Volume-Isolierung innerhalb einer SVM | Mittel | Niedrig |
| Präfix-Isolierung | Verzeichnisisolierung innerhalb eines Volumes | Niedrig | Am niedrigsten |

**Empfohlen**: SVM-Isolierung (Muster B) oder Dateisystemisolierung (Muster A)

### 2. Vektorspeicher-Isolierung

| Methode | S3 Vectors | OpenSearch Serverless |
|---------|-----------|---------------------|
| KB pro Mandant | Separate KB + Index | Separate KB + Collection |
| Gemeinsame KB + Metadatenfilter | Filtern nach `tenant_id`-Metadaten | Filtern nach `tenant_id`-Feld |

**Empfohlen**: KB pro Mandant (klare Sicherheitsgrenze)

### 3. Authentifizierungsisolierung

| Methode | Beschreibung | Anwendbares Muster |
|---------|--------------|-------------------|
| Cognito User Pool-Isolierung | User Pool pro Mandant | Muster A |
| Cognito-Gruppenisolierung | Gemeinsamer User Pool + Mandantengruppen | Muster B |
| Benutzerdefinierte Attributisolierung | `custom:tenant_id`-Attribut | Muster B |
| Externe IdP-Isolierung | OIDC/SAML IdP pro Mandant | Muster A/C |

### 4. Protokoll- & Audit-Isolierung

| Ressource | Isolierungsmethode |
|-----------|-------------------|
| CloudWatch Logs | Protokollgruppe oder Präfix pro Mandant |
| CloudTrail | Trail pro Mandant (Muster A) oder gemeinsamer Trail + Filter |
| DynamoDB-Audit-Tabelle | `tenantId`-Partitionsschlüssel |
| S3-Protokoll-Bucket | Präfix pro Mandant + Bucket-Richtlinie |

### 5. KMS-Verschlüsselungsisolierung

| Methode | Beschreibung | Kosten |
|---------|--------------|--------|
| CMK pro Mandant | Vollständige Verschlüsselungsisolierung | CMK × Mandantenanzahl |
| Gemeinsamer CMK + Schlüsselrichtlinie | Kosteneffizienz-Priorität | 1 CMK |
| Mandantenverwalteter CMK (BYOK) | Kunde verwaltet Schlüssel | Kunde trägt Kosten |

---

## Automatisierte Bereitstellung mit CDK

### StackSets-Muster (für Muster A)

```typescript
// Bereitstellung vom Partner-Verwaltungskonto zu Kundenkonten
const stackSet = new CfnStackSet(this, 'TenantStackSet', {
  stackSetName: 'permission-aware-rag-tenant',
  templateBody: tenantTemplate,
  parameters: [
    { parameterKey: 'TenantId', parameterValue: tenantId },
    { parameterKey: 'TenantDomain', parameterValue: tenantDomain },
  ],
  permissionModel: 'SERVICE_MANAGED',
  autoDeployment: { enabled: true, retainStacksOnAccountRemoval: false },
});
```

### CDK Pipelines-Muster (für Muster C)

```typescript
// Eine Stage für jeden Mandanten hinzufügen
for (const tenant of tenants) {
  pipeline.addStage(new TenantStage(this, `Tenant-${tenant.id}`, {
    env: { account: tenant.accountId, region: tenant.region },
    tenantConfig: tenant,
  }));
}
```

---

## Angebotsvorlage

### Vorher / Nachher

| Aspekt | Vorher (Aktueller Zustand) | Nachher (Mit diesem System) |
|--------|---------------------------|----------------------------|
| Dateisuche | Manuelles Durchsuchen gemeinsamer Ordner, geringe Suchgenauigkeit | KI präsentiert optimale Dokumente innerhalb des Berechtigungsbereichs |
| Berechtigungsverwaltung | Risiko des Verschwindens von Berechtigungsgrenzen bei KI-Nutzung | Bestehende NTFS ACL direkt in KI reflektiert |
| Wissensnutzung | Wissenssilos zwischen Abteilungen, personenabhängig | Organisationsübergreifende Wissenssuche unter Beachtung von Berechtigungen |
| Betriebsaufwand | Datenkopie und Berechtigungsneukonfiguration für KI erforderlich | Daten auf FSx direkt mit KI verbinden |

### PoC-Erfolgskriterien

| Metrik | Zielwert | Messmethode |
|--------|----------|-------------|
| Antwortgenauigkeit | 80%+ (menschliche Bewertung) | Bewertet mit 50-Fragen-Evaluierungsset |
| Berechtigungskontrolle | 0 Verletzungen | Verifiziert mit Berechtigungsmatrix-Test |
| Antwortzeit | P95 < 10 Sekunden | CloudWatch-Metriken |
| Betriebsaufwand | 50% Reduktion ggü. aktuellem Stand | Admin-Interviews |

### Zusätzliche Überlegungen für die Produktion

| Kategorie | Überlegungen |
|-----------|--------------|
| ID-Föderation | SSO-Integration mit bestehendem AD / IdP, MFA-Anforderungen |
| Audit | Suchprotokollaufbewahrung, Zugriffspfad, periodische Überprüfung |
| Datenklassifizierung | Vertraulichkeitsstufendefinitionen, KI-Nutzungseignungskriterien |
| Kostenmanagement | Monatliches Budget, Skalierungsplan, Kostenzuordnung |
| SLA | Verfügbarkeitsziele, RPO/RTO, Supportstruktur |
| Rechtliches | Nutzungsbedingungen, Datenverarbeitungsvereinbarung, Verantwortungsgrenzen |

---

## Kostenschätzungsvorlage

### Monatliche Schätzung (Kleiner PoC)

| Ressource | Konfiguration | Monatliche Schätzung |
|-----------|---------------|---------------------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | 300 $ |
| S3 Vectors | ~10.000 Vektoren | 5 $ |
| Bedrock (Titan Embed) | Initial + inkrementelle Synchronisierung | 10 $ |
| Bedrock (Claude) | 1.000 Abfragen/Monat | 50 $ |
| Lambda | WebApp + Sync | 20 $ |
| CloudFront + WAF | Grundgebühr | 15 $ |
| DynamoDB | On-Demand | 5 $ |
| Cognito | ~50 Benutzer | 0 $ (Free Tier) |
| **Gesamt** | | **~400 $/Monat** |

### Monatliche Schätzung (Produktion: Mittlere Skalierung)

| Ressource | Konfiguration | Monatliche Schätzung |
|-----------|---------------|---------------------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | 3.000 $ |
| OpenSearch Serverless | 4 OCU | 1.400 $ |
| Bedrock (Titan Embed) | Periodische Synchronisierung | 50 $ |
| Bedrock (Claude Sonnet) | 10.000 Abfragen/Monat | 500 $ |
| Lambda | WebApp + Sync + Überwachung | 100 $ |
| CloudFront + WAF | Produktionsdatenverkehr | 100 $ |
| DynamoDB | Provisioned | 50 $ |
| Cognito | ~500 Benutzer | 25 $ |
| CloudWatch | Logs + Metriken + Alarme | 50 $ |
| **Gesamt** | | **~5.300 $/Monat** |

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsbereitschaft |
| [governance-and-audit.md](governance-and-audit.md) | Governance- und Audit-Design |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Dimensionierung und Leistung |
