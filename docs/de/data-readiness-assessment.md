# Vorlage zur Bewertung der Datenbereitschaft

**🌐 Language:** [日本語](../data-readiness-assessment.md) | [English](../en/data-readiness-assessment.md) | [한국어](../ko/data-readiness-assessment.md) | [简体中文](../zh-CN/data-readiness-assessment.md) | [繁體中文](../zh-TW/data-readiness-assessment.md) | [Français](../fr/data-readiness-assessment.md) | **Deutsch** | [Español](../es/data-readiness-assessment.md)

**Erstellt am**: 2026-05-24  
**Zweck**: Eine Vorlage zur Bewertung der Datenbereitschaft vor dem Start eines PoC

---

## Überblick

Diese Vorlage hilft bei der Bewertung der Bereitschaft von Daten, die in das Permission-aware RAG-System eingespeist werden sollen, und unterstützt eine sichere und effektive PoC-Durchführung. Sie sollte gemeinsam vom Data Owner und dem Technical Lead ausgefüllt werden.

---

## 1. Überprüfung des Datenstandorts

| # | Element | Antwort |
|---|---------|---------|
| 1.1 | Wo werden die Daten physisch gespeichert? | ☐ Lokaler Dateiserver ☐ Auf AWS (S3/EFS/FSx) ☐ SaaS ☐ Sonstiges: ________ |
| 1.2 | Datenvolumen (Dateianzahl / Gesamtgröße) | Dateianzahl: ________, Gesamtgröße: ________ GB |
| 1.3 | Aufschlüsselung der Dateiformate | PDF: ___% / DOCX: ___% / TXT: ___% / Sonstiges: ___% |
| 1.4 | Häufigkeit der Datenaktualisierung | ☐ Täglich ☐ Wöchentlich ☐ Monatlich ☐ Ad hoc ☐ Statisch (keine Aktualisierungen) |
| 1.5 | Sprache der Daten | ☐ Japanisch ☐ Englisch ☐ Gemischt ☐ Sonstiges: ________ |

---

## 2. Datenklassifizierung

| Vertraulichkeitsstufe | Definition | Anzahl der Dateien | Beispiele |
|-----------------------|------------|--------------------|-----------|
| **Öffentlich** | Kann extern geteilt werden | ________ Dateien | Produktkataloge, Pressemitteilungen |
| **Intern** | Für alle Mitarbeiter zugänglich | ________ Dateien | Interne Richtlinien, Informationen zu Sozialleistungen |
| **Abteilungsbeschränkt** | Nur bestimmte Abteilungen | ________ Dateien | Projektpläne, technische Spezifikationen |
| **Vertraulich** | Nur bestimmte Rollen | ________ Dateien | Finanzberichte, HR-Informationen |
| **Streng geheim** | Nur benannte Personen | ________ Dateien | M&A-Unterlagen, Dokumente zu Rechtsstreitigkeiten |

---

## 3. Überprüfung der Berechtigungsstruktur

| # | Element | Antwort |
|---|---------|---------|
| 3.1 | Aktuelle Methode der Berechtigungsverwaltung? | ☐ NTFS ACL (Active Directory) ☐ UNIX-Berechtigungen ☐ Anwendungsspezifisch ☐ Keine (alle haben Zugriff) |
| 3.2 | Anzahl der Berechtigungsgruppen | ________ Gruppen |
| 3.3 | Hierarchische Struktur der Berechtigungen | ☐ Flach ☐ 2 Ebenen ☐ 3 oder mehr Ebenen ☐ Unbekannt |
| 3.4 | Häufigkeit von Berechtigungsänderungen | ☐ Täglich ☐ Wöchentlich ☐ Monatlich ☐ Vierteljährlich ☐ Selten |
| 3.5 | Vertrauen in die Richtigkeit der Berechtigungen | ☐ Hoch ☐ Mittel ☐ Niedrig (Bestandsaufnahme erforderlich) |

---

## 4. Überprüfung der Datenqualität

