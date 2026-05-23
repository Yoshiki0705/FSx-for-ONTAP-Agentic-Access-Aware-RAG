# Architecture Decision Records (ADR) — Architektur-Entscheidungsaufzeichnungen

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | [한국어](../ko/architecture-decision-records.md) | [简体中文](../zh-CN/architecture-decision-records.md) | [繁體中文](../zh-TW/architecture-decision-records.md) | [Français](../fr/architecture-decision-records.md) | **Deutsch** | [Español](../es/architecture-decision-records.md)

**Erstellungsdatum**: 2026-05-23  
**Status**: Genehmigt  
**Zielgruppe**: Architekten, technische Leiter, alle die die Entscheidungshintergründe verstehen möchten

---

## Überblick

Dieses Dokument zeichnet die wichtigsten Architekturentscheidungen und deren Begründungen für das Permission-aware Agentic RAG System auf. Es erklärt „warum diese Konfiguration gewählt wurde" und dient als Referenz für zukünftige Änderungsentscheidungen.

---

## ADR-001: Vektorspeicher — S3 Vectors als Standard

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-03-29 |
| **Kontext** | Ob S3 Vectors oder OpenSearch Serverless als Standard-Vektorspeicher für die RAG-Suche verwendet werden soll |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| S3 Vectors (gewählt) | Wenige Dollar/Monat, null Betrieb, Ein-Klick-AOSS-Export | Kalte Abfrage: Sub-Sekunde, nicht für hohen QPS geeignet |
| OpenSearch Serverless | Konstant 50ms, hoher QPS-Support, Volltextsuche | Minimum $700/Monat (2 OCU), OCU-Management erforderlich |

### Entscheidung

**S3 Vectors als Standard**, mit der Möglichkeit über den Parameter `vectorStoreType` zu OpenSearch Serverless zu wechseln.

### Begründung

1. Für PoC / kleine Nutzung senkt der Start bei wenigen Dollar/Monat die Einstiegshürde
2. Zugriff über Bedrock KB ist vektorspeicher-unabhängig, SID-Filterlogik ist gemeinsam
3. Bei steigenden Leistungsanforderungen Ein-Klick-Export zu AOSS über die Konsole (~15 Minuten)
4. Alle S3 Vectors Metadaten sind filterbar (keine zusätzliche Konfiguration nötig)

### Auswirkungen

- Standard-Bereitstellungskosten deutlich reduziert ($700/Monat → $5/Monat)
- Hochleistungsumgebungen erfordern Wechsel zu `vectorStoreType=opensearch`
- Beachten Sie die 2KB-Grenze für filterbare Metadaten in S3 Vectors (bei großen PDF-Metadaten)

---

## ADR-002: Berechtigungsfilterung — Anwendungsseitige SID-Zuordnung

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-01-15 |
| **Kontext** | Auf welcher Ebene die Berechtigungsfilterung der RAG-Suchergebnisse implementiert werden soll |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| Anwendungsseitige SID-Zuordnung (gewählt) | Vektorspeicher-unabhängig, LLM-Umgehung unmöglich, einfache Fail-Closed-Implementierung | Post-Search-Filter, abgerufene Anzahl > angezeigte Anzahl |
| Vektorspeicher Metadata-Filter | Filtert bei der Suche, effizient | Nicht direkt über Bedrock KB Retrieve API steuerbar |
| Bedrock KB RetrieveAndGenerate | Ein einziger API-Aufruf | Metadaten werden nicht zurückgegeben, SID-Filterung unmöglich |

### Entscheidung

Einen **zweistufigen Ansatz: Bedrock KB Retrieve API + anwendungsseitige SID-Zuordnung + Converse API** übernehmen.

### Begründung

1. Die RetrieveAndGenerate API enthält `allowed_group_sids` nicht in den Zitat-Metadaten, was SID-Filterung unmöglich macht
2. Anwendungsseitige Filterung läuft außerhalb des LLM, kann nicht durch Prompt Injection umgangen werden
3. Gemeinsame Logik unabhängig vom Vektorspeichertyp (S3 Vectors / AOSS)
4. Fail-Closed-Implementierung (bei SID-Abruffehler alles ablehnen) ist eindeutig

