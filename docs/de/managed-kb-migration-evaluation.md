# Bewertung des Migrationspfads zu Amazon Bedrock Managed Knowledge Base

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | [한국어](../ko/managed-kb-migration-evaluation.md) | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | [Français](../fr/managed-kb-migration-evaluation.md) | **Deutsch** | [Español](../es/managed-kb-migration-evaluation.md)

**Erstellungsdatum**: 2026-06-18
**Zielregion**: ap-northeast-1 (Tokio) — Managed KB ist in der Region Tokio verfügbar
**Status**: Bewertungsdokument (Migration nicht durchgeführt / bestehender Pfad beibehalten)
**Verwandt**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md` (Ursprung)

---

## 0. Zweck dieses Dokuments

Dieses Dokument bewertet den **Migrationspfad** für die Aktualisierung der bestehenden Permission-aware-RAG-Konfiguration dieses Repositorys (Bedrock KB + OpenSearch Serverless / S3 Vectors) auf [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/), das auf dem AWS Summit New York 2026 (2026-06-17) allgemein verfügbar (GA) wurde.

Wesentliche Annahmen:

- Dies ist ein **Bewertungsdokument**; es empfiehlt keine sofortige Migration.
- Der bestehende Pfad (Bedrock KB + OpenSearch Serverless / S3 Vectors) wird **nicht entfernt**.
- Der Inhalt ist in zwei Evidenzstufen eingeteilt.

| Stufe | Definition | Behandlung in diesem Dokument |
|-------|-----------|-------------------------------|
| Public evidence | Aus offizieller AWS-Dokumentation/Blogs verifizierbar | Mit Quellenlinks zitiert |
| Project-context expectation | Designentscheidungen/Erwartungen innerhalb dieses Projekts (nicht öffentlich verifizierbar) | Als „Projektannahme" gekennzeichnet |

> ⚠️ **Distinction discipline**: Wir trennen klar die „allgemeine Funktionsbeschreibung" vom „in diesem Projekt verifizierten Verhalten". Managed-KB-Funktionsbeschreibungen sind allgemeine Erklärungen auf Basis öffentlicher AWS-Informationen; das ACL-Integrationsverhalten in diesem Projekt ist **nicht verifiziert** (siehe Verifizierungspunkte unten).

---

## 1. Hauptfunktionen von Managed KB (Public evidence)

Basierend auf dem [Blog Introducing Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) und der [GA-Ankündigung](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/). Der Inhalt wurde zur Einhaltung von Lizenzbeschränkungen umformuliert, wobei die Absicht der Quelle erhalten blieb.

| Funktion | Überblick | Relevanz für dieses Projekt |
|----------|-----------|------------------------------|
| 6 native Datenkonnektoren | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler. Ingestiert Daten und Berechtigungen automatisch | Ob der **S3-Konnektor** sich mit dem FSx for ONTAP S3 Access Point verbinden kann, ist die Schlüsselfrage |
| Smart Parsing | Wählt automatisch die optimale Parsing-Strategie je Datentyp und Konnektor (PDF, Office, Tabellen, multimodal) | Könnte die bestehende manuelle Chunking-Strategieauswahl automatisieren |
| Agentic Retriever | Zerlegt komplexe Abfragen in Unterabfragen und führt iterative Multi-Hop-Retrieval durch | Erfordert Re-Autorisierung im Permission-aware-Kontext (siehe unten) |
| Verwalteter Vektorspeicher | Keine Vektor-DB-Bereitstellung. Preis-Leistungs-optimiert | Entfernt die Betriebslast von OpenSearch Serverless / S3 Vectors |
| AgentCore Gateway-Integration | Als integriertes Connector-Target (MCP) bereitgestellt mit zwei Tools: `Retrieve` und `AgenticRetrieveStream` | Integrierbar mit dem AgentCore Gateway dieses Projekts (bereits implementiert) |
| Kompatibilität bestehender APIs | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` usw. sind identisch | Nur KB-ID-Änderung, keine Codeänderung (AWS-Behauptung, zu verifizieren) |
| Regionen | GA in mehreren Regionen einschließlich Tokio | Konsistent mit ap-northeast-1-Deployment |

### Preismodell (Public evidence)

Laut [AWS-Beschreibung](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) hat die Abrechnung zwei Dimensionen (indizierte Datengröße + nutzungsbasierte Anzahl der Retrievals). Keine Vorabverpflichtung.

