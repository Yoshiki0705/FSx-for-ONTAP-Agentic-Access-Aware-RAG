# Bedrohungsmodell — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | [한국어](../ko/threat-model.md) | [简体中文](../zh-CN/threat-model.md) | [繁體中文](../zh-TW/threat-model.md) | [Français](../fr/threat-model.md) | **Deutsch** | [Español](../es/threat-model.md)

**Erstellungsdatum**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Sicherheitsarchitekten, Bedrohungsmodellierung-Verantwortliche, CISOs

---

## Überblick

Dieses Dokument ist ein Bedrohungsmodell, das die wichtigsten Bedrohungen, Angriffsvektoren, Auswirkungen, bestehende Gegenmaßnahmen und empfohlene zusätzliche Maßnahmen für das Permission-aware Agentic RAG-System zusammenfasst.

---

## Systemgrenzen und Vertrauensgrenzen

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Vertrauensgrenze 1: Internet → CloudFront                               │
│  Angreifer: Externe Benutzer, Bots, Skripte                             │
├─────────────────────────────────────────────────────────────────────────┤
│ Vertrauensgrenze 2: CloudFront → Lambda (WebApp)                        │
│  Angreifer: Authentifizierte aber nicht autorisierte Benutzer            │
├─────────────────────────────────────────────────────────────────────────┤
│ Vertrauensgrenze 3: Lambda → Bedrock / DynamoDB / FSx                   │
│  Angreifer: Interne Bedrohungen, Fehlkonfigurationen, Lieferkette       │
├─────────────────────────────────────────────────────────────────────────┤
│ Vertrauensgrenze 4: FSx ONTAP → S3 Access Point → Bedrock KB            │
│  Angreifer: Privilegieneskalation, Metadaten-Manipulation               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Bedrohungskatalog

### T1: Prompt Injection

| Element | Details |
|---------|---------|
| **Bedrohung** | Böswillige Prompts bewirken das Ignorieren von Systemprompts, Umgehung von Berechtigungsprüfungen und unbeabsichtigte Informationsoffenlegung |
| **Angriffsvektor** | Benutzereingabe → Converse API / Agent |
| **Auswirkung** | Hoch — Offenlegung von Inhalten nicht autorisierter Dokumente, Veränderung des Systemverhaltens |
| **Bestehende Gegenmaßnahmen** | Bedrock Guardrails (Inhaltsfilter), SID-Filterung wird auf Anwendungsseite durchgeführt (LLM kann nicht umgehen) |
| **Zusätzliche Empfehlungen** | Guardrails Prompt Attack-Filter aktivieren, Eingabelängenbegrenzung, Ausgabevalidierungsschicht hinzufügen |
| **Restrisiko** | Indirekte Prompt Injection (in Dokumente eingebettete Anweisungen) kann nicht vollständig verhindert werden |


**Wichtig**: In diesem System wird die SID-Filterung außerhalb des LLM (auf der Anwendungsschicht) ausgeführt, sodass die Berechtigungsprüfung selbst nicht durch Prompt Injection umgangen werden kann. Es besteht jedoch weiterhin das Risiko, dass Informationen aus autorisierten Dokumenten in unbeabsichtigter Weise offengelegt werden.

---

### T2: Retrieval Poisoning

| Element | Details |
|---------|---------|
| **Bedrohung** | Platzierung böswilliger Dokumente im FSx-Volume zur Vergiftung der RAG-Suchergebnisse |
| **Angriffsvektor** | CIFS/SMB-Zugriff → FSx-Volume → S3 AP → Bedrock KB |
| **Auswirkung** | Mittel bis Hoch — Generierung von Fehlinformationen, Phishing-Weiterleitung, indirekte Prompt Injection |
| **Bestehende Gegenmaßnahmen** | NTFS ACL-Schreibbeschränkungen, Transfer Family IAM-Rollenbeschränkungen, `.metadata.json` kann nur durch Service-Rolle generiert werden |
| **Zusätzliche Empfehlungen** | Malware-Scan bei Dokumenteneinspeisung, Inhaltsvalidierungspipeline, Anomalieerkennung (Alarm bei plötzlichem Dokumentenanstieg) |
| **Restrisiko** | Absichtliche Vergiftung durch interne Benutzer mit legitimen Schreibberechtigungen |

---

### T3: Cross-User Data Leakage

