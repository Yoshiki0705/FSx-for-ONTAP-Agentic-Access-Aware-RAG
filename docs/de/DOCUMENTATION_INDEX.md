# Dokumentationsindex

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | **Deutsch** | [Español](../es/DOCUMENTATION_INDEX.md)

## Wichtige Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [README.md](../../README.de.md) | Systemübersicht, Architektur, Bereitstellungsschritte, WAF/Geo-Einstellungen |
| [implementation-overview.md](implementation-overview.md) | Detaillierte Implementierung (12 Aspekte: Bildanalyse RAG, KB-Verbindungs-UI, Smart Routing, Überwachung und Warnungen) |
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
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Verifizierungsszenarien (Berechtigungsunterschiede Admin vs. Standardbenutzer, AD SSO-Anmeldung) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD-Integration, CIFS-Freigabe, NTFS ACL-Konfiguration (verifizierte Verfahren) |
| [demo-environment-guide.md](demo-environment-guide.md) | Ressourcen-IDs der Verifizierungsumgebung, Zugangsinformationen, Embedding-Server-Verfahren |

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

## Empfohlene Lesereihenfolge

1. **README.md** — Systemübersicht und Bereitstellungsschritte
2. **implementation-overview.md** — Detaillierte Implementierung über 8 Aspekte
3. **SID-Filtering-Architecture.md** — Technische Details der Kernfunktion
4. **demo-recording-guide.md** — Leitfaden zur Demo-Videoaufzeichnung
5. **ontap-setup-guide.md** — FSx ONTAP AD-Integration, CIFS-Freigabe-Einrichtung
6. **README.md - AD SAML Federation** — AD SAML Federation-Einrichtung (optional)
7. **demo-environment-guide.md** — Einrichtung der Verifizierungsumgebung (einschließlich Embedding-Server)
8. **demo-scenario.md** — Verifizierungsszenarien ausführen (AD SSO-Anmeldung)
9. **verification-report.md** — Verifizierungsverfahren auf API-Ebene
