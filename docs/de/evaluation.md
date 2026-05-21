# RAG / Agent Bewertungsmetriken

**🌐 Language:** [日本語](../evaluation.md) | [English](../en/evaluation.md) | [한국어](../ko/evaluation.md) | [简体中文](../zh-CN/evaluation.md) | [繁體中文](../zh-TW/evaluation.md) | [Français](../fr/evaluation.md) | **Deutsch** | [Español](../es/evaluation.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: PoC-Evaluierer, Projektmanager, Qualitätssicherungspersonal

---

## Überblick

Dieses Dokument bietet Metrikdefinitionen und Bewertungsmethoden zur quantitativen Beurteilung der Qualität und Wirksamkeit des Permission-aware RAG-Systems. Die Bewertung erfolgt über 4 Achsen: Business-KPIs, RAG-Qualität, Berechtigungskontrolle und Agent-Leistung.

---

## Bewertungsrahmen

```
┌─────────────────────────────────────────────────────────────┐
│                    4 Bewertungsachsen                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Business-KPI │  │ RAG-Qualität │  │ Berechtigungs│       │
│  │              │  │              │  │ kontrolle    │       │
│  │ ・Suchzeit-  │  │ ・Antwort-   │  │ ・Verletzungs│       │
│  │   reduktion  │  │   genauigkeit│  │   rate       │       │
│  │ ・Erstlösungs│  │ ・Treue      │  │ ・False Pos  │       │
│  │   rate       │  │              │  │ ・False Neg  │       │
│  │ ・Anfragen-  │  │ ・Kontext-   │  │ ・Propagier- │       │
│  │   reduktion  │  │   präzision  │  │   ungsverzög.│       │
│  │ ・Nutzungs-  │  │ ・Antwort-   │  │              │       │
│  │   rate       │  │   zeit       │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐                                            │
│  │ Agent-Leist. │                                            │
│  │              │                                            │
│  │ ・Aufgaben-  │                                            │
│  │   erfolg     │                                            │
│  │ ・Tool-      │                                            │
│  │   genauigkeit│                                            │
│  │ ・Eskalations│                                            │
│  │   rate       │                                            │
│  │ ・Kosten/    │                                            │
│  │   Aufgabe    │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Business-KPIs

### Definitionen und Messmethoden

| KPI | Definition | Ziel (PoC) | Messmethode |
|-----|-----------|------------|-------------|
| Suchzeitreduktionsrate | Zeitersparnis im Vergleich zur herkömmlichen manuellen Suche | 50%+ | Benutzerbefragung + Zeitstempelvergleich |
| Erstlösungsrate | Prozentsatz, der allein durch KI-Antwort gelöst wird | 60%+ | Benutzerfeedback (👍/👎) |
| Anfragenreduktionsrate | Rückgang der Helpdesk-Anfragen | 30%+ | Vorher/Nachher-Ticketanzahlvergleich |
| Zitierungsrate | Prozentsatz der Antworten mit Quellenangaben | 90%+ | Automatische Aggregation der Quellenangabenpräsenz |
| Berechtigungsverletzungsanzahl | Anzahl angezeigter nicht autorisierter Dokumente | 0 | Berechtigungsmatrix-Test + Audit-Logs |
| Monatliche aktive Benutzerrate | Monatliche Nutzungsrate unter registrierten Benutzern | 70%+ | Cognito + Zugriffsprotokolle |

### Mess-Dashboard

Folgendes auf dem CloudWatch-Dashboard visualisieren (`enableMonitoring=true`):

- Tägliche/wöchentliche Suchanfrageanzahl
- Nutzungshäufigkeit pro Benutzer
- Antwortgenerierungs-Erfolgsrate
- Durchschnittliche Antwortzeit (P50/P95/P99)
- Guardrails-Interventionsrate

---

## 2. RAG-Qualitätsmetriken

### 2.1 Antwortrelevanz

**Definition**: Wie relevant die generierte Antwort für die Frage des Benutzers ist

**Bewertungsmethode**:
- Menschliche Bewertung: 5-Punkte-Skala (1: Irrelevant – 5: Vollständig relevant)
- Automatisierte Bewertung: LLM-as-Judge (automatische Bewertung durch Claude)

**Ziel**: Durchschnitt 4,0+ (5-Punkte-Skala)

### 2.2 Treue (Faithfulness)

**Definition**: Ob die generierte Antwort dem Inhalt der abgerufenen Dokumente treu ist (keine Halluzination)

**Bewertungsmethode**:
- Jede Behauptung in der Antwort mit Quelldokumenten abgleichen
- Anteil der nicht unterstützten Behauptungen messen

**Formel**:
```
Faithfulness = (Anzahl unterstützter Behauptungen) / (Gesamtbehauptungen in der Antwort)
```

**Ziel**: 0,90+

### 2.3 Kontextpräzision

**Definition**: Anteil der abgerufenen Dokumente, die tatsächlich zur Antwortgenerierung beigetragen haben

**Bewertungsmethode**:
- Bestimmen, ob jedes Dokument in den Suchergebnissen in der Antwort verwendet wurde
- Höher eingestufte Dokumente werden stärker gewichtet

**Formel**:
```
Context Precision = Σ(Precision@k × relevance@k) / (Anzahl relevanter Dokumente)
```

**Ziel**: 0,80+

### 2.4 Berechtigungsverletzungsrate

**Definition**: Anteil der Suchergebnisse, die nicht autorisierte Dokumente enthalten

**Bewertungsmethode**:
- Dieselbe Abfrage mit Testbenutzern (unterschiedliche Berechtigungsstufen) ausführen
- Überprüfen, dass keine nicht autorisierten Dokumente in den Suchergebnissen jedes Benutzers erscheinen

**Formel**:
```
Permission Violation Rate = (Anzahl nicht autorisierter Dokumentenanzeigen) / (Gesamtsuchanzahl)
```

**Ziel**: 0% (Nulltoleranz)

### 2.5 Antwortlatenz

| Perzentil | Ziel (KB-Modus) | Ziel (Agent-Modus) |
|-----------|-----------------|---------------------|
| P50 | < 3 Sek. | < 8 Sek. |
| P95 | < 8 Sek. | < 20 Sek. |
| P99 | < 15 Sek. | < 30 Sek. |

---

## 3. Berechtigungskontrollmetriken

### 3.1 Testmatrix

| Testfall | Erwartetes Ergebnis | Überprüfungsmethode |
|----------|---------------------|---------------------|
| Admin sucht vertrauliche Dokumente | Angezeigt | SID-Übereinstimmung bestätigen |
| Allgemeiner Benutzer sucht vertrauliche Dokumente | Nicht angezeigt | SID-Nichtübereinstimmung bestätigen |
| Alle Benutzer suchen Everyone-Dokumente | Für alle angezeigt | S-1-1-0-Übereinstimmung bestätigen |
| Benutzer ohne SID sucht | Alles verweigern (Fail-Closed) | Verhalten ohne DynamoDB-Datensatz |
| Benutzer sucht unmittelbar nach Gruppenhinzufügung | Neue Gruppendokumente angezeigt | Verhalten nach AD Sync überprüfen |
| Benutzer sucht unmittelbar nach Gruppenentfernung | Alte Gruppendokumente ausgeblendet | Verhalten nach Cache-TTL überprüfen |

### 3.2 Grenzfalltests

| Fall | Erwartetes Verhalten | Hinweise |
|------|---------------------|----------|
| Allow / Deny-Konflikt | Deny hat Vorrang (dieses System verwendet nur Allow-Liste) | NTFS ACL Deny ACE wird designbedingt nicht in `.metadata.json` reflektiert |
| Gruppenverschachtelung | Durch übergeordnete Gruppen-SID erlaubt | AD-verschachtelte Gruppen als erweiterte SID-Liste verwaltet |
| Vererbte vs. explizite Berechtigungen | Beide SIDs in `.metadata.json` enthalten | Alle effektiven Berechtigungs-SIDs aufgezählt |
| Berechtigungen nach Umbenennung / Verschiebung | Vererbte Berechtigungen des Ziels gelten | `.metadata.json`-Regenerierung erforderlich |
| Gemischter SMB- und NFS-Zugriff | Abhängig vom Sicherheitsstil | NTFS-Stil: SID, UNIX-Stil: UID/GID |
| Benutzer mit nicht auflösbarer SID | Fail-Closed (alles verweigern) | Keine SID-Daten in DynamoDB |
| Suche unmittelbar nach Berechtigungsentfernung | Mit alten Berechtigungen innerhalb der Cache-TTL durchsuchbar | Max. 5 Min. Verzögerung (manuelle Löschung für Notfälle) |

---

## 4. Agent-Bewertungsmetriken

### 4.1 Aufgabenerfolgsrate

**Definition**: Prozentsatz der vom Agent korrekt abgeschlossenen Aufgaben

**Formel**:
```
Task Success Rate = (Korrekt abgeschlossene Aufgaben) / (Gesamtaufgaben)
```

**Ziel**: 80%+

### 4.2 Tool-Call-Genauigkeit

**Definition**: Prozentsatz der angemessenen Tool-Aufrufe mit angemessenen Parametern durch den Agent

**Bewertungspunkte**:
- Korrekte Tool-Auswahl
- Korrekte Parametereinstellung
- Vermeidung unnötiger Tool-Aufrufe

**Ziel**: 90%+

### 4.3 Menschliche Eskalationsrate

**Definition**: Prozentsatz der Fälle, in denen der Agent die Entscheidung an einen Menschen delegiert hat

**Formel**:
```
Escalation Rate = (Eskalationsanzahl) / (Gesamtaufgaben)
```

**Ziel**: 20% oder weniger (akzeptabel für komplexe Aufgaben)

### 4.4 Kosten pro Aufgabe

**Formel**:
```
Cost per Task = (Input-Token × Input-Preis + Output-Token × Output-Preis) / Aufgabenanzahl
```

**Schätzungen**:
| Modell | Input-Preis | Output-Preis | Durchschnittliche Aufgabenkosten |
|--------|------------|-------------|----------------------------------|
| Claude Haiku | 0,001 $/1K | 0,005 $/1K | 0,005–0,02 $ |
| Claude Sonnet | 0,003 $/1K | 0,015 $/1K | 0,02–0,10 $ |
| Claude Opus | 0,015 $/1K | 0,075 $/1K | 0,10–0,50 $ |

---

## Bewertungsvorlage (1-Seiten-Zusammenfassung)

### PoC-Bewertungsbericht-Vorlage

```markdown
# Permission-aware RAG PoC-Bewertungsbericht

## Bewertungszeitraum: JJJJ/MM/TT – JJJJ/MM/TT
## Evaluierer: [Name]
## Zielbenutzeranzahl: XX Benutzer

### Business-KPIs
| Metrik | Ziel | Ist | Bewertung |
|--------|------|-----|-----------|
| Suchzeitreduktionsrate | 50% | __% | ⬜ |
| Erstlösungsrate | 60% | __% | ⬜ |
| Berechtigungsverletzungsanzahl | 0 | __ | ⬜ |
| Zitierungsrate | 90% | __% | ⬜ |

### RAG-Qualität
| Metrik | Ziel | Ist | Bewertung |
|--------|------|-----|-----------|
| Antwortrelevanz | 4,0/5 | __/5 | ⬜ |
| Treue (Faithfulness) | 0,90 | __ | ⬜ |
| Kontextpräzision | 0,80 | __ | ⬜ |
| Berechtigungsverletzung | 0% | __% | ⬜ |

### Antwortleistung
| Metrik | Ziel | Ist | Bewertung |
|--------|------|-----|-----------|
| P50-Latenz | < 3s | __s | ⬜ |
| P95-Latenz | < 8s | __s | ⬜ |

### Agent-Leistung (bei Nutzung des Agent-Modus)
| Metrik | Ziel | Ist | Bewertung |
|--------|------|-----|-----------|
| Aufgabenerfolgsrate | 80% | __% | ⬜ |
| Tool-Call-Genauigkeit | 90% | __% | ⬜ |
| Kosten pro Aufgabe | < 0,05 $ | $__ | ⬜ |

### Gesamtbewertung
- [ ] PoC erfolgreich (Produktion empfohlen)
- [ ] Bedingt erfolgreich (nach Verbesserungen erneut bewerten)
- [ ] Zusätzliche Überprüfung erforderlich

### Verbesserungspunkte / Nächste Schritte
1. 
2. 
3. 
```

---

## Modellauswahl / Kosten / Latenzvergleich

### Vektorspeicher-Auswahl

| Aspekt | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Monatliche Kosten (kleine Skalierung) | 5–20 $ | 700+ $ |
| Abfragelatenz | 100ms–1s | 50ms–200ms |
| Empfohlene Skalierung | ~10.000 Dokumente | 10.000+ Dokumente |
| Empfohlene Nutzung | PoC, kleine Produktion | Hochleistungs-Produktion |

### Embedding-Modellauswahl

| Modell | Dimensionen | Mehrsprachig | Kosten | Empfohlene Nutzung |
|--------|-------------|-------------|--------|-------------------|
| Titan Embed Text v2 | 1024 | ✅ | 0,0001 $/1K Token | Standard (kosteneffizient) |
| Nova Multimodal | 1024 | ✅ | 0,0002 $/Bild | Multimodale Suche |

### Generierungsmodell-Auswahl

| Modell | Anwendungsfall | Input-Kosten | Output-Kosten | Latenz |
|--------|----------------|-------------|---------------|--------|
| Claude Haiku | Einfache Fragen, Smart Routing: simple | 0,001 $/1K | 0,005 $/1K | ~2s |
| Claude Sonnet | Analytische Fragen, Smart Routing: complex | 0,003 $/1K | 0,015 $/1K | ~5s |
| Claude Opus | Großer Kontext, Smart Routing: full-context | 0,015 $/1K | 0,075 $/1K | ~10s |

### Monatliche Kostenschätzungsvorlage

```
Eingabeparameter:
  Dokumentenanzahl: _____ Dateien
  Durchschnittliche Dokumentgröße: _____ KB
  Chunk-Anzahl (geschätzt): Dokumentenanzahl × Durchschnittsgröße / 512
  Tägliche Abfrageanzahl: _____ Abfragen
  Durchschnittliche Input-Token/Abfrage: _____ Token
  Durchschnittliche Output-Token/Abfrage: _____ Token

Kostenberechnung:
  Embedding (initial): Chunk-Anzahl × Durchschnittliche Chunk-Größe × 0,0001 $/1K = $____
  Embedding (monatlich inkrementell): Geänderte Chunk-Anzahl × Durchschnittliche Chunk-Größe × 0,0001 $/1K = $____
  Generierung (monatlich): Tägliche Abfragen × 30 × (Input-Token × Input-Preis + Output-Token × Output-Preis) = $____
  Vektorspeicher: S3 Vectors $____ oder OpenSearch Serverless $____
  FSx for ONTAP: Durchsatz + SSD + Capacity Pool = $____
  Sonstiges (Lambda, CloudFront, DynamoDB): $____
  
  Monatliche Gesamtkosten: $____
```

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsbereitschaft |
| [governance-and-audit.md](governance-and-audit.md) | Governance- und Audit-Design |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Leitfaden für sicheres Experimentieren |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Dimensionierung und Leistung |