> ⚠️ **Hinweis zur Kostenschätzung**: Das Obige ist die Struktur des veröffentlichten Preismodells; die tatsächlichen Kosten für die Workload dieses Projekts sind nicht gemessen. Führen Sie vor einer Migrationsentscheidung einen Stückkostenvergleich zwischen „aktuell (OpenSearch Serverless OCU / S3 Vectors-Speicher)" und „Managed KB (Datengröße + Anzahl der Retrievals)" mit den erwarteten Abfrage- und Datenvolumina durch.

---

## 2. Vergleich mit der bestehenden Konfiguration

### 2.1 Architekturvergleich

| Aspekt | Aktuell (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|--------|-------------------------------------------------------------------|------------|
| Vektorspeicher-Betrieb | Selbstverwaltet (AOSS OCU-Design / S3 Vectors Index-Verwaltung) | Vollständig verwaltet (keine Bereitstellung) |
| Datenquelle | FSx ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | Über S3-Konnektor (S3 AP-Verbindung zu verifizieren) |
| Parsing & Chunking | Manuelle Auswahl über `kbChunkingStrategy` (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing wählt automatisch (anpassbar) |
| Embedding-Modell | Zur Deploy-Zeit fixiert (`embeddingModel`, Änderung erfordert Neuerstellung) | Standardmäßig automatisch ausgewählt + optionales Bedrock-Modell |
| Retrieval | Einzelnes Retrieve + SID-Filter auf Anwendungsseite | `Retrieve` (einzeln hybrid) + `AgenticRetrieveStream` (Multi-Hop) |
| ACL-Filter | `allowed_group_sids`-Abgleich auf Anwendungsseite (vektorspeicher-unabhängig) | Metadaten-`filter`-Operatoren + `userContext` (zu verifizieren) |
| Gateway-Integration | Benutzerdefiniert (AgentCore Gateway + Permission Interceptor implementiert) | Integriertes Connector-Target |
| Betriebslast | Mittel (Vektorspeicher-/Pipeline-Design erforderlich) | Niedrig (verwaltet) |
| Anpassbarkeit | Hoch (alle Komponenten steuerbar) | Mittel (im verwalteten Umfang anpassbar) |

### 2.2 Bestehender SID-Filteransatz (Project-context)

Gemäß [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) verwendet dieses Projekt den folgenden vektorspeicher-unabhängigen Ansatz.

```
Bedrock KB Retrieve API → Suchergebnisse + Metadaten(allowed_group_sids)
→ Anwendungsseite (route.ts) gleicht Benutzer-SID ∩ Dokument-SID ab
→ nur übereinstimmende Dokumente gehen an Converse API
→ Fail-Closed: alles ablehnen, wenn SID-Abruf fehlschlägt
```

Die Stärke dieses Ansatzes ist, dass **die Autorisierungslogik auf Anwendungsseite unverändert bleibt**, auch wenn sich der Vektorspeicher (AOSS / S3 Vectors) ändert. Ob diese Invariante nach der Migration zu Managed KB erhalten bleiben kann, ist der kritischste Punkt.

---

## 3. Migrationsentscheidungskriterien

Gerahmt als „das richtige Werkzeug für die Aufgabe", nicht als „Ersatz eines Wettbewerbers". Die Kompromisse beider Konfigurationen werden symmetrisch dargestellt.

### 3.1 Wann eine Migration zu Managed KB erwägen

- Sie möchten die **Betriebs-/Designlast** des Vektorspeichers (OpenSearch Serverless OCU / S3 Vectors Index) **reduzieren**
- Sie möchten Smart Parsing für das **automatische Parsing von Multi-Format-Dokumenten** (PDF, Office, Tabellen) nutzen
- Sie streben Genauigkeitsverbesserungen für **Multi-Hop-, komplexe Abfragen** über Agentic Retriever an
- Sie möchten **neue Embedding-/Re-Ranking-Modelle ohne Infrastruktur-Neuaufbau übernehmen**
- Sie möchten in eine AgentCore-Gateway-zentrierte Architektur integrieren und die **Verbindung über ein integriertes Connector-Target vereinfachen**

### 3.2 Wann die aktuelle Konfiguration beibehalten

- Sie haben eine **Anforderung, ACL auf Dateiebene (NTFS / SID) zur Retrieval-Zeit strikt anzuwenden** und möchten volle Kontrolle über das `allowed_group_sids`-Abgleichverhalten
- Sie haben **benutzerdefinierte Logik für die sofortige Widerspiegelung** von Berechtigungsänderungen, Löschungen und Umbenennungen (ob die verwaltete Synchronisierung dies erreichen kann, ist nicht verifiziert)
- Sie möchten **feinkörnige Kontrolle über filter / ranking / reranking des Vektorspeichers**
- Sie möchten die Fail-Closed-Garantien der Produktion nicht gefährden, während **die ACL-Metadaten-Aufbewahrung/-Filterung im verwalteten Speicher nicht verifiziert ist**
- Datenhoheits- oder Audit-Anforderungen verlangen, **explizit zu verwalten, wo Vektordaten gespeichert werden**

### 3.3 Entscheidungsfluss

```
Müssen Sie ACL zur Retrieval-Zeit strikt anwenden?
├─ JA → Können Sie alle Verifizierungspunkte in §4 erfüllen?
│        ├─ JA → Schrittweise Migration erwägen (§5)
│        └─ NEIN → Aktuelle Konfiguration beibehalten (ACL-Garantie priorisieren)
└─ NEIN → Betriebslast / Genauigkeit priorisieren; Managed KB erwägen
```

> ⚠️ Der Hauptzweck dieses Projekts ist **Permission-aware RAG**, und die strikte ACL-Durchsetzung ist eine nicht verhandelbare Anforderung. Daher ist die Beibehaltung der aktuellen Konfiguration die Standardrichtlinie, sofern die Verifizierung in §4 nicht erfüllt wird.

---

## 4. Auswirkung auf Permission-aware RAG (am kritischsten)

Kann der SID-basierte ACL-Filter dieses Projekts mit dem verwalteten Speicher von Managed KB erhalten bleiben? Wir organisieren die öffentlichen Evidenzen und Verifizierungspunkte.

### 4.1 Public evidence: Zugriffskontrollmethoden von Managed KB

Gemäß der [AgentCore Gateway Connector-Target-Dokumentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html) verfügt Managed KB über zwei Zugriffskontrollmethoden.

**(A) Metadaten-`filter`-Operatoren (`Retrieve`-Tool)**

`managedSearchConfiguration.filter` unterstützt diese Operatoren (Zusammenfassung der Quellenabsicht):
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains` könnte verwendbar sein, um eine Benutzer-SID mit `allowed_group_sids` (einem Array) abzugleichen**. Dies könnte den aktuellen Abgleich auf Anwendungsseite in die Retrieval-Schicht verlagern.

**(B) Zugriffskontrollfilterung über `userContext`**

Laut Dokumentation fügt die aufrufende Anwendung, wenn ein KB eine Zugriffskontrolle pro Benutzer/Gruppe anwendet, `userContext` (z. B. `userId`) in die Anfrage ein. Das Gateway leitet dies an das KB weiter, das die Filterung basierend auf `userContext` anwendet. Entscheidend: **Das Gateway füllt `userContext` nicht aus der IAM-Identität des Aufrufers aus — die Anwendung muss es explizit bereitstellen**. Es wird auch explizit angegeben, dass **`userContext` von der Anwendung, nicht vom Modell bereitgestellt wird**.

→ Dieses Design „die Anwendung stellt es explizit bereit" / „nicht dem Modell überlassen" stimmt richtungsmäßig mit dem **Fail-Closed-, anwendungserzwungenen** Prinzip dieses Projekts überein.

### 4.2 Verifizierungspunkte (vor der Migration zu bestätigen)

Alle folgenden Punkte sind **nicht verifiziert** und bestimmen die Migrationsfähigkeit. Project-context-Annahmen sind daneben vermerkt.

| # | Verifizierungselement | Projektannahme | Risiko |
|---|----------------------|----------------|--------|
| V1 | Kann der S3-Konnektor den **FSx ONTAP S3 Access Point** als Datenquelle verwenden (Alias-Format, IAM-Grenze)? | Angenommen verbindbar, wenn S3-kompatibel | Wenn nicht verbindbar, ist die Migration nicht machbar |
| V2 | Wird `allowed_group_sids` aus `.metadata.json` **als Metadaten** im Managed-KB-Index **beibehalten**? | Angenommen beibehalten | Wenn nicht beibehalten, ist ACL-Filter unmöglich |
| V3 | Funktioniert der `filter` von `Retrieve` für den **SID-Array-Abgleich über `listContains`**? | Angenommen funktional | Wenn nicht, zur userContext-Methode wechseln |
| V4 | Ist die `userContext`-Methode für **per S3-Konnektor ingestierte Daten** gültig (nicht nur SaaS-Konnektoren)? | Unbekannt, ob für S3 gültig | Wenn für S3 ungültig, abhängig von der filter-Methode |
| V5 | Wird ACL bei **jedem Schritt von `AgenticRetrieveStream` (Multi-Hop)** angewendet? | Anwendung pro Schritt erforderlich | Risiko, dass nicht autorisierte Daten in Zwischenschritten eindringen |
| V6 | Ist die **Widerspiegelungslatenz für Berechtigungsänderungen/-löschungen/-umbenennungen** im verwalteten Speicher akzeptabel? | Erwartung der gleichen Unmittelbarkeit wie bisher | Risiko veralteter Berechtigungsdaten durch Widerspiegelungsverzögerung |
| V7 | Wird die **ACL-Anwendung für Konversationsverlauf/Cache** beibehalten? | Auf Anwendungsseite beibehalten | Cache-Verhalten auf verwalteter Seite unbekannt |

> ⚠️ **Nicht verhandelbar**: Wenn V2, V3 (oder V4) oder V5 nicht erfüllt ist, ist die Migration **BLOCKED**, da **nicht autorisierte Daten in die Suchergebnisse eindringen könnten**. Dies würde die nicht verhandelbaren Anforderungen der FSxN AI/RAG-Architekturüberprüfung verletzen („ein Design, bei dem nicht autorisierte Daten in vector-search-Ergebnisse eindringen können", „ein Design ohne Autorisierungsprüfung des an das LLM übergebenen Kontexts").

### 4.3 Aufrechterhaltung der Defense-in-Depth

Auch bei der Migration sollten Sie Defense-in-Depth aufrechterhalten, ohne sich auf eine einzige Methode zu verlassen.

```
1. Benutzerauthentifizierung über IdP / Cognito / AD
2. Benutzer-Principal / Gruppen-SIDs abrufen (DynamoDB user-access)
3. filter (listContains) oder userContext zur Managed-KB-Retrieval-Zeit
4. ★ ACL-Neuabgleich auf Anwendungsseite unmittelbar vor der LLM-Kontextinjektion (aktuelle route.ts-Logik beibehalten) ★
5. Re-Autorisierung nach jedem Schritt bei Verwendung von AgenticRetrieveStream
6. Re-Autorisierung beim Anzeigen von Zitat-Quelllinks
7. Audit-Log (wer hat welche SID-abgeleitete Information wann verwendet)
```

→ Auch bei Verwendung der Filterung auf Managed-KB-Seite **empfehlen wir dringend, Schritt 4 (finaler ACL-Abgleich auf Anwendungsseite) beizubehalten**. Dies gewährleistet Fail-Closed, selbst wenn sich der Filter auf verwalteter Seite anders als erwartet verhält.

---

## 5. Migrationspfad (schrittweise / bestehender Pfad beibehalten)

Wie beim bestehenden Dual-KB-Migrationsmuster ([migration-guide-multimodal.md](../en/migration-guide-multimodal.md)) verifizieren Sie schrittweise mit **Parallelbetrieb**. Der bestehende Pfad wird nicht entfernt.

### Phase 0: PoC-Verifizierung (keine Produktionsauswirkung)

1. Ein Managed KB mit einem kleinen Verifizierungsdatensatz erstellen (konsistente Daten aus Snapshot / FlexClone empfohlen)
2. V1–V7 aus §4.2 der Reihe nach verifizieren
3. Das Verhalten der SID-Filterung (filter / userContext) gegen die 31 Szenarien in [tests/permission-matrix/](../../tests/permission-matrix/) bestätigen

### Phase 1: Parallelbetrieb (Shadow)

1. Das bestehende KB beibehalten und das Managed KB als **schreibgeschützten Shadow** parallel betreiben
2. Identische Abfragen an beide Systeme senden und Suchergebnisse, ACL-Filterergebnisse und Zitatkonsistenz vergleichen
3. Genauigkeit und Citation Precision mit RAGAS usw. vergleichen ([evaluation.md](evaluation.md))

### Phase 2: Schrittweise Migration (Canary)

1. AgentCore Gateway A/B-Tests verwenden (AgentCore Optimization — bereits in diesem Repository implementiert), um einen Teil des Traffics zum Managed-KB-Pfad zu leiten
2. Bestätigen, dass alle Berechtigungstests (Fail-Closed, Gruppenverschachtelung, ACL-Grenzfälle) bestehen
3. Nach Bestätigung der statistischen Signifikanz den Traffic schrittweise verschieben

### Phase 3: Cutover-Entscheidung

- Alle Verifizierungen erfüllt → Managed KB zum Standardpfad machen
- Nicht erfüllte Punkte → aktuelle Konfiguration beibehalten; Managed KB als Shadow behalten oder zurückziehen

> Wir empfehlen, den bestehenden Pfad (Bedrock KB + OpenSearch Serverless / S3 Vectors) auch nach Abschluss der Migration **für einen Zeitraum als Rollback-Pfad** beizubehalten.

---

## 6. Verifizierungs-Checkliste

Bestätigen Sie alle folgenden Punkte vor einer Migrationsentscheidung.

### Datenfundament
- [ ] V1: S3-Konnektor kann FSx ONTAP S3 AP als Datenquelle registrieren
- [ ] PoC mit konsistenten Daten aus Snapshot / FlexClone durchgeführt
- [ ] Produktionsdaten werden keinem intensiven direkten Crawling unterzogen

### Permission-aware RAG (am kritischsten)
- [ ] V2: `allowed_group_sids` wird als Metadaten beibehalten
- [ ] V3 oder V4: SID-Filter funktioniert über `listContains`-filter oder `userContext`
- [ ] V5: ACL wird bei jedem AgenticRetrieveStream-Schritt angewendet
- [ ] Defense-in-Depth-Schritt 4 (finaler Abgleich auf Anwendungsseite) wird beibehalten
- [ ] Fail-Closed: alles ablehnen, wenn SID-Abruf fehlschlägt
- [ ] Alle 31 Berechtigungstest-Szenarien bestehen

### Datenlebenszyklus
- [ ] V6: Widerspiegelungslatenz für Berechtigungsänderungen/-löschungen/-umbenennungen ist akzeptabel
- [ ] V7: ACL wird auf Konversationsverlauf/Cache angewendet

### Kosten & Leistung
- [ ] Stückkostenvergleich aktuell vs Managed KB durchgeführt (Datengröße + Anzahl der Retrievals)
- [ ] Monatliche Schätzung für das erwartete Abfragevolumen erstellt

### Betrieb
- [ ] Rollback-Verfahren (Rückkehr zum bestehenden Pfad) in einem Runbook dokumentiert
- [ ] Nutzungsverlauf über Audit-Log nachverfolgbar

---

## 7. Empfehlung

**Aktuelles Urteil: REQUEST CHANGES (Migration ausgesetzt bis zum Abschluss der Verifizierung)**

Bedingungen zur Aufhebung:

1. Punkte V1–V7 aus §4.2 per PoC verifizieren
2. Insbesondere **V2, V3 (oder V4) und V5** erfüllen (BLOCKED, wenn nicht erfüllt)
3. Das Design muss Defense-in-Depth-Schritt 4 (finaler ACL-Abgleich auf Anwendungsseite) beibehalten
4. Der Kostenvergleich zeigt keinen Nachteil gegenüber dem aktuellen, oder die Betriebslastreduzierung überwiegt jede Kostensteigerung

**Begründung:**

- Die Betriebslastreduzierung, Smart Parsing und Agentic Retriever von Managed KB bieten klaren Wert für dieses Projekt (public evidence).
- Die **oberste Anforderung dieses Projekts ist jedoch die strikte ACL-Durchsetzung für Permission-aware RAG**, und das SID-Filterverhalten im verwalteten Speicher ist **nicht verifiziert**.
- `userContext` (von der Anwendung bereitgestellt, modellunabhängig) und der `listContains`-filter stimmen richtungsmäßig überein, daher ist **die Migration je nach Verifizierung durchaus machbar**.

> Dieses Dokument ist eine Bewertung. Die tatsächliche Migration sollte erst nach der obigen Verifizierung und Genehmigung durch die entsprechende Überprüfung (FSxN AI/RAG-Architekturüberprüfung) durchgeführt werden.

---

## Verwandte Dokumente

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Managed-KB-Validierungsverfahren (S3 AP-Verbindungsvalidierung / FlexClone-sicheres Validierungsmuster)
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — Grundlegendes Design der SID-Filterung
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — S3 Vectors + SID-Integration
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — Bestehende Stack-Konfiguration und KB-Kontingente
- [metadata-json-schema.md](metadata-json-schema.md) — `allowed_group_sids`-Metadatenschema
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Referenzmuster für die schrittweise Dual-KB-Migration (auf Englisch)
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — Aktuelle Chunking-Strategie
- [evaluation.md](evaluation.md) — RAG-Bewertungsmethoden
