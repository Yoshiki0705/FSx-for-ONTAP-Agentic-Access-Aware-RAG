# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | **Deutsch** | [Español](README.es.md)

> Referenzimplementierung für Permission-aware RAG + Agentic AI auf Unternehmensdaten in FSx for ONTAP. NTFS ACL / UNIX-Berechtigungen werden zur Abfragezeit automatisch angewendet. Einzeiliges AWS CDK Deployment. Von PoC bis Produktionsbewertung.

---

## Erste Schritte

| Ich möchte... | Anleitung | Dauer |
|---------------|-----------|-------|
| Schnell ausprobieren | [PoC-Workshop-Leitfaden](docs/de/poc-workshop-guide.md) | 90 Min. |
| In meinem Konto deployen | [Deployment-Leitfaden](docs/deployment-guide.md) | 30-40 Min. |
| Mit echten Daten validieren | [Leitfaden für sicheres Experimentieren](docs/de/safe-experimentation-guide.md) | 2-4 Wo. |
| Genauigkeit & Kosten bewerten | [RAG/Agent-Evaluierungsframework](docs/de/evaluation.md) | 1 Wo. |
| Produktionsreife prüfen | [Produktionsreife-Checkliste](docs/de/production-readiness-checklist.md) | — |
| Kosten schätzen | [Kostenschätzungs-Arbeitsblatt](docs/de/cost-estimation-worksheet.md) | — |

<details><summary>📂 Alle Funktionen & Design-Leitfäden</summary>

| Kategorie | Leitfaden | Inhalt |
|-----------|-----------|--------|
| Architektur | [Implementierungsübersicht (22 Aspekte)](docs/de/implementation-overview.md) | Technische Details aller Komponenten |
| Architektur | [Architecture Decision Records](docs/de/architecture-decision-records.md) | Begründung für 6 Schlüsselentscheidungen |
| Berechtigungen | [SID-Filterarchitektur](docs/de/SID-Filtering-Architecture.md) | Berechtigungsabgleich-Mechanismus |
| Auth | [Auth & Benutzerverwaltung](docs/de/auth-and-user-management.md) | OIDC / SAML / LDAP Integration |
| Sicherheit | [Bedrohungsmodell](docs/de/threat-model.md) | 10 Bedrohungskategorien, Angriffspfade |
| Sicherheit | [Governance & Audit](docs/de/governance-and-audit.md) | Audit-Logs, Responsible AI, Guardrails |
| Demo | [Branchendemo-Daten (7 Branchen)](demo-data/industry-packs/) | Verwaltung, Gesundheit, Recht, Fertigung, Bau, Bildung, Versicherung |
| Alle Docs | [Dokumentationsindex](docs/de/DOCUMENTATION_INDEX.md) | Vollständige Liste mit empfohlener Lesereihenfolge |

</details>

---

## Architektur

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (Auth: OIDC/SAML/Email)    (RAG-Suche + Embedding)      (SID/Berecht.-Daten)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**Ablauf**: Benutzerauthentifizierung → SID aus DynamoDB abrufen → Bedrock KB Vektorsuche → SID-Abgleichfilter → Antwort nur aus berechtigten Dokumenten generieren

Hauptmerkmale:
- **Permission-aware RAG** — NTFS ACL / UNIX-Berechtigungen automatisch bei Abfrage angewendet (Fail-Closed)
- **Agentic AI** — Umschalten zwischen KB-Modus (Dokumentensuche) und Agent-Modus (mehrstufige Schlussfolgerung)
- **Smart Routing** — Automatische Auswahl von Haiku / Sonnet / Opus nach Abfragekomplexität (40-60% Kostenreduktion)
- **Geringe Kosten** — S3 Vectors (wenige Dollar/Monat) als Standard
- **22 integrierte Funktionen** — Sprach-Chat, Guardrails, Graph RAG, Web Search u.v.m. ([Details](docs/de/implementation-overview.md))

<details><summary>⚠️ Voraussetzungen & Einschränkungen</summary>

| Element | Details |
|---------|---------|
| Voraussetzungen | Node.js 22+, Docker, AWS CLI konfiguriert, AdministratorAccess-äquivalent |
| Regionen | ap-northeast-1 (änderbar) + us-east-1 (WAF/Web Search, fest) |
| ONTAP-Version | 9.17.1+ (S3 Access Points Anforderung) |
| S3 AP Einschränkungen | Keine bedingten Schreibvorgänge, keine Event Notifications, hohe ListObjectsV2-Latenz |
| Vektorspeicher | S3 Vectors (Standard, 2KB filterable Limit) / OpenSearch Serverless (hohe Leistung) |
| Responsible AI | KI-Ausgaben sind Hilfssignale. Endentscheidungen liegen beim Menschen. [Details](docs/de/governance-and-audit.md) |

</details>

<details><summary>📚 Verwandte Repositories</summary>

| Repository | Zweck | Beschreibung |
|-----------|-------|--------------|
| **[Dieses Repo]** | AI / RAG | Permission-aware RAG + Agentic AI |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless | 17 branchenspezifische Serverless-Muster |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Athena / Glue / EMR / SageMaker Integration |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability | Audit-Log-Zustellung an Datadog / Splunk / Grafana ohne EC2 |

</details>

<details><summary>🔧 Entwickler</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

Projektstruktur und Konventionen: [CONTRIBUTING.md](CONTRIBUTING.md). Änderungsprotokoll: [CHANGELOG.md](CHANGELOG.md).

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Español](README.es.md)
