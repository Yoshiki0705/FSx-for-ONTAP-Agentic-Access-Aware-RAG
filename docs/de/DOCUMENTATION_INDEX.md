# Dokumentationsindex

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | **Deutsch** | [Español](../es/DOCUMENTATION_INDEX.md)

## Wichtige Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [README.md](../../README.de.md) | Systemübersicht, Architektur, Bereitstellungsschritte, WAF/Geo-Einstellungen |
| [auth-and-user-management.md](auth-and-user-management.md) | Authentifizierungs- und Benutzerverwaltungshandbuch (Authentifizierungsmodus-Auswahl, AD Federation, automatische SID-Registrierung, Fehlerbehebung) |
| [implementation-overview.md](implementation-overview.md) | Detaillierte Implementierung (22 Aspekte: Bildanalyse RAG, KB-Verbindungs-UI, Smart Routing, Überwachung und Warnungen, OIDC/LDAP Federation) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Detailliertes Design der SID-basierten Berechtigungsfilterung |
| [verification-report.md](verification-report.md) | Verifizierungsverfahren und Testfälle nach der Bereitstellung |
| [ui-specification.md](ui-specification.md) | Chatbot-UI-Spezifikation (KB/Agent-Modus, Agent Directory, Enterprise-Agent-Funktionen, Seitenleisten-Design) |
| [demo-recording-guide.md](demo-recording-guide.md) | Leitfaden zur Demo-Videoaufzeichnung (6 Nachweise) |
| [embedding-server-design.md](embedding-server-design.md) | Design- und Implementierungsdokument des Embedding-Servers |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | CDK-Stack-Architekturleitfaden (Vektorspeicher-Vergleich, Implementierungserkenntnisse) |
| [README - AD SAML Federation](../../README.de.md#ad-saml-federation-optional) | AD SAML Federation-Einrichtung (Managed AD / Self-managed AD) |

## Einrichtung und Verifizierung

| Dokument | Beschreibung |
|----------|--------------|
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | Leitfaden zur Demo-Umgebungseinrichtung nach Authentifizierungsmodus (5 Modi, mit Beispielkonfigurationsdateien) |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Verifizierungsszenarien (Berechtigungsunterschiede Admin vs. Standardbenutzer, AD SSO-Anmeldung, OIDC/LDAP-Anmeldung) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD-Integration, CIFS-Freigabe, NTFS ACL-Konfiguration, Name-Mapping-Konfiguration (verifizierte Verfahren) |
| [demo-environment-guide.md](demo-environment-guide.md) | Ressourcen-IDs der Verifizierungsumgebung, Zugangsinformationen, Embedding-Server-Verfahren |

## Enterprise-Design- und Betriebsleitfaden

| Dokument | Beschreibung |
|----------|--------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Produktionsbereitschafts-Checkliste (Demo → PoC → Production Reifegraddefinitionen, Sicherheits-/Audit-/DR-/Betriebsprüfpunkte, mit Genehmiger-Spalte) |
| [poc-success-criteria-template.md](poc-success-criteria-template.md) | PoC-Erfolgskriterien-Vorlage (Stakeholder-Definitionen, Go/No-Go-Kriterien, Bedingungen für die nächste Phase, Abschlussberichtsvorlage) |
| [data-readiness-assessment.md](data-readiness-assessment.md) | Datenbereitschafts-Bewertungsvorlage (Datenstandort/-klassifizierung/-Berechtigungsstruktur/-qualität/-Compliance-Prüfungen, Genehmigungsfluss) |
| [partner-faq.md](partner-faq.md) | Partner-FAQ (12 Fragen und Antworten für Kundenangebote, Liste der Angebotsressourcen) |
| [permission-consistency.md](permission-consistency.md) | Konsistenzmodell für Berechtigungsänderungen (ACL-Änderung → Metadaten-Neugenerierung → KB-Neusynchronisierung → Cache-Invalidierung, maximale Latenz, Notfall-Berechtigungsentzugsverfahren) |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Dimensionierungs- und Leistungsleitfaden (skalenbasierte Konfigurationen, S3 AP-Überlegungen, QoS, Vektorspeicher-Auswahl) |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-Tenant- und Partner-Bereitstellungsmuster (Kontoisolierung/SVM-Isolierung/Hybrid, Kostenschätzungsvorlagen) |
| [governance-and-audit.md](governance-and-audit.md) | Governance- und Audit-Design (Audit-Log-Schema, Responsible AI, Guardrails-Richtlinien, branchenspezifische Anwendungsfälle) |
| [evaluation.md](evaluation.md) | RAG / Agent Bewertungsmetriken (4-Achsen-Bewertung: Business-KPIs, RAG-Qualität, Berechtigungskontrolle, Agent-Leistung; PoC-Bewertungsvorlage) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Leitfaden für sicheres Experimentieren (Umfangsdefinition, verbotene Aktionen, Checkliste für Echtdaten-Einspeisung, Rollback-Verfahren) |
| [threat-model.md](threat-model.md) | Bedrohungsmodell (10 Bedrohungskategorien, Angriffspfade, bestehende Gegenmaßnahmen, zusätzliche Empfehlungen, Bedrohungs-Gegenmaßnahmen-Zuordnungstabelle) |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch-Dashboard-Betriebsleitfaden (Metrikliste, Alarmdefinitionen, Fehlerbehebungsmuster) |
| [poc-workshop-guide.md](poc-workshop-guide.md) | PoC-Workshop-Leitfaden (90 Minuten: Bereitstellung → Test → Bewertung → Bereinigung) |
| [cost-estimation-worksheet.md](cost-estimation-worksheet.md) | Kostenschätzungs-Arbeitsblatt (monatliche Kostenvorlagen je Konfiguration, Formeln, Optimierungspunkte) |
| [architecture-decision-records.md](architecture-decision-records.md) | Architecture Decision Records (6 Schlüsselentscheidungen: Vektorspeicher, Berechtigungsfilter, Authentifizierung, Frontend, Synchronisierung, Routing) |
| [managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Bewertung des Migrationspfads zu Amazon Bedrock Managed Knowledge Base (Vergleich mit bestehendem KB + OpenSearch Serverless / S3 Vectors, Auswirkung auf Permission-aware RAG, ACL-Metadatenfilter-Verifizierungspunkte, schrittweise Migration). AWS Summit NY 2026 |
| [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) | Managed KB Upgrade-Pfad (S3 AP-Datenquellen-Verbindungsvalidierungsschritte V1–V4, Permission-aware-Designherausforderungen, sicheres Validierungsmuster mit FlexClone, Auswahlleitfaden nach Einsatzzweck). Parallele Option / Validierungsverfahren |
| [investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | Designuntersuchung zur Integration des AgentCore Web Search Tool als Hybrid-Suchoption im Permission-aware RAG (UI-Umschalter, us-east-1 regionsübergreifendes Gateway, Lambda Layer/inline, Abfragesicherheit / Zitattrennung / Prompt-Injection-Abwehr, Implementierungsreihenfolge). AWS Summit NY 2026 |
| [monitoring/athena-audit-tables.sql](../../monitoring/athena-audit-tables.sql) | Athena-Tabellendefinitionen (DDL für Audit-Log-Analyse + Beispielabfragen) |
| [benchmark-scenarios.md](benchmark-scenarios.md) | Benchmark-Szenarien (10K/100K/1M Dateien, 5 Messszenarien, theoretische Basiswertschätzungen) |
| [demo-data/industry-packs/](../../demo-data/industry-packs/) | Branchenspezifische Demo-Datenpakete (8 Branchen × 5 Dokumente: öffentlicher Sektor, Gesundheitswesen, Recht, Fertigung, Bau, Bildung, Versicherung + generisch) |
| [s3ap-serverless-patterns-integration.md](s3ap-serverless-patterns-integration.md) | S3AP Serverless Patterns Integrationsarchitektur (3-Muster-Integration mit 17 UCs) |
| [benchmarks/](../../benchmarks/) | Benchmark-Framework (Testdatengenerierung, Ausführungsskripte, Ergebnisvorlagen) |
| [tests/permission-matrix/](../../tests/permission-matrix/) | Berechtigungsmatrix-Tests (31 ACL-Grenzfallszenarien: Fail-Closed, Gruppenverschachtelung, vererbte Berechtigungen, Notfallentzug) |

## FSx for ONTAP Betriebsautomatisierung

| Dokument | Beschreibung |
|----------|--------------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | Übersicht der Betriebsautomatisierungssuite (Verzeichnisstruktur, Anwendungsfälle) |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | Warum diese Architektur FSx for ONTAP-Operationen vereinfacht (Designentscheidungen, Kostenschätzungen, Sicherheitsdesign) |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | AWS-Integrationsverifizierungsbericht (2026-05-01, alle Phasen BESTANDEN) |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | Integrierte CloudFormation-Vorlage (inkl. VPC-Endpunkte) |

## Transfer Family Ingestion

| Dokument | Beschreibung |
|----------|--------------|
| [transfer-family-e2e-verification.md](transfer-family-e2e-verification.md) | E2E-Verifizierungsbericht (SFTP-Verbindung → Upload → KB-Ingestion abgeschlossen, alle Schritte BESTANDEN) |
| [transfer-family-partner-onboarding.md](transfer-family-partner-onboarding.md) | Partner-Onboarding-Leitfaden (SSH-Schlüssel-Einrichtung, SFTP-Verbindung, Dateibenennungskonventionen, Fehlerbehebung) |
| [transfer-family-networking-prerequisites.md](transfer-family-networking-prerequisites.md) | Netzwerk-Voraussetzungen (VPC-Endpunkte, IP-Zulassungsliste, Sicherheitsgruppen) |
| [v4.2-demo-verification-supplement.md](v4.2-demo-verification-supplement.md) | v4.2 Demo-Verifizierungsergänzung (Testverfahren für alle Anwendungsfälle, erwartete Ergebnisse, Log-Abrufmethoden) |

## Beispielkonfigurationsdateien

| Datei | Authentifizierungsmodus | Beschreibung |
|-------|------------------------|--------------|
| `demo-data/configs/mode-a-email-password.json` | E-Mail/Passwort | Minimalkonfiguration, manuelle SID-Registrierung |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP Name-Mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0 (ohne LDAP) |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP gleichzeitige Aktivierung |

## Embedding-Server (über FlexCache CIFS-Einbindung)

| Dokument / Datei | Beschreibung |
|-------------------|--------------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Bereitstellungs- und Betriebsverfahren des Embedding-Servers |
| `docker/embed/src/index.ts` | Embedding-App (Dokumentenscan → Chunk-Aufteilung → Vektorisierung → Indexierung) |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4-Signatur-Client (IMDS-Authentifizierungsunterstützung) |
| `docker/embed/Dockerfile` | Embedding-Container-Definition (node:22-slim, cifs-utils) |
| `docker/embed/buildspec.yml` | CodeBuild-Build-Definition |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK-Definition (EC2 + ECR + IAM) |

## Einrichtungsskripte

| Skript | Beschreibung |
|--------|--------------|
| `demo-data/scripts/create-demo-users.sh` | Cognito-Testbenutzer erstellen |
| `demo-data/scripts/setup-user-access.sh` | SID-Daten in DynamoDB registrieren |
| `demo-data/scripts/upload-demo-data.sh` | Testdokumente nach S3 hochladen |
| `demo-data/scripts/sync-kb-datasource.sh` | Bedrock KB-Datenquelle synchronisieren |
| `demo-data/scripts/setup-openldap.sh` | OpenLDAP-Server-Einrichtung (EC2 in VPC, Testbenutzer/-gruppen) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API Name-Mapping-Regeleinrichtung |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP-Integrationsverifizierung (Lambda → LDAP → DynamoDB) |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP Name-Mapping-Verifizierung (REST API-Verbindung und Regelabruf) |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | Modus C (OIDC+LDAP) One-Shot-Einrichtung (alle Phasen automatisch ausgeführt) |

## Empfohlene Lesereihenfolge

### Phase 1: Ersteinrichtung

1. **README.md** — Systemübersicht und Bereitstellungsschritte
2. **auth-and-user-management.md** — Authentifizierungsmodus-Auswahl und Benutzerverwaltung
3. **implementation-overview.md** — Detaillierte Implementierung über 22 Aspekte
4. **SID-Filtering-Architecture.md** — Technische Details der Kernfunktion
5. **safe-experimentation-guide.md** — Leitfaden für sicheres Experimentieren (Pflichtlektüre vor PoC-Start)

### Phase 2: Verifizierung und Bewertung

6. **demo-recording-guide.md** — Leitfaden zur Demo-Videoaufzeichnung
7. **ontap-setup-guide.md** — FSx for ONTAP AD-Integration, CIFS-Freigabe-Einrichtung
8. **demo-environment-guide.md** — Einrichtung der Verifizierungsumgebung
9. **demo-scenario.md** — Verifizierungsszenarien ausführen
10. **evaluation.md** — PoC-Bewertungsvorlage

### Phase 3: Produktion und Enterprise-Design

11. **production-readiness-checklist.md** — Produktionsbereitschafts-Checkliste
12. **permission-consistency.md** — Konsistenzmodell für Berechtigungsänderungen
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP Dimensionierung und Leistung
14. **governance-and-audit.md** — Governance- und Audit-Design
15. **partner-deployment-patterns.md** — Multi-Tenant-Bereitstellungsmuster