| Element | Details |
|---------|---------|
| **Bedrohung** | Suchergebnisse von Benutzer A enthalten Dokumente, auf die nur Benutzer B zugreifen darf |
| **Angriffsvektor** | Implementierungsfehler in der SID-Filterung, Cache-Vergiftung, Sitzungsverwechslung |
| **Auswirkung** | Hoch — Offenlegung vertraulicher Informationen, Compliance-Verstöße |
| **Bestehende Gegenmaßnahmen** | SID-Matching (Schnittmenge), Fail-Closed-Prinzip, Berechtigungsmatrix-Tests (31 Szenarien) |
| **Zusätzliche Empfehlungen** | Regelmäßige automatische Ausführung von Berechtigungsmatrix-Tests, Anomalieerkennung (Zugriffsmuster auf normalerweise nicht zugegriffene Dokumente) |
| **Restrisiko** | Niedrig — Da die SID-Filterung außerhalb des LLM ausgeführt wird, ist eine Umgehung außer durch Implementierungsfehler schwierig |

---

### T4: Stale ACL / Permission Drift

| Element | Details |
|---------|---------|
| **Bedrohung** | Datei-ACL wurde geändert, aber veraltete Berechtigungen verbleiben in den Vektorspeicher-Metadaten oder im Berechtigungscache |
| **Angriffsvektor** | ACL-Änderung → Metadaten nicht aktualisiert → Suche mit alten Berechtigungen möglich |
| **Auswirkung** | Mittel — Zugriff für einen bestimmten Zeitraum nach Berechtigungsentzug möglich (maximal 35 Minuten) |
| **Bestehende Gegenmaßnahmen** | KB Auto-Sync (15-Minuten-Intervall), Berechtigungscache-TTL (5 Minuten), Notfall-Berechtigungsentzugsverfahren |
| **Zusätzliche Empfehlungen** | Sofortige Erkennung von ACL-Änderungsereignissen (FSx Audit Log → EventBridge), Prüfung der Cache-TTL-Verkürzung, Berechtigungsänderungs-Auditprotokoll |
| **Restrisiko** | Aufgrund des Eventually-Consistent-Modells ist eine vollständige Echtzeit-Synchronisation nicht möglich. Im Notfall wird manueller Entzug durchgeführt |

**Details**: Siehe [permission-consistency.md](permission-consistency.md)

---

### T5: Over-Permissive Cache

| Element | Details |
|---------|---------|
| **Bedrohung** | Berechtigungscache wird in einem übermäßig permissiven Zustand fixiert und gewährt weiterhin Zugriff, der eigentlich verweigert werden sollte |
| **Angriffsvektor** | Race Condition beim Cache-Schreiben, TTL-Fehlkonfiguration, Cache-Key-Kollision |
| **Auswirkung** | Hoch — Fortgesetzter Zugriff auf nicht autorisierte Dokumente |
| **Bestehende Gegenmaßnahmen** | Automatischer Ablauf durch DynamoDB TTL (5 Minuten), Cache-Key enthält Benutzer-ID + Dokument-ID |
| **Zusätzliche Empfehlungen** | Überwachung der Cache-Trefferquote, Alarm bei ungewöhnlich hoher Trefferquote, regelmäßige vollständige Cache-Löschung (täglich) |
| **Restrisiko** | Niedrig — Aufgrund der kurzen TTL erfolgt bei Vergiftung eine automatische Wiederherstellung innerhalb von 5 Minuten |

---

### T6: Agent Tool Abuse

| Element | Details |
|---------|---------|
| **Bedrohung** | Agent ruft unbeabsichtigte Tools auf und führt Datenänderung, -löschung oder externe Übertragung durch |
| **Angriffsvektor** | Prompt Injection → Veränderung des Agent-Aktionsplans → Aufruf gefährlicher Tools |
| **Auswirkung** | Hoch — Datenzerstörung, Informationsleck, Kostenexplosion |
| **Bestehende Gegenmaßnahmen** | AgentCore Policy (Tool-Zugriffsbeschränkung), Minimale Berechtigungen für Action Group IAM-Rollen, standardmäßig nur Lesezugriff-Tools bereitgestellt |
| **Zusätzliche Empfehlungen** | Human Approval (Genehmigung vor Ausführung externer Aktionen), Begrenzung der Tool-Aufrufanzahl, Kostenobergrenze |
| **Restrisiko** | Mittel — Trade-off zwischen Agent-Autonomie und Sicherheit. Bei Beschränkung auf Lesezugriff ist das Risiko gering |

