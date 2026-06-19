# Partner-FAQ (Häufig gestellte Fragen)

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | [한국어](../ko/partner-faq.md) | [简体中文](../zh-CN/partner-faq.md) | [繁體中文](../zh-TW/partner-faq.md) | [Français](../fr/partner-faq.md) | **Deutsch** | [Español](../es/partner-faq.md)

**Erstellungsdatum**: 2026-05-24  
**Zielgruppe**: Partnerunternehmen, Systemintegratoren (SI) und Beratungsunternehmen

---

## Häufige Fragen bei Kundenvorschlägen

### Q1. Ist eine Migration von einem bestehenden Dateiserver (Windows Server) möglich?

**A**: Ja. FSx for ONTAP unterstützt dasselbe SMB/CIFS-Protokoll wie Windows Server-Dateiserver und behält NTFS ACLs unverändert bei. Durch den Beitritt zu Ihrer bestehenden Active Directory-Domäne bleibt die Benutzererfahrung unverändert. Für die Migration können AWS DataSync oder robocopy verwendet werden.

**Zugehöriges Dokument**: [FSx for ONTAP Sizing und Performance-Design](fsxn-sizing-and-performance.md)

---

### Q2. Wer konfiguriert die Berechtigungen? Ist eine zusätzliche Einrichtung erforderlich?

**A**: Bestehende NTFS ACLs / UNIX-Berechtigungen werden direkt in der RAG-Suche berücksichtigt. Eine zusätzliche Berechtigungskonfiguration ist nicht erforderlich. Wenn Dateiserver-Administratoren Ordnerberechtigungen wie gewohnt festlegen, werden diese automatisch auf die RAG-Suchergebnisse angewendet.

**Funktionsweise**: Berechtigungsinformationen (SID/UID/GID) werden in der `.metadata.json` jeder Datei gespeichert, und zur Suchzeit werden die Ergebnisse durch Abgleich mit den Berechtigungen des Benutzers gefiltert.

---

### Q3. Wie viele Dateien kann das System verarbeiten?

**A**: Wir empfehlen die folgenden Konfigurationen je nach Größe:

| Größe | Anzahl Dateien | FSx-Konfiguration | Monatliche Schätzung |
|------|-----------|---------|---------|
| Klein (PoC) | Bis zu 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| Mittel | Bis zu 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| Groß | Bis zu 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**Zugehöriges Dokument**: [Kostenschätzungs-Arbeitsblatt](cost-estimation-worksheet.md)

---

### Q4. Kann es in bestehende Identity Provider (Active Directory / Okta / Auth0) integriert werden?

**A**: Ja. Die folgenden Authentifizierungsmethoden werden unterstützt:

| Authentifizierungsmethode | Unterstützte IdPs | SID-/Berechtigungsabruf |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger ruft SID automatisch aus AD ab |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC-Gruppenansprüche + LDAP-Abfrage |
| LDAP | OpenLDAP, FreeIPA | Direkter UID-/GID-Abruf |
| E-Mail/Passwort | Cognito | Manuelle Registrierung in DynamoDB |

**Zugehöriges Dokument**: [Leitfaden zur Authentifizierung und Benutzerverwaltung](auth-and-user-management.md)

---

### Q5. Wie lange dauert ein PoC und was kostet er?

**A**: 

| Phase | Dauer | AWS-Kosten | Aktivitäten |
|---------|------|-----------|---------|
| Bereitstellung | 1 Tag | — | CDK-Deploy + Testdaten-Ingestion |
| Grundlegende Validierung | 1 Woche | ~$100 | Funktionsprüfung mit Demodaten |
| Kundendaten-PoC | 2-4 Wochen | ~$430/Monat | Echtdaten-Ingestion + Evaluierung |

Ein **90-minütiger praktischer Workshop** ist ebenfalls verfügbar → [PoC-Workshop-Leitfaden](poc-workshop-guide.md)

---

### Q6. Kann dies Kunden mit strengen Sicherheitsanforderungen (Finanzwesen, Gesundheitswesen, öffentlicher Sektor) angeboten werden?

**A**: Ja. Das System umfasst die folgenden Sicherheitsfunktionen:

- 6-Schichten-Verteidigung (Geo-Beschränkung → WAF → OAC → IAM Auth → Cognito → SID-Filterung)
- KMS-Verschlüsselung (S3, DynamoDB, FSx)
- VPC-Endpunkte (ohne Internet-Routing)
- Audit-Protokolle (CloudTrail + DynamoDB-Audit-Tabelle)
- Fail-Closed-Design (Zugriff verweigert, wenn Berechtigungen unbekannt sind)
- Bedrock Guardrails (Inhaltsfilterung, PII-Erkennung)

**Jedoch**: Die technischen Sicherheitsfunktionen dieses Systems erfüllen rechtliche oder Compliance-Anforderungen nicht automatisch. Für regulierte Workloads sind kundenspezifische rechtliche und Compliance-Bewertungen erforderlich.

