# Leitfaden zur Wahl der Chunking-Strategie

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | [한국어](../ko/chunking-strategy-guide.md) | [简体中文](../zh-CN/chunking-strategy-guide.md) | [繁體中文](../zh-TW/chunking-strategy-guide.md) | [Français](../fr/chunking-strategy-guide.md) | **Deutsch** | [Español](../es/chunking-strategy-guide.md)

**Erstellt**: 2026-06-07  
**Status**: Erste Ausgabe  
**Zielgruppe**: Verantwortliche für die RAG-Qualität, Data Engineers

---

## Überblick

Die Chunking-Strategie einer Bedrock Knowledge Base wirkt sich direkt auf Suchgenauigkeit, Antwortqualität und Kosten aus. Dieser Leitfaden hilft, die zu den Dokumenten auf FSx for ONTAP passende Strategie zu wählen.

---

## Verfügbare Strategien

Wird über den CDK-Kontext `kbChunkingStrategy` gesetzt:

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # Standard
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **Eine Änderung der Chunking-Strategie erfordert eine Resynchronisierung der Datenquelle (erneute Ingestion).**

**Jeder Wert außerhalb dieser vier löst beim Synth einen Fehler aus.** Ein stilles Zurückfallen auf den Standard würde die Ausgabe `KbChunkingStrategy` mit dem Tippfehler anzeigen, während die erzeugte Konfiguration `FIXED_SIZE` enthält — angezeigter Wert und deployte Konfiguration würden auseinanderfallen. Groß-/Kleinschreibung wird normalisiert (`semantic` → `SEMANTIC`).

---

## Vergleich der Strategien

| Strategie | Chunk-Größe | Überlappung | Genauigkeit | Kosten | Geeignet für |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 Tokens | 10% | ⭐⭐⭐ | 💰 niedrig | allgemeine Nutzung, erstes Deployment, Dokumente mit einheitlicher Struktur |
| **HIERARCHICAL** | Parent 1500 / Child 300 | 60 Tokens | ⭐⭐⭐⭐ | 💰💰 mittel | lange Berichte, hierarchische Dokumente, technische Dokumentation |
| **SEMANTIC** | ≤300 Tokens | automatisch (Sinneinheiten) | ⭐⭐⭐⭐⭐ | 💰💰💰 hoch | gemischte Dokumente, FAQs, Dialoge, Protokolle |
| **NONE** | ganzes Dokument | keine | ⭐⭐ | 💰 am niedrigsten | kurze Dokumente (<300 Tokens), nur Metadaten |

---

## Dokumenteigenschaften und empfohlene Strategie

| Eigenschaften | Empfehlung | Begründung |
|---|---|---|
| **Design- und Spezifikationsdokumente** (hierarchisch, lang) | HIERARCHICAL | behält die Hierarchie Kapitel → Abschnitt → Absatz und liefert damit breiten Kontext und präzise Treffer |
| **Verträge und juristische Dokumente** (klauselbasiert) | SEMANTIC | erkennt die semantische Grenze zwischen Klauseln und zerschneidet keine |
| **FAQs** (kurze Frage-Antwort-Paare) | SEMANTIC | hält Frage und Antwort im selben Chunk |
| **Protokolle und E-Mails** (Dialog) | SEMANTIC | trennt natürlich dort, wo das Thema wechselt |
| **Handbücher und Abläufe** (Schritt für Schritt) | HIERARCHICAL | der ganze Ablauf wird zum Parent, jeder Schritt zum Child |
| **Finanzberichte** (Tabellen und Zahlen) | FIXED_SIZE | feste Größe ist stabiler, wenn die Tabellenstruktur komplex ist |
| **Kurze Mitteilungen** (unter einer Seite) | NONE | kein Split nötig, wenn das ganze Dokument in einen Chunk passt |
| **Gemischter Korpus** (viele Dokumenttypen) | SEMANTIC | ergibt unabhängig vom Typ einen semantisch sinnvollen Split |

---

## Nach Branche