---

### T7: Audit Log Tampering

| Element | Details |
|---------|---------|
| **Bedrohung** | Manipulation oder Löschung von Auditprotokollen zur Verschleierung von unbefugtem Zugriff |
| **Angriffsvektor** | Privilegieneskalation der Lambda-Ausführungsrolle → Manipulation von CloudWatch Logs / S3 |
| **Auswirkung** | Hoch — Unfähigkeit zur Vorfalluntersuchung, Compliance-Verstöße |
| **Bestehende Gegenmaßnahmen** | CloudWatch Logs-Aufbewahrungsrichtlinie, IAM-Minimalprinzip |
| **Zusätzliche Empfehlungen** | S3 Object Lock (WORM), CloudTrail-Protokollspeicherung in separatem Konto, Protokollintegritätsvalidierung (CloudTrail Digest) |
| **Restrisiko** | Niedrig — Mit S3 Object Lock + separater Kontospeicherung ist Manipulation praktisch unmöglich |

**Details**: Siehe [governance-and-audit.md](governance-and-audit.md)

---

### T8: Misconfigured Identity Federation

| Element | Details |
|---------|---------|
| **Bedrohung** | Fehlkonfiguration von OIDC / SAML / LDAP ermöglicht unbefugten Benutzern die Authentifizierung oder gewährt legitimen Benutzern übermäßige Berechtigungen |
| **Angriffsvektor** | IdP-Fehlkonfiguration → Ausstellung ungültiger Token → Cognito-Authentifizierung bestanden → Übermäßige SID-Zuweisung |
| **Auswirkung** | Hoch — Privilegieneskalation, Zugriff auf alle Dokumente |
| **Bestehende Gegenmaßnahmen** | `authFailureMode=fail-closed` (Blockierung bei Berechtigungsabruffehler), Cognito-Token-Validierung, LDAP-Gesundheitsprüfung |
| **Zusätzliche Empfehlungen** | Regelmäßige Überprüfung der IdP-Konfiguration, automatische Validierung der Föderationsmetadaten, Alarm bei ungewöhnlicher Anzahl von Gruppen-SIDs |
| **Restrisiko** | Mittel — IdP-seitige Konfiguration liegt außerhalb der Kontrolle dieses Systems. Fail-Closed begrenzt die Auswirkungen |

---

### T9: Vector Metadata Leakage

| Element | Details |
|---------|---------|
| **Bedrohung** | Unbeabsichtigte Offenlegung von Vektorspeicher-Metadaten (SID-Informationen, Dateipfade), die Informationen über Organisationsstruktur und Zugriffsberechtigungen preisgeben |
| **Angriffsvektor** | Direkter Zugriff auf S3 Vectors / OpenSearch Serverless, übermäßige Informationsrückgabe in API-Antworten |
| **Auswirkung** | Mittel — Rückschlüsse auf Organisationsstruktur, Informationssammlung für gezielte Angriffe |
| **Bestehende Gegenmaßnahmen** | Zugriffsbeschränkung über VPC-Endpunkte, Verhinderung des Direktzugriffs durch IAM-Richtlinien, Ausschluss von SID-Informationen aus API-Antworten (Frontend) |
| **Zusätzliche Empfehlungen** | Minimale Berechtigungen für S3 Vectors-Bucket-Richtlinie, Überprüfung der OpenSearch Serverless-Datenzugriffsrichtlinie, Verschlüsselung der Metadaten |
| **Restrisiko** | Niedrig — Nur Zugriff über Bedrock KB erlaubt, Direktzugriff durch IAM verhindert |

---

### T10: Denial of Wallet / Cost Abuse

| Element | Details |
|---------|---------|
| **Bedrohung** | Explosion der AWS-Nutzungskosten durch massenhafte Anfragen oder absichtliche Nutzung hochpreisiger Modelle |
| **Angriffsvektor** | Massenhafte Abfragen durch authentifizierte Benutzer, Endlosschleifen im Agent-Modus, kontinuierliche Nutzung hochpreisiger Modelle |
| **Auswirkung** | Hoch — Unerwartete hohe Rechnungen |
| **Bestehende Gegenmaßnahmen** | WAF-Ratenbegrenzung (2000 req/5min), Smart Routing (Bevorzugung kostengünstiger Modelle), Lambda-Parallelitätsbegrenzung |
| **Zusätzliche Empfehlungen** | AWS Budgets-Alarme, tägliche Abfrageobergrenze pro Benutzer, Agent-Schrittanzahl-Obergrenze, Prüfung von Bedrock Provisioned Throughput |
| **Restrisiko** | Mittel — Durch Ratenbegrenzung gemildert, aber übermäßige Nutzung durch legitime Benutzer kann nicht vollständig verhindert werden |


