# S3 Vectors + SID-Filterung — Architekturleitfaden

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | [Français](../fr/s3-vectors-sid-architecture-guide.md) | **Deutsch** | [Español](../es/s3-vectors-sid-architecture-guide.md)

**Erstellt**: 2026-03-29
**Verifizierungsumgebung**: ap-northeast-1 (Tokio)
**Status**: CDK-Deployment verifiziert, SID-Filterung verifiziert

---

## Überblick

Dieses Dokument fasst die architektonischen Entscheidungen für die Einführung von Amazon S3 Vectors als Vektorspeicher für ein berechtigungsbewusstes RAG-System zusammen, einschließlich Integrationsmustern für SID-basierte Zugriffskontrolle. Es enthält Verifizierungsergebnisse und Empfehlungen als Reaktion auf Expertenfeedback.

---

## Bewertung der SID-Filterungsmuster

### Aktueller Ansatz in diesem System

Dieses System verwendet die Bedrock KB Retrieve API für Vektorsuchen und gleicht das Feld `allowed_group_sids` in den zurückgegebenen Metadaten auf der Anwendungsseite ab. Dieser Ansatz ist vektorspeicher-agnostisch.

```
Bedrock KB Retrieve API → Suchergebnisse + Metadaten (allowed_group_sids)
→ Anwendungsseitiger Abgleich: Benutzer-SID ∩ Dokument-SID
→ Converse API nur mit übereinstimmenden Dokumenten aufrufen
```

### Muster A: SID als filterbare Metadaten anhängen (Empfohlenes Muster)

Da alle Metadaten in S3 Vectors standardmäßig filterbar sind, kann `allowed_group_sids` ohne zusätzliche Konfiguration gefiltert werden.

#### Anwendung in diesem System

Da dieses System über Bedrock KB auf S3 Vectors zugreift, kann der `QueryVectors`-Filterparameter nicht direkt gesteuert werden. Die Bedrock KB Retrieve API führt die Vektorsuche durch und gibt Ergebnisse einschließlich Metadaten zurück. Die SID-Filterung wird auf der Anwendungsseite durchgeführt.

Vorteile dieses Ansatzes:
- Die Bedrock KB Retrieve API ist vektorspeicher-agnostisch, sodass der gleiche Anwendungscode sowohl mit S3 Vectors als auch mit AOSS funktioniert
- `allowed_group_sids` aus `.metadata.json` wird unverändert als Metadaten gespeichert und zurückgegeben
- Die anwendungsseitige SID-Filterungslogik (`route.ts`) erfordert keine Änderungen

#### Reaktion auf Expertenfeedback

> Bitte stellen Sie durch Tests sicher, dass die Anwendung den SID-Filter immer anwendet. Der S3 Vectors-Metadatenfilter ist praktisch, aber er ist kein Ersatz für die Zugriffskontrolle selbst.

Dieses System stellt dies durch Folgendes sicher:
1. Die SID-Filterung ist in die KB Retrieve API-Route (`route.ts`) integriert und kann nicht umgangen werden
2. Wenn SID-Informationen nicht aus DynamoDB abgerufen werden können, werden alle Dokumente verweigert (Fail-Closed-Prinzip)
3. Property-basierte Tests (Property 5) haben die Vektorspeicher-Unabhängigkeit der SID-Filterung verifiziert

### Muster B: Indexseparierung pro SID/Mandant

#### Bewertung für dieses System

Die SIDs in diesem System sind Gruppen-SIDs basierend auf Active Directory NTFS ACL, und pro Dokument werden mehrere SIDs zugewiesen (z.B. `["S-1-5-21-...-512", "S-1-1-0"]`). Die Separierung von Indizes pro SID ist aus folgenden Gründen ungeeignet:

1. **Viele-zu-viele SID-Beziehungen**: Ein einzelnes Dokument gehört zu mehreren SID-Gruppen, und ein einzelner Benutzer hat mehrere SIDs. Indexseparierung würde doppelte Dokumentenspeicherung erfordern
2. **Dynamische SID-Anzahländerungen**: Die Anzahl der SIDs schwankt, wenn AD-Gruppen hinzugefügt oder geändert werden. Die Indexverwaltung wird komplex
3. **10.000 Indizes/Bucket-Limit**: In großen AD-Umgebungen kann die Anzahl der SIDs dieses Limit erreichen

#### Hybriddesign-Überlegung

Wie Experten darauf hinwiesen, ist ein Hybriddesign, das Indizes nach Mandant/Kunde trennt und SID-Filter innerhalb jedes Index verwendet, effektiv. Da dieses System einen einzelnen Mandanten (einzelne AD-Umgebung) annimmt, ist eine Indexseparierung derzeit nicht erforderlich. Dies wird bei der Erweiterung auf Multi-Mandanten berücksichtigt.

---

## Ergebnisse der Migrationschecklisten-Verifizierung

### 1. Embedding-Modell / Dimension / Metrik-Verifizierung

| Element | Aktuell (AOSS) | S3 Vectors | Kompatibilität |
|---------|----------------|-----------|----------------|
| Embedding-Modell | Amazon Titan Embed Text v2 | Gleich | ✅ |
| Dimension | 1024 | 1024 | ✅ |
| Distanzmetrik | l2 (AOSS/faiss) | cosine (S3 Vectors) | ⚠️ Verifizierung erforderlich |
| Datentyp | - | float32 (erforderlich) | ✅ |

> **Hinweis**: Das aktuelle AOSS verwendet l2 (Euklidische Distanz), während S3 Vectors cosine verwendet. Da Bedrock KB die Konsistenz zwischen Embedding und Metrik verwaltet, gibt es beim Zugriff über KB kein Problem. Beachten Sie jedoch den Metrikunterschied bei direkter Verwendung der S3 Vectors API. S3 Vectors erlaubt keine Änderung von Dimension und Metrik nach der Indexerstellung.

