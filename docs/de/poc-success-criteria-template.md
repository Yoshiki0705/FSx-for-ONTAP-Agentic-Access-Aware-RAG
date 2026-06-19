# PoC-Erfolgskriterien-Vorlage

**🌐 Language:** [日本語](../poc-success-criteria-template.md) | [English](../en/poc-success-criteria-template.md) | [한국어](../ko/poc-success-criteria-template.md) | [简体中文](../zh-CN/poc-success-criteria-template.md) | [繁體中文](../zh-TW/poc-success-criteria-template.md) | [Français](../fr/poc-success-criteria-template.md) | **Deutsch** | [Español](../es/poc-success-criteria-template.md)

**Erstellt am**: 2026-05-24  
**Zweck**: Vorlage zur Definition der Erfolgskriterien, die vor dem Start eines PoC mit Kunden und Partnern vereinbart werden

---

## Vor dem PoC zu vereinbarende Punkte

### 1. Stakeholder

| Rolle | Name | Organisation | Verantwortungsbereich |
|-------|------|--------------|------------------------|
| **Business-Sponsor** | __________ | __________ | Finale Go/No-Go-Entscheidung, Budgetfreigabe |
| **Dateneigentümer** | __________ | __________ | Klassifizierung/Freigabe der eingespeisten Daten, Verifizierung des Berechtigungsdesigns |
| **Technischer Leiter** | __________ | __________ | Bereitstellung, Konfiguration, technische Validierung |
| **Bewerter** | __________ | __________ | Bewertung der Antwortqualität, KPI-Messung |
| **Sicherheitsverantwortlicher** | __________ | __________ | Review des Berechtigungsdesigns, Prüfung der Audit-Logs |
| **Betriebsverantwortlicher** | __________ | __________ | Betriebsdesign bei der Produktionsmigration, SLO-Definition |

---

### 2. PoC-Ziele und -Umfang

| Element | Details |
|---------|---------|
| **Zu lösendes Geschäftsproblem** | (z. B. die Suche nach Konstruktionsdokumenten dauert durchschnittlich 15 Minuten und verursacht Projektverzögerungen) |
| **Betroffene Abteilungen** | (z. B. Konstruktionsabteilung + Qualitätsmanagementabteilung, insgesamt 30 Personen) |
| **Betroffene Daten** | (z. B. 500 Konstruktionszeichnungs-PDFs, 200 technische Spezifikationen, 100 Qualitätsberichte) |
| **PoC-Dauer** | (z. B. 4 Wochen — 2026/06/01 bis 2026/06/28) |
| **Budgetobergrenze** | (z. B. AWS-Kosten innerhalb von $2,000/Monat) |

---

### 3. Erfolgskennzahlen (Go/No-Go-Kriterien)

#### Pflichtkennzahlen (Go, wenn alle erreicht)

| # | Kennzahl | Zielwert | Messmethode | Erreicht? |
|---|----------|----------|-------------|-----------|
| 1 | Anzahl der Berechtigungsverletzungen | **0 Vorfälle** | Berechtigungsmatrix-Test + manuelle Verifizierung | ☐ |
| 2 | Antwortgenauigkeit (Relevanzwert) | **3.5/5.0 oder höher** | Qualitative Bewertung von mindestens 10 Fragen durch den Bewerter | ☐ |
| 3 | Antwortzeit (P95) | **Innerhalb von 10 Sekunden** | CloudWatch-Metriken | ☐ |
| 4 | Verfügbarkeit | **99% oder höher** (während des PoC-Zeitraums) | CloudWatch-Alarme | ☐ |

#### Wünschenswerte Kennzahlen (Bonuspunkte bei Erreichung)

| # | Kennzahl | Zielwert | Messmethode | Erreicht? |
|---|----------|----------|-------------|-----------|
| 5 | Reduzierungsrate der Suchzeit | 50% oder mehr | Nutzerbefragung (Before/After) | ☐ |
| 6 | Lösungsrate bei der ersten Antwort | 60% oder mehr | Nutzerfeedback (👍/👎) | ☐ |
| 7 | Nutzerzufriedenheit | 4.0/5.0 oder höher | Befragung nach PoC-Ende | ☐ |
| 8 | Anteil der Antworten mit Citation | 90% oder mehr | Automatische Auswertung | ☐ |