---

## Bedrohungs-Gegenmaßnahmen-Zuordnungstabelle

| Bedrohung | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|-----------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
| T1: Prompt Injection | — | ✅ | — | — | — | — | ✅ | — |
| T2: Retrieval Poisoning | — | ✅ | — | — | ✅ | — | ✅ | — |
| T3: Cross-User Leakage | — | — | ✅ | ✅ | — | — | ✅ | — |
| T4: Stale ACL | — | — | — | ✅ | — | — | ✅ | — |
| T5: Over-Permissive Cache | — | — | ✅ | ✅ | — | — | ✅ | — |
| T6: Agent Tool Abuse | — | ✅ | — | — | ✅ | — | ✅ | ✅ |
| T7: Audit Log Tampering | — | — | — | — | ✅ | ✅ | — | — |
| T8: Misconfigured IdP | — | — | — | ✅ | ✅ | — | ✅ | — |
| T9: Metadata Leakage | — | — | — | — | ✅ | ✅ | ✅ | — |
| T10: Cost Abuse | ✅ | — | — | — | — | — | ✅ | ✅ |

---

## Zusammenfassung der Risikobewertung

| Bedrohung | Wahrscheinlichkeit | Auswirkung | Restrisiko | Priorität |
|-----------|-------------------|------------|------------|-----------|
| T1: Prompt Injection | Hoch | Mittel | Mittel | P1 |
| T2: Retrieval Poisoning | Niedrig | Hoch | Niedrig | P2 |
| T3: Cross-User Leakage | Niedrig | Hoch | Niedrig | P1 |
| T4: Stale ACL | Mittel | Mittel | Mittel | P2 |
| T5: Over-Permissive Cache | Niedrig | Hoch | Niedrig | P3 |
| T6: Agent Tool Abuse | Mittel | Hoch | Mittel | P1 |
| T7: Audit Log Tampering | Niedrig | Hoch | Niedrig | P2 |
| T8: Misconfigured IdP | Mittel | Hoch | Mittel | P1 |
| T9: Metadata Leakage | Niedrig | Mittel | Niedrig | P3 |
| T10: Cost Abuse | Mittel | Mittel | Mittel | P2 |

---

## Empfohlene zusätzliche Gegenmaßnahmen (nach Priorität)

### Sofortige Maßnahmen (P1)

1. **Aktivierung des Guardrails Prompt Attack-Filters** — Gegenmaßnahme für T1
2. **Implementierung von Human Approval für Agent-Tool-Aufrufe** — Gegenmaßnahme für T6
3. **Etablierung eines regelmäßigen IdP-Konfigurationsaudit-Prozesses** — Gegenmaßnahme für T8
4. **Integration von Berechtigungsmatrix-Tests in CI/CD** — Gegenmaßnahme für T3

### Kurzfristige Maßnahmen (P2)

5. **Schutz der Auditprotokolle durch S3 Object Lock** — Gegenmaßnahme für T7
6. **Sofortige Erkennung von ACL-Änderungsereignissen** — Gegenmaßnahme für T4
7. **Inhaltsvalidierung bei Dokumenteneinspeisung** — Gegenmaßnahme für T2
8. **AWS Budgets + benutzerspezifische Abfrageobergrenze** — Gegenmaßnahme für T10

### Mittelfristige Maßnahmen (P3)

9. **Anomalieerkennung der Cache-Trefferquote** — Gegenmaßnahme für T5
10. **Verschlüsselung der Vektorspeicher-Metadaten** — Gegenmaßnahme für T9

---

## Verwandte Dokumente

| Dokument | Zugehörige Bedrohungen |
|----------|----------------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Alle Bedrohungen (Überprüfung der Maßnahmen bei Produktionseinführung) |
| [permission-consistency.md](permission-consistency.md) | T3, T4, T5 (Berechtigungskonsistenz) |
| [governance-and-audit.md](governance-and-audit.md) | T7, T8, T9 (Audit & Governance) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | T2, T10 (Sicherer Experimentierbereich) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | T1, T3, T5 (SID-Filterungsdesign) |