| Branche | Wichtigste Dokumente | Empfehlung | Hinweise |
|---|---|---|---|
| **Fertigung** | Zeichnungen (Textteile), Qualitätsnormen, Arbeitsanweisungen | HIERARCHICAL | Zeichnungen mit einem multimodalen KB kombinieren |
| **Finanzdienstleistungen** | regulatorische Dokumente, interne Berichte, Compliance-Berichte | SEMANTIC | erhält die semantische Integrität der Klauseln |
| **Öffentlicher Sektor** | Richtliniendokumente, Rundschreiben, Protokolle | SEMANTIC | die themenweise Trennung von Protokollen ist wichtig |
| **Gesundheitswesen** | klinische Leitlinien, Abläufe, Forschungsarbeiten | HIERARCHICAL | nutzt die Kapitelstruktur |
| **Recht** | Verträge, Rechtsprechung, Gesetzestexte | SEMANTIC | vermeidet das Zerschneiden von Klauseln |
| **Bildung** | Lehrmaterial, Lehrpläne, Forschungsunterlagen | FIXED_SIZE | einheitliche Struktur, kostensensibel |
| **Versicherung** | Bewertungskriterien, Berichte zur Betrugserkennung | HIERARCHICAL | passt zu hierarchischen Entscheidungskriterien |

---

## Leistungsmerkmale

### Dauer der Ingestion

| Strategie | 1,000 Dokumente (Schätzung) | 10,000 Dokumente (Schätzung) |
|---|---|---|
| FIXED_SIZE | ~5 Min. | ~30 Min. |
| HIERARCHICAL | ~8 Min. | ~50 Min. |
| SEMANTIC | ~15 Min. | ~90 Min. |
| NONE | ~3 Min. | ~15 Min. |

> SEMANTIC führt an jeder Kandidatengrenze einen zusätzlichen Modellaufruf aus, was Ingestionsdauer und Kosten erhöht.

### Suchlatenz

Die Chunking-Strategie wirkt sich nicht direkt auf die Suchlatenz aus — die Leistung der Vektorsuche hängt von der Indexgröße ab. HIERARCHICAL führt eine zweistufige Parent/Child-Suche aus und kann daher etwas Latenz hinzufügen (~50 ms).

---

## Verhältnis zum berechtigungsbewussten RAG

**Wichtig**: unabhängig von der Chunking-Strategie wird die Berechtigungsfilterung immer **pro Dokument** angewandt.

```
Dokument A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (vom Dokument geerbt)
  ├── Chunk 2 → SID: [Admin, Engineering] (vom Dokument geerbt)
  └── Chunk 3 → SID: [Admin, Engineering] (vom Dokument geerbt)
```

- Die SID-Informationen in `.metadata.json` hängen am Dokument.
- Unterschiedliche Berechtigungen je Chunk sind nicht möglich; das gesamte Dokument trägt einen Berechtigungssatz.
- Braucht ein Dokument in verschiedenen Teilen verschiedene Berechtigungen, muss es in getrennte Dateien aufgeteilt werden.

---

## Die Strategie wechseln