**Zugehörige Dokumente**: [Checkliste für Produktionsreife](production-readiness-checklist.md), [Bedrohungsmodell](threat-model.md)

---

### Q7. Ist Mandantenfähigkeit (Bereitstellung für mehrere Kunden) möglich?

**A**: Ja. Drei Bereitstellungsmuster sind verfügbar:

| Muster | Isolationsstufe | Anwendbare Bedingungen |
|---------|-----------|---------|
| A: Konto-Isolation | Höchste | Strenge Datenisolationsanforderungen (Finanzwesen, Gesundheitswesen) |
| B: SVM-Isolation | Hoch | Kundendaten innerhalb desselben Kontos isolieren |
| C: Präfix-Isolation | Mittel | Kostenorientiert, kleine Kunden |

**Zugehöriges Dokument**: [Partner-Bereitstellungsmuster](partner-deployment-patterns.md)

---

### Q8. Wie werden Dokumente von externen Partnern (Anwaltskanzleien, Wirtschaftsprüfungsgesellschaften) empfangen?

**A**: SFTP-Ingestion über AWS Transfer Family wird unterstützt. Partner laden einfach Dateien mit einem SFTP-Client hoch, und Berechtigungsmetadaten werden automatisch zugewiesen, bevor sie in die RAG Knowledge Base aufgenommen werden.

- Partner benötigen keinen Zugriff auf die Web UI oder die AWS Console
- Das Überschreiben von `.metadata.json` wird durch IAM Deny verhindert (Schutz der Vertrauensgrenze)
- Innerhalb von 5 Minuten per RAG durchsuchbar

**Zugehöriges Dokument**: [Transfer Family Partner-Onboarding](transfer-family-partner-onboarding.md)

---

### Q9. Können Fragen per Sprache gestellt werden?

**A**: Ja. Zwei Sprachchat-Modi sind verfügbar:

| Modus | Technologie | Latenz | Status |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | Mittel | GA, per CDK bereitstellbar |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | Niedrig | Implementiert, CLI-Deploy |

Die Berechtigungsfilterung wird im gesamten Ablauf angewendet: Spracheingabe → Textkonvertierung → Permission-aware-RAG-Suche → Sprachausgabe.

---

### Q10. Wie sieht es mit der Integration anderer AWS-Services aus?

**A**: Die folgenden Services sind bereits integriert:

| Service | Verwendung |
|---------|------|
| Amazon Bedrock (KB + Agent) | RAG-Suche + Multi-Agent-Kollaboration |
| Amazon Cognito | Authentifizierung und Benutzerverwaltung |
| Amazon CloudFront + WAF | CDN + Sicherheit |
| Amazon S3 Vectors | Vektor-DB (geringe Kosten) |
| Amazon EventBridge | KB-Auto-Sync-Planung |
| AWS Transfer Family | SFTP-Ingestion |
| Amazon CloudWatch | Überwachung, Alarme, Dashboards |
| AWS Step Functions | FSx for ONTAP-Betriebsautomatisierung |

---

## Technische FAQ

### Q11. Was ist der Unterschied zwischen einem S3 Access Point und einem S3-Bucket?

**A**: Ein S3 Access Point ist eine S3-kompatible Zugriffsschnittstelle für FSx for ONTAP-Volumes. Im Gegensatz zu S3-Buckets:

- Die Daten verbleiben auf FSx for ONTAP (sie werden nicht nach S3 kopiert)
- Auf dieselben Daten kann sowohl über NFS/SMB als auch über die S3-API zugegriffen werden
- Es gibt eine Upload-Größenbeschränkung von 5 GB
- rename / append-Operationen werden nicht unterstützt

---

### Q12. Was ist mit dem Rollback, wenn die Bereitstellung fehlschlägt?

**A**: Da CDK auf CloudFormation basiert, werden fehlgeschlagene Bereitstellungen automatisch zurückgerollt. Falls ein manuelles Rollback erforderlich ist:

```bash
# Bestimmten Stack löschen
npx cdk destroy <stack-name>

# Alle Stacks löschen
npx cdk destroy --all --force
```

**Zugehöriges Dokument**: [Bereitstellungs-Fehlerbehebung](deployment-troubleshooting.md)

---

## Ressourcen für Vorschläge und Workshops

| Ressource | Verwendung | Link |
|---------|------|--------|
| Branchenspezifische Demodaten | Auf die Kundenbranche zugeschnittene Demos | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90-minütiger Workshop | Praktische Erfahrung | [PoC-Workshop-Leitfaden](poc-workshop-guide.md) |
| Kostenschätzung | Anlage zum Vorschlag | [Kostenschätzungs-Arbeitsblatt](cost-estimation-worksheet.md) |
| PoC-Erfolgskriterien | Kundenvereinbarung | [PoC-Erfolgskriterien-Vorlage](poc-success-criteria-template.md) |
| Checkliste für Produktionsreife | Migrationsplanung | [Checkliste für Produktionsreife](production-readiness-checklist.md) |
| Architekturdiagramm | Anlage zum Vorschlag | Architecture-Abschnitt in README.md |