### Auswirkungen

- Höhere Abrufanzahl erforderlich, da Filterung auf alle Dokumente der Retrieve API angewendet wird
- Antwortqualität kann sinken, wenn nach der Filterung wenige Dokumente übrig bleiben
- Berechtigungscache (DynamoDB, TTL 5 Minuten) beschleunigt wiederholte Prüfungen

---

## ADR-003: Authentifizierung — Cognito + Multi-IdP-Föderation

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-02-01 |
| **Kontext** | Auswahl der Benutzerauthentifizierung und SID/UID/GID-Abrufmethode |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| Cognito + SAML/OIDC/LDAP (gewählt) | 5 Modi unterstützt, CDK-Parameter-Umschaltung, Fail-Closed-Unterstützung | Cognito-Einschränkungen (Anzahl benutzerdefinierter Attribute, Token-Größe) |
| IAM Identity Center direkte Nutzung | AWS-natives SSO | Komplexe Integration mit RAG-App |
| Benutzerdefinierte Authentifizierung (Lambda Authorizer) | Volle Flexibilität | Hohe Implementierungs- und Betriebskosten |

### Entscheidung

**Cognito User Pool** als Hub verwenden, mit 5 über CDK-Parameter umschaltbaren Modi: SAML (AD Federation), OIDC (Auth0/Keycloak/Okta), LDAP (OpenLDAP/FreeIPA) und E-Mail/Passwort.

### Begründung

1. Cognito integriert sich einfach mit CloudFront + Lambda Function URL (IAM Auth)
2. Post-Authentication Trigger ermöglicht automatischen SID/UID/GID-Abruf und DynamoDB-Registrierung
3. `authFailureMode=fail-closed` blockiert die Anmeldung bei Fehler beim Berechtigungsabruf
4. Flexibilität zur Modusauswahl basierend auf dem bestehenden IdP des Kunden

### Auswirkungen

- Beachten Sie Cognito-Einschränkungen (50 benutzerdefinierte Attribute, 2KB Token-Größe)
- SAML-Metadaten-URL-Verwaltung erforderlich (bei IdP-Zertifikatserneuerung)
- LDAP-Direktabfrage erfordert Lambda im VPC

---

## ADR-004: Frontend — Lambda Web Adapter + Next.js 15

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-01-10 |
| **Kontext** | Auswahl der Webanwendungs-Hosting-Methode |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| Lambda Web Adapter + Next.js (gewählt) | Serverless, IAM Auth + OAC, Kaltstart akzeptabel | Kaltstart 3-5 Sekunden, Docker-Image-Größe |
| ECS Fargate | Immer aktiv, niedrige Latenz | Minimum $30/Monat (immer aktiv), ALB erforderlich |
| Amplify Hosting | Verwaltet, CI/CD-Integration | IAM Auth nicht unterstützt, Anpassungsbeschränkungen |
| App Runner | Einfaches Deployment, Auto-Scaling | IAM Auth nicht unterstützt, VPC-Integrationsbeschränkungen |

### Entscheidung

Next.js 15 serverless mit **Lambda Web Adapter** ausführen, geschützt durch CloudFront OAC + IAM Auth.

### Begründung

1. IAM-Authentifizierung (Function URL + OAC) verhindert vollständig den direkten Zugriff außerhalb von CloudFront
2. Serverless bedeutet null Kosten während Leerlaufzeiten
3. Ein-Befehl-CDK-Deployment (einschließlich Docker-Image-Build)
4. Next.js 15 App Router + Server Components ermöglichen SSR/ISR

### Auswirkungen

- Kaltstart (3-5 Sekunden) tritt beim ersten Zugriff auf. Kann mit Provisioned Concurrency gemildert werden
- Docker-Image-Größenoptimierung erforderlich (Multi-Stage-Build)
- Apple Silicon (M1/M2/M3) erfordert Pre-Build-Modus (x86_64 Lambda-Kompatibilität)