```bash
# 1. Aktuelle Strategie prüfen
grep kbChunkingStrategy cdk.context.json

# 2. CDK-Kontext aktualisieren
# cdk.context.json bearbeiten oder den Wert auf der Kommandozeile übergeben

# 3. CDK-Diff ansehen
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. Deployen (nur die Ausgabe KbIngestionConfig ändert sich; eine bestehende Datenquelle bleibt unverändert)
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC
# 4b. Das Chunking lässt sich nach dem Anlegen nicht mehr ändern: Datenquelle löschen und mit setup-kb-datasource.sh neu anlegen

# 5. Datenquelle resynchronisieren (erforderlich)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. Auf das Ende der erneuten Ingestion warten
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. Qualität bewerten (mit RAGAS vergleichen)
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## Wie eine Änderung bewertet wird

Nach einem Strategiewechsel immer messen:

1. **RAGAS-Auswertung**: Faithfulness, Answer Relevancy und Context Precision mit `tests/rag-evaluation/` vergleichen.
2. **Regression der Berechtigungsmatrix**: prüfen, dass die Filterung über die 31 Szenarien weiterhin greift.
3. **Antwortzeit**: P50/P95/P99-Latenzen in CloudWatch prüfen.
4. **Kosten**: die Summe aus Ingestions- und Abfragekosten vergleichen.

---

## PDFs mit einem Foundation Model parsen (optional)
Mit `-c kbParsingStrategy=BEDROCK_FOUNDATION_MODEL` liest die Datenquelle der Knowledge Base PDFs mit einem Foundation Model. Die Vorgabe (`DEFAULT`) ist der Standard-Parser von Bedrock, der nur die Textebene eines PDFs liest; reine Bild-PDFs und Text in Tabellen oder Abbildungen werden nicht aufgenommen.
| Einstellung | Vorgabe | Wirkung |
|---|---|---|
| `kbParsingStrategy` | `DEFAULT` | `DEFAULT` \| `BEDROCK_FOUNDATION_MODEL`. `BEDROCK_DATA_AUTOMATION` wird beim synth abgelehnt (die Dokumentation nennt es nur als Vorschau in US West (Oregon)) |
| `kbParsingModelId` | `jp.anthropic.claude-haiku-4-5-20251001-v1:0` | Das Parsing-Modell (ein Inferenzprofil in Tokio oder eine Modell-ID). Geeignet sind Claude-, Nova- und Llama-4-Modelle mit Bildverständnis |
| `kbParsingPrompt` | (keine) | Anweisungen zum Lesen (1 bis 10.000 Zeichen), zum Beispiel Tabellen als Markdown auszugeben |
**[documented]** Wer ein Foundation Model als Parser wählt, schickt **jedes PDF** der Datenquelle an dieses Modell, auch PDFs, die nur Text enthalten, und Eingabe- und Ausgabe-Token werden berechnet ([Parsing-Optionen](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-advanced-parsing.html)). Andere Dateien als PDF (`.md`, `.txt` usw.) bleiben beim Standard-Parser. Ein Dokument, dessen Parsing fehlschlägt, fällt auf den Standard-Parser zurück.
**Berechtigungen**: `.metadata.json` hängt pro Dokument an, daher ändert ein anderer Parser die Berechtigungen nicht. Vom Parser extrahierter Text trägt die `allowed_group_sids` seines Quelldokuments, und der SID-Filter läuft weiterhin genau einmal auf den Suchergebnissen. `parsingModality` (`MULTIMODAL`) wird nicht gesetzt, weil extrahierte Abbildungen sonst in einem getrennten Speicher ohne Berechtigungsinformationen landen würden.
**IAM der KB-Rolle**: Nur wenn ein Foundation Model gewählt wird, erhält die KB-Rolle `bedrock:GetInferenceProfile` für das Inferenzprofil (Bedrock ruft es beim Anlegen der Datenquelle auf; ohne diese Berechtigung schlägt das Anlegen mit `ValidationException` fehl) und `bedrock:InvokeModel` für das Profil und sein Foundation Model. Bei einem regionsübergreifenden Inferenzprofil kann die Parsing-Eingabe in einer anderen Region verarbeitet werden.
**Anwendung**: Die Skripte, die die Datenquelle anlegen (`post-deploy-setup.sh`, `setup-kb-datasource.sh`), übergeben die Ausgabe `KbIngestionConfig` des AI-Stacks (Chunking und Parsing in einem JSON) als `--vector-ingestion-configuration`. Die Datenquelle wird von den Skripten angelegt, nicht von CDK; **ein CDK-Deploy allein ändert daher eine bestehende Datenquelle nicht**. Das Chunking lässt sich nach dem Anlegen nicht ändern ([documented](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-ds-update.html)); um es zu ändern, die Datenquelle neu anlegen und neu synchronisieren. Das Parsing ist genauso zu behandeln: Beim Löschen wurde `UpdateDataSource` ohne die Parsing-Konfiguration mit „cannot be updated once created“ abgelehnt (bei einem echten Löschvorgang beobachtet). Ein Update, das den Wert ändert, wurde nicht versucht.
> **Änderung beim Standard-Chunking**: Die früheren Skripte übergaben `KbChunkingConfig` nicht, daher wurden Datenquellen mit dem Bedrock-Standard (300 Token, 20 % Überlappung) angelegt. Künftig wird das Standard-`FIXED_SIZE` mit 300 Token und 10 % Überlappung übergeben. Bestehende Datenquellen ändern sich nicht; der Unterschied gilt, wenn eine neu angelegt wird.
---

## CDK-Implementierung

`buildChunkingConfiguration()` in `lib/stacks/demo/demo-ai-stack.ts`:

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE: kein Chunking (das ganze Dokument wird ein Vektor)
```

---

## Zugehörige Dokumente

- [Sizing und Performance von FSx for ONTAP](fsxn-sizing-and-performance.md)
- [RAG-/Agent-Evaluierungsframework](evaluation.md)
- [Arbeitsblatt zur Kostenschätzung](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