### 2. Metadaten-Design

| Metadatenschlüssel | Zweck | Filterbar | Hinweise |
|-------------------|-------|-----------|----------|
| `allowed_group_sids` | SID-Filterung | non-filterable empfohlen | S3 Vectors-Filter nicht benötigt, da anwendungsseitige Filterung über Bedrock KB Retrieve API erfolgt |
| `access_level` | Zugriffsebene-Anzeige | non-filterable empfohlen | Für UI-Anzeige |
| `doc_type` | Dokumenttyp | non-filterable empfohlen | Für zukünftige Filterung |
| `source_uri` | Quelldateipfad | non-filterable | Nicht durchsuchbar, nur Referenz |
| `chunk_text` | Chunk-Text | non-filterable | Nicht durchsuchbar, große Daten |

#### S3 Vectors Metadaten-Einschränkungen (Tatsächliche Werte bei Verifizierung entdeckt)

| Einschränkung | Nennwert | Effektiver Wert mit Bedrock KB | Abhilfe |
|--------------|----------|-------------------------------|---------|
| Filterbare Metadaten | 2KB/Vektor | **Benutzerdefinierte Metadaten bis 1KB** (verbleibende 1KB durch Bedrock KB-interne Metadaten verbraucht) | Benutzerdefinierte Metadaten minimieren |
| Non-filterable Metadatenschlüssel | Max 10 Schlüssel/Index | 10 Schlüssel (5 Bedrock KB-Auto-Schlüssel + 5 benutzerdefinierte Schlüssel) | Bedrock KB-Auto-Schlüssel als non-filterable priorisieren |
| Gesamte Metadatenschlüssel | Max 50 Schlüssel/Vektor | 35 Schlüssel (bei Verwendung von Bedrock KB) | Kein Problem |

### 3. Vorab-Verifizierung unzureichender Berechtigungen

Erforderliche IAM-Aktionen durch Verifizierung bestätigt:

```
KB Role (für Bedrock KB):
  s3vectors:QueryVectors   ← Erforderlich für Suche
  s3vectors:PutVectors     ← Erforderlich für Datensynchronisierung
  s3vectors:DeleteVectors  ← Erforderlich für Datensynchronisierung
  s3vectors:GetVectors     ← Erforderlich für Metadatenabruf (wie Experten darauf hinwiesen)
  s3vectors:ListVectors    ← Bei Verifizierung als erforderlich festgestellt

Custom Resource Lambda (für Ressourcenverwaltung):
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

### 4. Leistungsverifizierung

> **Status**: CDK-Deployment-Verifizierung abgeschlossen. Retrieve API-Latenzverifizierung abgeschlossen.

S3 Vectors Nennleistung:
- Kalte Abfrage: Sub-Sekunde (innerhalb 1 Sekunde)
- Warme Abfrage: ~100ms oder weniger
- Hochfrequente Abfragen: Reduzierte Latenz

### 5. Phasenweise Migrationsplanung

Dieses System unterstützt phasenweise Migration durch Umschaltung über den CDK-Kontextparameter `vectorStoreType`:

1. **Phase 1**: Neues Deployment mit `vectorStoreType=s3vectors` (Verifizierungsumgebung) ← Aktuell hier
2. **Phase 2**: Datenquellenhinzufügung/-synchronisierung, SID-Metadatenabruf-Verifizierung über Retrieve API
3. **Phase 3**: Leistungsverifizierung (Latenz, Parallelität)
4. **Phase 4**: Entscheidung über Produktionsumgebungseinführung

Die Migration von AOSS zu S3 Vectors kann durch erneute Synchronisierung der Bedrock KB-Datenquelle erreicht werden (Vektordaten werden automatisch von KB generiert, sodass keine manuelle Migration erforderlich ist).

---

## CDK-Deployment-Verifizierungsergebnisse

### Verifizierungsumgebung

- Region: ap-northeast-1 (Tokio)
- Stack-Namen: s3v-test-val-AI (eigenständige Verifizierung), perm-rag-demo-demo-* (vollständige Stack-Verifizierung)
- vectorStoreType: s3vectors
- Deployment-Zeit: AI-Stack eigenständig ~83 Sekunden, vollständiger Stack (6 Stacks) ~30 Minuten

### Vollständige Stack E2E-Verifizierungsergebnisse (2026-03-30)

E2E-Verifizierung der S3 Vectors-Konfiguration wurde mit allen 6 bereitgestellten Stacks durchgeführt (Networking, Security, Storage, AI, WebApp + WAF).

#### SID-Filterung-Betriebsverifizierung

| Benutzer | SID | Frage | Referenzierte Dokumente | Ergebnis |
|----------|-----|-------|------------------------|----------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "Erzählen Sie mir über die Umsätze des Unternehmens" | confidential/financial-report.txt + public/product-catalog.txt (2 Docs) | ✅ Antwort enthält 15 Milliarden Yen Umsatzinformationen |
| user@example.com | Regulärer Benutzer (-1001) + Everyone (S-1-1-0) | "Erzählen Sie mir über die Umsätze des Unternehmens" | public/product-catalog.txt (nur 1 Doc) | ✅ Keine Umsatzinformationen (vertrauliches Dokument korrekt ausgeschlossen) |

---

## Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Details zum SID-Filterungsdesign |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3-Konfigurationen-Vergleichstabelle und Implementierungserkenntnisse |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | Technisches Designdokument |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | Anforderungsdokument |