---

## ADR-005: Datensynchronisierung — KB Auto-Sync (Polling-Methode)

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-04-15 |
| **Kontext** | Methode zur Übertragung von Dateiänderungen auf FSx for ONTAP in Bedrock KB |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| EventBridge Scheduler Polling (gewählt) | Einfach, keine FSx-Events nötig, S3 AP-kompatibel | Max. 15 Minuten Verzögerung, ListObjectsV2-Kosten |
| CloudTrail + EventBridge (ereignisgesteuert) | Nahezu Echtzeit | Begrenzte CloudTrail-Unterstützung für S3 AP |
| FSx Audit Log + EventBridge | Dateiebene-Events | Komplexe Einrichtung, hohes Log-Volumen |
| Nur manueller Trigger | Am einfachsten | Betriebsbelastung, Risiko verpasster Synchronisierungen |

### Entscheidung

**EventBridge Scheduler Polling in 5-15 Minuten Intervallen** als Standard, `StartIngestionJob` wird nur bei erkannten Änderungen ausgeführt.

### Begründung

1. FSx for ONTAP S3 Access Point hat begrenzte CloudTrail-Datenereignis-Unterstützung
2. ListObjectsV2 + DynamoDB-Inventarvergleich erkennt Änderungen zuverlässig
3. IN_PROGRESS-Job-Deduplizierung verhindert unnötige Synchronisierungen
4. 3 aufeinanderfolgende Fehler lösen CloudWatch Alarm → Benachrichtigung des Betriebsteams aus

### Auswirkungen

- Maximale Synchronisierungsverzögerung von 15 Minuten (abhängig vom Polling-Intervall)
- Große Umgebungen (100.000+ Dateien) sollten die ListObjectsV2-Ausführungszeit beachten
- Der Transfer Family-Pfad unterstützt auch den CloudTrail-ereignisgesteuerten Modus

---

## ADR-006: Smart Routing — 3-Stufen automatische Modellauswahl

| Element | Details |
|---------|---------|
| **Status** | Genehmigt |
| **Datum** | 2026-05-01 |
| **Kontext** | Modellauswahlstrategie zur Kostenoptimierung |

### Betrachtete Optionen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| 3-Stufen automatisches Routing (gewählt) | 60-80% Kostenreduzierung, Qualität beibehalten | Abhängig von Klassifizierungsgenauigkeit, Fehlklassifizierungsrisiko |
| Einzelnes festes Modell | Einfach, vorhersagbar | Kostenineffizient oder Qualitätsmangel |
| Manuelle Benutzerauswahl | Benutzerkontrolle | Schlechte UX, schwieriges Kostenmanagement |

### Entscheidung

**3-Stufen automatisches Routing** basierend auf Abfragekomplexität (Simple → Haiku, Complex → Sonnet, Full-context → Opus) als Standard, mit manueller Auswahloption ebenfalls verfügbar.

### Begründung

1. Im Enterprise RAG sind 60%+ der Fragen einfache Faktenprüfungen (Haiku reicht aus)
2. Gewichtete Durchschnittskosten ~$0.014/Query verbessern die Qualität bei ähnlichen Kosten wie All-Sonnet (~$0.01)
3. CloudWatch EMF-Metriken visualisieren die Routing-Verteilung und ermöglichen Schwellenwertanpassung
4. Fallback-Mechanismus (automatischer Wechsel zur nächsten Stufe bei Modell-Nichtverfügbarkeit) sichert Verfügbarkeit

### Auswirkungen

- Klassifizierer-Genauigkeit beeinflusst direkt Kosten und Qualität (periodische Schwellenwert-Abstimmung empfohlen)
- Auf Kostenspitzen bei Opus-Nutzung achten (tägliche Kostenobergrenze empfohlen)
- Bei deaktiviertem Smart Routing wird wie bisher ein einzelnes festes Modell verwendet

---

## Verwandte Dokumente

| Dokument | Zugehöriger ADR |
|----------|----------------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