| # | Element | Antwort | Auswirkung |
|---|---------|---------|------------|
| 4.1 | Gibt es gescannte PDFs, die OCR erfordern? | ☐ Keine ☐ Einige ☐ Die meisten | Beeinflusst die RAG-Genauigkeit |
| 4.2 | Spiegeln die Dateinamen den Inhalt wider? | ☐ Ja ☐ Teilweise ☐ Nein | Beeinflusst die Suchgenauigkeit |
| 4.3 | Ist die Ordnerstruktur logisch organisiert? | ☐ Ja ☐ Teilweise ☐ Nein | Beeinflusst das Berechtigungsdesign |
| 4.4 | Gibt es doppelte Dateien? | ☐ Keine ☐ Wenige ☐ Viele | Beeinflusst die Speicherkosten |
| 4.5 | Sind veraltete/ungültige Dateien vermischt? | ☐ Keine ☐ Wenige ☐ Viele | Beeinflusst die Antwortgenauigkeit |

---

## 5. Überprüfung von Compliance und Datenschutz

| # | Element | Antwort | Maßnahme |
|---|---------|---------|----------|
| 5.1 | Enthält es PII? | ☐ Nein ☐ Ja → Typ: ________ | Maskierung oder PII-Erkennung mit Guardrails |
| 5.2 | Handelt es sich um regulierte Daten? | ☐ Nein ☐ Ja → Regulierung: ________ | Rechtliche Prüfung erforderlich |
| 5.3 | Gibt es Beschränkungen beim Datenexport? | ☐ Nein ☐ Ja | Beeinflusst die Regionsauswahl |
| 5.4 | Gibt es Anforderungen an die Datenaufbewahrung? | ☐ Nein ☐ Ja → Zeitraum: ________ | Beeinflusst das Backup-Design |
| 5.5 | Gibt es Anforderungen an die Aufbewahrung von Audit-Trails? | ☐ Nein ☐ Ja | `enableMonitoring=true` erforderlich |

---

## 6. Genehmigung durch den Data Owner

| Genehmigungselement | Genehmiger | Datum | Unterschrift |
|---------------------|------------|-------|--------------|
| Dateneingabe für den PoC genehmigen | __________ | ____/____/____ | ________ |
| Richtigkeit der Datenklassifizierung bestätigen | __________ | ____/____/____ | ________ |
| Gültigkeit des Berechtigungsdesigns bestätigen | __________ | ____/____/____ | ________ |
| Löschung der Daten nach dem PoC zustimmen | __________ | ____/____/____ | ________ |

---

## 7. Bewertung der Bereitschaft

Treffen Sie auf Grundlage der Antworten aus allen Abschnitten die folgende Entscheidung:

| Bewertung | Bedingungen |
|-----------|-------------|
| **Ready** | Alle Abschnitte 1-6 ausgefüllt, PII behandelt, Genehmigung des Data Owners eingeholt |
| **Conditional** | Einige Elemente unvollständig, aber Start mit Demodaten möglich → Daten parallel vorbereiten |
| **Not Ready** | Datenstandort unbekannt, Berechtigungsstruktur unbekannt, PII nicht bestätigt → Datenvorbereitungsphase zuerst erforderlich |

**Bewertungsergebnis**: ☐ Ready ☐ Conditional ☐ Not Ready

**Bewertungsdatum**: ____/____/____  
**Bewerter**: __________

---

## Zugehörige Dokumente

- [Leitfaden für sicheres Experimentieren](safe-experimentation-guide.md) — Was sicher getestet werden kann und was untersagt ist
- [Vorlage für PoC-Erfolgskriterien](poc-success-criteria-template.md) — Go/No-Go-Entscheidungskriterien
- [Checkliste für die Produktionsbereitschaft](production-readiness-checklist.md) — Checkliste für die L2→L3-Migration
- [Governance- und Audit-Design](governance-and-audit.md) — Audit-Log-Schema und Aufbewahrungsanforderungen