---

### 4. Go/No-Go-Entscheidungskriterien

| Entscheidung | Bedingungen |
|--------------|-------------|
| **Go (Übergang zur nächsten Phase)** | Alle Pflichtkennzahlen #1–#4 erreicht + mindestens 2 wünschenswerte Kennzahlen erreicht |
| **Conditional Go (mit Bedingungen)** | Alle Pflichtkennzahlen #1–#4 erreicht + höchstens 1 wünschenswerte Kennzahl → Verbesserungsplan erstellen und neu bewerten |
| **No-Go (Stopp/Überdenken)** | Eine der Pflichtkennzahlen nicht erreicht → Ursachenanalyse → erneuter PoC oder Richtungswechsel |

**Entscheidungsdatum**: innerhalb von 5 Werktagen nach Ende des PoC-Zeitraums  
**Entscheidungsträger**: Business-Sponsor (die in der obigen Stakeholder-Tabelle genannte Person)

---

### 5. Bedingungen für die nächste Phase

Nach einer Go-Entscheidung zusätzliche Bedingungen für den Übergang in die Produktion (L2→L3):

- [ ] Sicherheitsreview abgeschlossen (Abschnitt L2→L3 der [Checkliste für die Produktionsreife](production-readiness-checklist.md))
- [ ] Betriebsdesign abgeschlossen (SLO-Definition, Alarmkonfiguration, Erstellung des Runbooks)
- [ ] Kostenschätzung genehmigt ([Arbeitsblatt zur Kostenschätzung](cost-estimation-worksheet.md))
- [ ] Genehmigung der Einspeisung von Produktionsdaten durch den Dateneigentümer
- [ ] Design zur Aufbewahrung der Audit-Logs genehmigt

---

### 6. Risiken und Annahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|--------|------------|---------------|
| Geringe Datenqualität (OCR-Genauigkeit, fehlende Metadaten) | Verringerte Antwortgenauigkeit | Qualität vor dem PoC mit Beispieldaten prüfen |
| Geringe Nutzerbeteiligung | Unzureichende Bewertungsdaten | Ziele beim Kickoff teilen, wöchentliche Follow-ups |
| Berechtigungsdesign zu komplex | Erhöhter Konfigurationsaufwand | Mit minimalen Berechtigungsgruppen beginnen |
| Antwortqualität des Modells unter den Erwartungen | PoC-Fehlschlag | Durch Prompt-Anpassung und Änderung der Chunking-Strategie begegnen |

| Annahme | Status |
|---------|--------|
| AWS-Konto verfügbar | ☐ Bestätigt |
| Betroffene Daten können bereitgestellt werden | ☐ Bestätigt |
| Bewerter zugewiesen | ☐ Bestätigt |
| Netzwerkanforderungen (VPN usw.) bestätigt | ☐ Bestätigt |

---

### 7. Vorlage für den PoC-Abschlussbericht

Erstellen Sie am Ende des PoC den folgenden Bericht und reichen Sie ihn beim Business-Sponsor ein:

```markdown
## PoC-Abschlussbericht

### Übersicht
- PoC-Zeitraum: YYYY/MM/DD – YYYY/MM/DD
- Anzahl teilnehmender Nutzer: XX
- Gesamtzahl der Abfragen: XXX

### Erreichungsstatus der Erfolgskennzahlen
| Kennzahl | Ziel | Ist | Ergebnis |
|----------|------|-----|----------|
| ... | ... | ... | ✅/❌ |

### Go/No-Go-Entscheidung
- Entscheidung: Go / Conditional Go / No-Go
- Begründung: ...

### Empfehlungen für die nächste Phase
1. ...
2. ...

### Offene Punkte
1. ...
```

---

## Verwandte Dokumente

- [Leitfaden für sicheres Experimentieren](safe-experimentation-guide.md) — Definition dessen, was während des PoC sicher getestet werden kann
- [RAG-/Agent-Evaluierungsframework](evaluation.md) — Detaillierte Evaluierungsmetriken und Messmethoden
- [Checkliste für die Produktionsreife](production-readiness-checklist.md) — Vollständige Checkliste für die L2→L3-Migration
- [Arbeitsblatt zur Kostenschätzung](cost-estimation-worksheet.md) — Monatliche Kostenschätzungen nach Konfiguration
