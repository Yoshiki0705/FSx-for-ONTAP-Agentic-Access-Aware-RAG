# Berechtigungsbewusstes RAG-System mit Amazon FSx for NetApp ONTAP

**🌐 Language / Sprache:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | **Deutsch** | [Español](README.es.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Dieses Repository ist ein Beispiel, das ein zugriffskontrollbewusstes Agentic RAG bereitstellt, das von Amazon Bedrock angetrieben und mit AWS CDK deployt wird. Es nutzt Unternehmensdaten und Zugriffsberechtigungen auf Amazon FSx for NetApp ONTAP. Mit FSx for ONTAP als Datenquelle implementiert es Suche und Antwortgenerierung unter Berücksichtigung von ACL-/Berechtigungsinformationen. Für den Vektorspeicher können Sie zwischen Amazon S3 Vectors (Standard, kostengünstig) oder Amazon OpenSearch Serverless (Hochleistung) wählen. Es verfügt über eine kartenbasierte, aufgabenorientierte Benutzeroberfläche, die mit Next.js 15 auf AWS Lambda (Lambda Web Adapter) erstellt wurde und es Ihnen ermöglicht, eine sichere RAG-/KI-Assistenten-Konfiguration für den Unternehmenseinsatz zu validieren.

---

## Architektur

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser   │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └────────┬─────────┘
                                          │ CIFS/SMB (Optional)
                                          ▼
                                 ┌──────────────────┐
                                 │ Embedding EC2    │
                                 │ (Titan Embed v2) │
                                 │ (Optional)       │
                                 └──────────────────┘
```

## Implementierungsübersicht (8 Perspektiven)

Die Implementierung dieses Systems ist in 8 Perspektiven organisiert. Details zu jedem Punkt finden Sie unter [docs/implementation-overview.md](docs/implementation-overview.md).

| # | Perspektive | Übersicht | Zugehöriger CDK Stack |
|---|-------------|-----------|----------------------|
| 1 | Chatbot-Anwendung | Next.js 15 (App Router) läuft serverlos mit Lambda Web Adapter. Unterstützung für KB/Agent-Moduswechsel. Kartenbasierte aufgabenorientierte Benutzeroberfläche | WebAppStack |
| 2 | AWS WAF | 6-Regel-Konfiguration: Ratenbegrenzung, IP-Reputation, OWASP-konforme Regeln, SQLi-Schutz, IP-Whitelist | WafStack |
| 3 | IAM-Authentifizierung | Mehrschichtige Sicherheit mit Lambda Function URL + CloudFront OAC | WebAppStack |
| 4 | Vektordatenbank | S3 Vectors (Standard, kostengünstig) / OpenSearch Serverless (Hochleistung). Auswahl über `vectorStoreType` | AIStack |
| 5 | Embedding-Server | Vektorisiert Dokumente auf EC2 mit über CIFS/SMB gemountem FSx ONTAP-Volume und schreibt in AOSS (nur AOSS-Konfiguration) | EmbeddingStack |
| 6 | Titan Text Embeddings | Verwendet `amazon.titan-embed-text-v2:0` (1024 Dimensionen) sowohl für die KB-Aufnahme als auch den Embedding-Server | AIStack |
| 7 | SID-Metadaten + Berechtigungsfilterung | Verwaltet NTFS ACL SID-Informationen über `.metadata.json` und filtert durch Abgleich der Benutzer-SIDs bei der Suche | StorageStack |
| 8 | KB/Agent-Moduswechsel | Umschalten zwischen KB-Modus (Dokumentensuche) und Agent-Modus (mehrstufiges Reasoning). Agent-Verzeichnis (`/genai/agents`) für katalogbasierte Agent-Verwaltung, Vorlagenerstellung, Bearbeitung und Löschung. Dynamische Agent-Erstellung und Kartenbindung. Ergebnisorientierte Workflows (Präsentationen, Genehmigungsdokumente, Besprechungsprotokolle, Berichte, Verträge, Onboarding). 8-Sprachen-i18n-Unterstützung. Berechtigungsbewusst in beiden Modi | WebAppStack |
| 9 | Bildanalyse-RAG | Bild-Upload (Drag & Drop / Dateiauswahl) zur Chat-Eingabe hinzugefügt. Analysiert Bilder mit der Bedrock Vision API (Claude Haiku 4.5) und integriert Ergebnisse in den KB-Suchkontext. Unterstützt JPEG/PNG/GIF/WebP, 3MB-Limit | WebAppStack |
| 10 | KB-Verbindungs-UI | Benutzeroberfläche zum Auswählen, Verbinden und Trennen von Bedrock Knowledge Bases bei der Agent-Erstellung/-Bearbeitung. Zeigt die verbundene KB-Liste im Agent-Detailpanel an | WebAppStack |
| 11 | Intelligentes Routing | Automatische Modellauswahl basierend auf der Abfragekomplexität. Kurze Faktenabfragen werden an das leichtgewichtige Modell (Haiku) weitergeleitet, lange analytische Abfragen an das Hochleistungsmodell (Sonnet). Ein/Aus-Schalter in der Seitenleiste | WebAppStack |
| 12 | Überwachung und Alarme | CloudWatch-Dashboard (Lambda/CloudFront/DynamoDB/Bedrock/WAF/Erweiterte RAG-Integration), SNS-Alarme (Fehlerrate- und Latenz-Schwellenwertbenachrichtigungen), EventBridge KB Ingestion Job-Fehlerbenachrichtigungen, EMF-benutzerdefinierte Metriken. Aktivierung mit `enableMonitoring=true` | WebAppStack (MonitoringConstruct) |
| 13 | AgentCore Memory | Gesprächskontextpflege über AgentCore Memory (Kurzzeit- und Langzeitgedächtnis). Sitzungsinterne Gesprächshistorie (Kurzzeit) + sitzungsübergreifende Benutzerpräferenzen und Zusammenfassungen (Langzeit). Aktivierung mit `enableAgentCoreMemory=true` | AIStack |

## UI-Screenshots

### KB-Modus — Kartenraster (Ausgangszustand)

Der Ausgangszustand des Chat-Bereichs zeigt 14 zweckspezifische Karten (8 Recherche + 6 Ausgabe) in einem Rasterlayout an. Enthält Kategoriefilter, Favoritenfunktion und InfoBanner (Berechtigungsinformationen).

![KB Mode Card Grid](docs/screenshots/kb-mode-cards-full.png)

### Agent-Modus — Kartenraster + Seitenleiste

Der Agent-Modus zeigt 14 Workflow-Karten (8 Recherche + 6 Ausgabe) an. Ein Klick auf eine Karte sucht automatisch nach einem Bedrock Agent, und wenn keiner erstellt wurde, navigiert er zum Erstellungsformular im Agent-Verzeichnis. Die Seitenleiste enthält ein Agent-Auswahl-Dropdown, Chat-Verlaufseinstellungen und einen einklappbaren Systemverwaltungsbereich.

![Agent Mode Card Grid](docs/screenshots/agent-mode-card-grid.png)

### Agent-Verzeichnis — Agent-Liste und Verwaltungsbildschirm

Ein dedizierter Agent-Verwaltungsbildschirm, erreichbar unter `/[locale]/genai/agents`. Bietet Kataloganzeige erstellter Bedrock Agents, Such- und Kategoriefilter, Detailpanel, vorlagenbasierte Erstellung und Inline-Bearbeitung/-Löschung. Die Navigationsleiste ermöglicht das Umschalten zwischen Agent-Modus / Agent-Liste / KB-Modus. Bei aktivierten Enterprise-Funktionen werden die Tabs „Geteilte Agents" und „Geplante Aufgaben" hinzugefügt.

![Agent Directory](docs/screenshots/agent-directory-enterprise.png)

#### Agent-Verzeichnis — Tab Geteilte Agents

Aktiviert mit `enableAgentSharing=true`. Listet, zeigt Vorschau und importiert Agent-Konfigurationen aus dem geteilten S3-Bucket.

![Shared Agents Tab](docs/screenshots/agent-directory-shared-tab.png)

### Agent-Verzeichnis — Agent-Erstellungsformular

Ein Klick auf „Aus Vorlage erstellen" auf einer Vorlagenkarte zeigt ein Erstellungsformular an, in dem Sie den Agent-Namen, die Beschreibung, den System-Prompt und das KI-Modell bearbeiten können. Dasselbe Formular erscheint, wenn Sie im Agent-Modus auf eine Karte klicken, für die noch kein Agent erstellt wurde.

![Agent Creation Form](docs/screenshots/agent-creator-form.png)

### Agent-Verzeichnis — Agent-Detail und Bearbeitung

Ein Klick auf eine Agent-Karte zeigt ein Detailpanel mit Agent-ID, Status, Modell, Version, Erstellungsdatum, System-Prompt (einklappbar) und Aktionsgruppen. Verfügbare Aktionen umfassen „Bearbeiten" für Inline-Bearbeitung, „Im Chat verwenden" zur Navigation zum Agent-Modus, „Exportieren" für JSON-Konfigurationsdownload, „In geteilten Bucket hochladen" für S3-Sharing, „Zeitplan erstellen" für periodische Ausführungseinstellungen und „Löschen" mit einem Bestätigungsdialog.

![Agent Detail Panel](docs/screenshots/agent-detail-panel.png)

### Chat-Antwort — Zitationsanzeige + Zugriffsebenen-Badge

RAG-Suchergebnisse zeigen FSx-Dateipfade und Zugriffsebenen-Badges (für alle zugänglich / nur Administratoren / bestimmte Gruppen). Während des Chats kehrt ein „🔄 Zurück zur Workflow-Auswahl"-Button zum Kartenraster zurück. Ein „➕"-Button auf der linken Seite des Nachrichteneingabefelds startet einen neuen Chat.

![Chat Response + Citation](docs/screenshots/kb-mode-chat-citation.png)

### Bild-Upload — Drag & Drop + Dateiauswahl (v3.1.0)

Bild-Upload-Funktionalität zum Chat-Eingabebereich hinzugefügt. Hängen Sie Bilder über die Drag & Drop-Zone und den 📎 Dateiauswahl-Button an, analysieren Sie mit der Bedrock Vision API (Claude Haiku 4.5) und integrieren Sie in den KB-Suchkontext. Unterstützt JPEG/PNG/GIF/WebP, 3MB-Limit.

![Image Upload Zone](docs/screenshots/kb-mode-image-upload-zone.png)

### Intelligentes Routing — Kostenoptimierte automatische Modellauswahl (v3.1.0)

Wenn der Schalter für intelligentes Routing in der Seitenleiste eingeschaltet ist, wählt er automatisch ein leichtgewichtiges Modell (Haiku) oder ein Hochleistungsmodell (Sonnet) basierend auf der Abfragekomplexität aus. Eine „⚡ Auto"-Option wird zum ModelSelector hinzugefügt, und Antworten zeigen den verwendeten Modellnamen zusammen mit einem „Auto"-Badge an.

![Smart Routing ON + ResponseMetadata](docs/screenshots/kb-mode-response-metadata-auto.png)

### AgentCore Memory — Sitzungsliste + Gedächtnisbereich (v3.3.0)

Aktiviert mit `enableAgentCoreMemory=true`. Fügt eine Sitzungsliste (SessionList) und eine Langzeitgedächtnisanzeige (MemorySection) zur Agent-Modus-Seitenleiste hinzu. Die Chat-Verlaufseinstellungen werden durch ein „AgentCore Memory: Enabled"-Badge ersetzt.

![AgentCore Memory Sidebar](docs/screenshots/agent-mode-agentcore-memory-sidebar.png)

## CDK-Stack-Struktur

| # | Stack | Region | Ressourcen | Beschreibung |
|---|-------|--------|------------|--------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set | WAF für CloudFront (Ratenbegrenzung, verwaltete Regeln) |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (optional) | Netzwerkinfrastruktur |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + Cognito Domain (bei aktivierter AD Federation), AD Sync Lambda (optional) | Authentifizierung und Autorisierung |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD), KMS-Verschlüsselung (optional), CloudTrail (optional) | Speicher, SID-Daten, Berechtigungscache |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (ausgewählt über `vectorStoreType`), Bedrock Guardrails (optional) | RAG-Suchinfrastruktur (Titan Embed v2) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront, Permission Filter Lambda (optional), MonitoringConstruct (optional) | Webanwendung, Agent-Verwaltung, Überwachung und Alarme |
| 7 | EmbeddingStack (optional) | ap-northeast-1 | EC2 (m5.large), ECR, ONTAP ACL automatische Abfrage (optional) | FlexCache CIFS-Mount + Embedding-Server |

### Sicherheitsfunktionen (6-Schichten-Verteidigung)

| Schicht | Technologie | Zweck |
|---------|------------|-------|
| L1: Netzwerk | CloudFront Geo Restriction | Geografische Zugriffsbeschränkung (Standard: nur Japan) |
| L2: WAF | AWS WAF (6 Regeln) | Erkennung und Blockierung von Angriffsmustern |
| L3: Origin-Authentifizierung | CloudFront OAC (SigV4) | Verhinderung des direkten Zugriffs unter Umgehung von CloudFront |
| L4: API-Authentifizierung | Lambda Function URL IAM Auth | Zugriffskontrolle über IAM-Authentifizierung |
| L5: Benutzerauthentifizierung | Cognito JWT / SAML Federation | Authentifizierung und Autorisierung auf Benutzerebene |
| L6: Datenautorisierung | SID Filtering | Zugriffskontrolle auf Dokumentenebene |

## Voraussetzungen

- AWS-Konto (mit AdministratorAccess-äquivalenten Berechtigungen)
- Node.js 22+, npm
- Docker (Colima, Docker Desktop oder docker.io auf EC2)
- CDK initialisiert (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **Hinweis**: Builds können lokal (macOS / Linux) oder auf EC2 ausgeführt werden. Für Apple Silicon (M1/M2/M3) verwendet `pre-deploy-setup.sh` automatisch den Pre-Build-Modus (lokaler Next.js-Build + Docker-Packaging), um x86_64 Lambda-kompatible Images zu erzeugen. Auf EC2 (x86_64) wird ein vollständiger Docker-Build durchgeführt.

## Bereitstellungsschritte

### Schritt 1: Umgebungseinrichtung

Kann lokal (macOS / Linux) oder auf EC2 ausgeführt werden.

#### Lokal (macOS)

```bash
# Node.js 22+ (Homebrew)
brew install node@22

# Docker (eines von beiden)
brew install --cask docker          # Docker Desktop (erfordert sudo)
brew install docker colima          # Colima (kein sudo erforderlich, empfohlen)
colima start --cpu 4 --memory 8     # Colima starten

# AWS CDK
npm install -g aws-cdk typescript ts-node
```

#### EC2 (Ubuntu 22.04)

```bash
# Starten Sie eine t3.large in einem öffentlichen Subnetz (mit SSM-fähiger IAM-Rolle)
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

Die Sicherheitsgruppe benötigt nur ausgehenden Port 443 (HTTPS), damit SSM Session Manager funktioniert. Keine eingehenden Regeln erforderlich.

### Schritt 2: Tool-Installation (für EC2)

Nach der Verbindung über SSM Session Manager führen Sie Folgendes aus.

```bash
# Systemaktualisierung + Basistools
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker aktivieren
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK (global)
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ Hinweise zur CDK CLI-Version

Die über `npm install -g aws-cdk` installierte CDK CLI-Version ist möglicherweise nicht mit dem `aws-cdk-lib` des Projekts kompatibel.

```bash
# So überprüfen Sie
cdk --version          # Globale CLI-Version
npx cdk --version      # Projektlokale CLI-Version
```

Dieses Projekt verwendet `aws-cdk-lib@2.244.0`. Wenn die CLI-Version veraltet ist, sehen Sie folgenden Fehler:

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**Lösung**: Aktualisieren Sie die projektlokale CDK CLI auf die neueste Version.

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # Aktualisierte Version überprüfen
```

> **Wichtig**: Verwenden Sie `npx cdk` statt `cdk`, um sicherzustellen, dass die neueste projektlokale CLI verwendet wird.

### Schritt 3: Repository klonen und Abhängigkeiten installieren

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Schritt 4: CDK Bootstrap (nur beim ersten Mal)

Führen Sie dies aus, wenn CDK Bootstrap in den Zielregionen noch nicht ausgeführt wurde. Da der WAF-Stack in us-east-1 bereitgestellt wird, ist Bootstrap in beiden Regionen erforderlich.

```bash
# ap-northeast-1 (Hauptregion)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1 (für WAF-Stack)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> **Bei Bereitstellung in einem anderen AWS-Konto**: Löschen Sie den AZ-Cache (`availability-zones:account=...`) aus `cdk.context.json`. CDK ruft automatisch AZ-Informationen für das neue Konto ab.

### Schritt 5: CDK-Kontextkonfiguration

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Active Directory-Integration (optional)

Um den FSx ONTAP SVM einer Active Directory-Domäne beizutreten und NTFS ACL (SID-basiert) mit CIFS-Freigaben zu verwenden, fügen Sie Folgendes zu `cdk.context.json` hinzu.

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `adPassword` | string | Nicht gesetzt (kein AD erstellt) | AWS Managed Microsoft AD-Administratorpasswort. Bei Festlegung wird AD erstellt und SVM der Domäne beigetreten |
| `adDomainName` | string | `demo.local` | AD-Domänenname (FQDN) |

> **Hinweis**: Die AD-Erstellung dauert zusätzlich 20-30 Minuten. SID-Filterungsdemos sind ohne AD möglich (verifiziert mit DynamoDB SID-Daten).

#### AD SAML Federation (optional)

Sie können SAML-Federation aktivieren, damit sich AD-Benutzer direkt über die CloudFront-Oberfläche anmelden können, mit automatischer Cognito-Benutzererstellung + automatischer DynamoDB SID-Datenregistrierung.

**Architekturübersicht:**

```
AD User → CloudFront UI → "Sign in with AD" button
  → Cognito Hosted UI → SAML IdP (AD) → AD Authentication
  → Automatic Cognito User Creation
  → Post-Auth Trigger → AD Sync Lambda → DynamoDB SID Data Registration
  → OAuth Callback → Session Cookie → Chat Screen
```

**CDK-Parameter:**

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `enableAdFederation` | boolean | `false` | SAML-Federation-Aktivierungsflag |
| `cloudFrontUrl` | string | Nicht gesetzt | CloudFront-URL für OAuth-Callback-URL (z.B. `https://d3xxxxx.cloudfront.net`) |
| `samlMetadataUrl` | string | Nicht gesetzt | Für selbstverwaltetes AD: Entra ID Federation-Metadaten-URL |
| `adEc2InstanceId` | string | Nicht gesetzt | Für selbstverwaltetes AD: EC2-Instanz-ID |

**Verwaltetes AD-Muster:**

Bei Verwendung von AWS Managed Microsoft AD.

> **⚠️ IAM Identity Center (ehemals AWS SSO) Konfiguration ist erforderlich:**
> Um die verwaltete AD SAML-Metadaten-URL (`portal.sso.{region}.amazonaws.com/saml/metadata/{directoryId}`) zu verwenden, müssen Sie AWS IAM Identity Center aktivieren, das verwaltete AD als Identitätsquelle konfigurieren und eine SAML-Anwendung erstellen. Das bloße Erstellen eines verwalteten AD stellt keinen SAML-Metadaten-Endpunkt bereit.
>
> Wenn die Konfiguration von IAM Identity Center schwierig ist, können Sie auch direkt eine externe IdP (AD FS usw.) Metadaten-URL über den Parameter `samlMetadataUrl` angeben.

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net",
  // Optional: Bei Verwendung einer SAML-Metadaten-URL außer IAM Identity Center
  // "samlMetadataUrl": "https://your-adfs-server/federationmetadata/2007-06/federationmetadata.xml"
}
```

Einrichtungsschritte:
1. `adPassword` festlegen und CDK bereitstellen (erstellt verwaltetes AD + SAML IdP + Cognito Domain)
2. AWS IAM Identity Center aktivieren und verwaltetes AD als Identitätsquelle konfigurieren
3. SAML-Anwendung für Cognito User Pool in IAM Identity Center erstellen (oder externen IdP über `samlMetadataUrl` angeben)
4. Nach der Bereitstellung die CloudFront-URL in `cloudFrontUrl` festlegen und erneut bereitstellen
5. AD-Authentifizierung über den „Sign in with AD"-Button auf der CloudFront-Oberfläche ausführen

**Selbstverwaltetes AD-Muster (auf EC2, mit Entra Connect-Integration):**

Integriert AD auf EC2 mit Entra ID (ehemals Azure AD) und verwendet die Entra ID Federation-Metadaten-URL.

```json
{
  "enableAdFederation": true,
  "adEc2InstanceId": "i-0123456789abcdef0",
  "samlMetadataUrl": "https://login.microsoftonline.com/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net"
}
```

Einrichtungsschritte:
1. AD DS auf EC2 installieren und Synchronisierung mit Entra Connect konfigurieren
2. Entra ID Federation-Metadaten-URL abrufen
3. Die obigen Parameter festlegen und CDK bereitstellen
4. AD-Authentifizierung über den „Sign in with AD"-Button auf der CloudFront-Oberfläche ausführen

**Mustervergleich:**

| Element | Verwaltetes AD | Selbstverwaltetes AD |
|---------|---------------|---------------------|
| SAML-Metadaten | Über IAM Identity Center oder `samlMetadataUrl`-Angabe | Entra ID Metadaten-URL (`samlMetadataUrl`-Angabe) |
| SID-Abrufmethode | LDAP oder über SSM | SSM → EC2 → PowerShell |
| Erforderliche Parameter | `adPassword`, `cloudFrontUrl` + IAM Identity Center-Einrichtung (oder `samlMetadataUrl`) | `adEc2InstanceId`, `samlMetadataUrl`, `cloudFrontUrl` |
| AD-Verwaltung | AWS-verwaltet | Benutzerverwaltung |
| Kosten | Verwaltete AD-Preise | EC2-Instanzpreise |

**Fehlerbehebung:**

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| SAML-Authentifizierungsfehler | Ungültige SAML IdP-Metadaten-URL | Verwaltetes AD: IAM Identity Center-Konfiguration prüfen oder direkt über `samlMetadataUrl` angeben. Selbstverwaltet: Entra ID Metadaten-URL überprüfen |
| OAuth-Callback-Fehler | `cloudFrontUrl` nicht gesetzt oder nicht übereinstimmend | Überprüfen, ob `cloudFrontUrl` im CDK-Kontext mit der CloudFront Distribution-URL übereinstimmt |
| Post-Auth Trigger-Fehler | AD Sync Lambda unzureichende Berechtigungen | Fehlerdetails in CloudWatch Logs prüfen. Die Anmeldung selbst wird nicht blockiert |
| S3-Zugriffsfehler bei KB-Suche | KB IAM-Rolle fehlen direkte S3-Bucket-Zugriffsberechtigungen | KB IAM-Rolle hat nur Berechtigungen über S3 Access Point. Bei direkter Verwendung des S3-Buckets als Datenquelle müssen `s3:GetObject`- und `s3:ListBucket`-Berechtigungen hinzugefügt werden (nicht spezifisch für AD Federation) |
| Cognito Domain-Erstellungsfehler | Domänenpräfix-Konflikt | Prüfen, ob das Präfix `{projectName}-{environment}-auth` mit anderen Konten in Konflikt steht |

#### Enterprise-Funktionen (optional)

Die folgenden CDK-Kontextparameter aktivieren Sicherheitsverbesserungs- und Architekturvereinheitlichungsfunktionen.

```json
{
  "useS3AccessPoint": "true",
  "usePermissionFilterLambda": "true",
  "enableGuardrails": "true",
  "enableKmsEncryption": "true",
  "enableCloudTrail": "true",
  "enableVpcEndpoints": "true"
}
```

| Parameter | Standard | Beschreibung |
|-----------|----------|--------------|
| `ontapMgmtIp` | (keiner) | ONTAP-Management-IP. Bei Festlegung generiert der Embedding-Server automatisch `.metadata.json` aus der ONTAP REST API |
| `ontapSvmUuid` | (keiner) | SVM UUID (verwendet mit `ontapMgmtIp`) |
| `ontapAdminSecretArn` | (keiner) | Secrets Manager ARN für ONTAP-Administratorpasswort |
| `useS3AccessPoint` | `false` | S3 Access Point als Bedrock KB-Datenquelle verwenden |
| `usePermissionFilterLambda` | `false` | SID-Filterung über dediziertes Lambda ausführen (mit Inline-Filterungs-Fallback) |
| `enableGuardrails` | `false` | Bedrock Guardrails (Schädlicher-Inhalt-Filter + PII-Schutz) |
| `enableAgent` | `false` | Bedrock Agent + Berechtigungsbewusste Action Group (KB-Suche + SID-Filterung). Dynamische Agent-Erstellung (erstellt und bindet automatisch kategoriespezifische Agents bei Kartenklick) |
| `enableAgentSharing` | `false` | Agent-Konfigurationsfreigabe S3-Bucket. JSON-Export/Import von Agent-Konfigurationen, organisationsweite Freigabe über S3 |
| `enableAgentSchedules` | `false` | Agent-Planungsausführungsinfrastruktur (EventBridge Scheduler + Lambda + DynamoDB-Ausführungshistorientabelle) |
| `enableKmsEncryption` | `false` | KMS CMK-Verschlüsselung für S3 und DynamoDB (Schlüsselrotation aktiviert) |
| `enableCloudTrail` | `false` | CloudTrail-Auditprotokolle (S3-Datenzugriff + Lambda-Aufrufe, 90-Tage-Aufbewahrung) |
| `enableVpcEndpoints` | `false` | VPC Endpoints (S3, DynamoDB, Bedrock, SSM, Secrets Manager, CloudWatch Logs) |
| `enableMonitoring` | `false` | CloudWatch-Dashboard + SNS-Alarme + EventBridge KB Ingestion-Überwachung. Kosten: Dashboard 3$/Monat + Alarme 0,10$/Alarm/Monat |
| `monitoringEmail` | *(keiner)* | E-Mail-Adresse für Alarmbenachrichtigungen (wirksam bei `enableMonitoring=true`) |
| `enableAgentCoreMemory` | `false` | AgentCore Memory aktivieren (Kurzzeit- und Langzeitgedächtnis). Erfordert `enableAgent=true` |
| `enableAgentCoreObservability` | `false` | AgentCore Runtime-Metriken in Dashboard integrieren (wirksam bei `enableMonitoring=true`) |
| `alarmEvaluationPeriods` | `1` | Anzahl der Alarm-Auswertungsperioden (Alarm wird nach N aufeinanderfolgenden Schwellenwertüberschreitungen ausgelöst) |
| `dashboardRefreshInterval` | `300` | Dashboard-Auto-Aktualisierungsintervall (Sekunden) |

#### Vektorspeicher-Konfigurationsauswahl

Wechseln Sie den Vektorspeicher mit dem Parameter `vectorStoreType`. Standard ist S3 Vectors (kostengünstig).

| Konfiguration | Kosten | Latenz | Empfohlene Verwendung |
|--------------|--------|--------|----------------------|
| `s3vectors` (Standard) | Wenige Dollar/Monat | Unter einer Sekunde bis 100ms | Demo, Entwicklung, Kostenoptimierung |

#### Verwendung eines vorhandenen FSx for ONTAP

Wenn bereits ein FSx for ONTAP-Dateisystem vorhanden ist, können Sie vorhandene Ressourcen referenzieren, anstatt neue zu erstellen. Dies verkürzt die Bereitstellungszeit erheblich (eliminiert die 30-40-minütige Wartezeit für die FSx ONTAP-Erstellung).

```bash
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c existingFileSystemId=fs-0123456789abcdef0 \
  -c existingSvmId=svm-0123456789abcdef0 \
  -c existingVolumeId=fsvol-0123456789abcdef0 \
  -c vectorStoreType=s3vectors \
  -c enableAgent=true
```

| Parameter | Beschreibung |
|-----------|--------------|
| `existingFileSystemId` | Vorhandene FSx ONTAP-Dateisystem-ID (z.B. `fs-0123456789abcdef0`) |
| `existingSvmId` | Vorhandene SVM-ID (z.B. `svm-0123456789abcdef0`) |
| `existingVolumeId` | Vorhandene Volume-ID (z.B. `fsvol-0123456789abcdef0`) |

> **Hinweis**: Im vorhandenen FSx-Referenzmodus liegen FSx/SVM/Volume außerhalb der CDK-Verwaltung. Sie werden durch `cdk destroy` nicht gelöscht. Verwaltetes AD wird ebenfalls nicht erstellt (verwendet die AD-Einstellungen der vorhandenen Umgebung).

| Konfiguration | Kosten | Latenz | Empfohlene Verwendung | Metadaten-Einschränkungen |
|--------------|--------|--------|----------------------|--------------------------|
| `s3vectors` (Standard) | Wenige Dollar/Monat | Unter einer Sekunde bis 100ms | Demo, Entwicklung, Kostenoptimierung | Filterbares 2KB-Limit (siehe unten) |
| `opensearch-serverless` | ~700$/Monat | ~10ms | Hochleistungs-Produktionsumgebungen | Keine Einschränkungen |

```bash
# S3 Vectors-Konfiguration (Standard)
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=s3vectors

# OpenSearch Serverless-Konfiguration
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=opensearch-serverless
```

Wenn bei Verwendung der S3 Vectors-Konfiguration hohe Leistung benötigt wird, können Sie bei Bedarf mit `demo-data/scripts/export-to-opensearch.sh` nach OpenSearch Serverless exportieren. Details finden Sie unter [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md).

### Schritt 6: Pre-Deploy-Einrichtung (ECR-Image-Vorbereitung)

Der WebApp-Stack referenziert ein Docker-Image aus einem ECR-Repository, daher muss das Image vor der CDK-Bereitstellung vorbereitet werden.

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

Dieses Skript führt automatisch Folgendes aus:
1. Erstellt ECR-Repository (`permission-aware-rag-webapp`)
2. Baut und pusht Docker-Image

Der Build-Modus wird automatisch basierend auf der Host-Architektur ausgewählt:

| Host | Build-Modus | Beschreibung |
|------|------------|--------------|
| x86_64 (EC2 usw.) | Vollständiger Docker-Build | npm install + next build im Dockerfile |
| arm64 (Apple Silicon) | Pre-Build-Modus | Lokaler next build → Docker-Packaging |

> **Benötigte Zeit**: EC2 (x86_64): 3-5 Min., Lokal (Apple Silicon): 5-8 Min., CodeBuild: 5-10 Min.

> **Hinweis für Apple Silicon**: `docker buildx` ist erforderlich (`brew install docker-buildx`). Beim Push zu ECR `--provenance=false` angeben (da Lambda das Manifest-List-Format nicht unterstützt).

### Schritt 7: CDK-Bereitstellung

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

Enterprise-Funktionen aktivieren:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableAgentSharing=true \
  -c enableAgentSchedules=true \
  --require-approval never
```

Überwachung und Alarme aktivieren:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  --require-approval never
```

> **Überwachungskostenschätzung**: CloudWatch Dashboard 3$/Monat + Alarme 0,10$/Alarm/Monat (7 Alarme = 0,70$/Monat) + SNS-Benachrichtigungen im kostenlosen Kontingent. Insgesamt ca. 4$/Monat.

> **Benötigte Zeit**: Die Erstellung von FSx for ONTAP dauert 20-30 Minuten, insgesamt also ca. 30-40 Minuten.

### Schritt 8: Post-Deploy-Einrichtung (Einzelbefehl)

Nach Abschluss der CDK-Bereitstellung wird die gesamte Einrichtung mit diesem einzelnen Befehl abgeschlossen:

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Dieses Skript führt automatisch Folgendes aus:
1. Erstellt S3 Access Point + konfiguriert Richtlinie
2. Lädt Demodaten auf FSx ONTAP hoch (über S3 AP)
3. Fügt Bedrock KB-Datenquelle hinzu + synchronisiert
4. Registriert Benutzer-SID-Daten in DynamoDB
5. Erstellt Demo-Benutzer in Cognito (admin / user)

> **Benötigte Zeit**: 2-5 Minuten (einschließlich KB-Synchronisierungswartzeit)

### Schritt 9: Bereitstellungsverifizierung (Automatisierte Tests)

Führen Sie automatisierte Testskripte aus, um alle Funktionen zu überprüfen.

```bash
bash demo-data/scripts/verify-deployment.sh
```

Testergebnisse werden automatisch in `docs/test-results.md` generiert. Überprüfungspunkte:
- Stack-Status (alle 6 Stacks CREATE/UPDATE_COMPLETE)
- Ressourcenexistenz (Lambda URL, KB, Agent)
- Anwendungsantwort (Anmeldeseite HTTP 200)
- KB-Modus Berechtigungsbewusst (admin: alle Dokumente erlaubt, user: nur öffentlich)
- Agent-Modus Berechtigungsbewusst (Action Group SID-Filterung)
- S3 Access Point (AVAILABLE)
- Enterprise Agent-Funktionen (S3 geteilter Bucket, DynamoDB-Ausführungshistorientabelle, Scheduler Lambda, Sharing/Schedules API-Antworten) *nur wenn `enableAgentSharing`/`enableAgentSchedules` aktiviert sind

### Schritt 10: Browser-Zugriff

Rufen Sie die URL aus den CloudFormation-Ausgaben ab und greifen Sie im Browser darauf zu.

```bash
aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### Ressourcenbereinigung

Verwenden Sie das Skript, das alle Ressourcen (CDK-Stacks + manuell erstellte Ressourcen) auf einmal löscht:

```bash
bash demo-data/scripts/cleanup-all.sh
```

Dieses Skript führt automatisch Folgendes aus:
1. Löscht manuell erstellte Ressourcen (S3 AP, ECR, CodeBuild)
2. Löscht Bedrock KB-Datenquellen (vor CDK destroy erforderlich)
3. Löscht dynamisch erstellte Bedrock Agents (Agents außerhalb der CDK-Verwaltung)
4. Löscht Enterprise Agent-Funktionsressourcen (EventBridge Scheduler-Zeitpläne und -Gruppen, S3 geteilter Bucket)
5. Löscht Embedding-Stack (falls vorhanden)
6. CDK destroy (alle Stacks)
7. Einzellöschung verbleibender Stacks + Löschung verwaister AD-SGs
8. Löschung nicht CDK-verwalteter EC2-Instanzen und SGs im VPC + erneute Löschung des Networking-Stacks
9. CDKToolkit + CDK-Staging-S3-Bucket-Löschung (beide Regionen, Versionierung-bewusst)

> **Hinweis**: Die Löschung von FSx ONTAP dauert 20-30 Minuten, insgesamt also ca. 30-40 Minuten.

## Fehlerbehebung

### WebApp-Stack-Erstellungsfehler (ECR-Image nicht gefunden)

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `Source image ... does not exist` | Kein Docker-Image im ECR-Repository | Führen Sie zuerst `bash demo-data/scripts/pre-deploy-setup.sh` aus |

> **Wichtig**: Führen Sie bei neuen Konten immer `pre-deploy-setup.sh` vor der CDK-Bereitstellung aus. Der WebApp-Stack referenziert das Image `permission-aware-rag-webapp:latest` in ECR.

### CDK CLI-Versionskonflikt

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `Cloud assembly schema version mismatch` | Globale CDK CLI ist veraltet | Aktualisieren Sie projektlokal mit `npm install aws-cdk@latest` und verwenden Sie `npx cdk` |

### Bereitstellungsfehler durch CloudFormation Hook

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]` | CloudFormation Hook auf Organisationsebene blockiert ChangeSet | Option `--method=direct` hinzufügen, um ChangeSet zu umgehen |

```bash
# Bereitstellung in Umgebungen mit aktiviertem CloudFormation Hook
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never

# Bootstrap verwendet auch create-stack für direkte Erstellung
aws cloudformation create-stack --stack-name CDKToolkit \
  --template-body file://cdk-bootstrap-template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

### Docker-Berechtigungsfehler

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `permission denied while trying to connect to the Docker daemon` | Benutzer nicht in der Docker-Gruppe | `sudo usermod -aG docker ubuntu && newgrp docker` |

### AgentCore Memory-Bereitstellungsfehler

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `EarlyValidation::PropertyValidation` | CfnMemory-Eigenschaften entsprechen nicht dem Schema | Bindestriche in Name nicht erlaubt (durch `_` ersetzen), EventExpiryDuration in Tagen (min:3, max:365) |
| `Please provide a role with a valid trust policy` | Ungültiger Service-Principal für Memory IAM-Rolle | Verwenden Sie `bedrock-agentcore.amazonaws.com` (nicht `bedrock.amazonaws.com`) |
| `actorId failed to satisfy constraint` | actorId enthält `@` `.` aus E-Mail-Adresse | Bereits in `lib/agentcore/auth.ts` behandelt: `@` → `_at_`, `.` → `_dot_` |
| `AccessDeniedException: bedrock-agentcore:CreateEvent` | Lambda-Ausführungsrolle fehlen AgentCore-Berechtigungen | Wird automatisch beim CDK-Deploy mit `enableAgentCoreMemory=true` hinzugefügt |
| `exec format error` (Lambda-Startfehler) | Docker-Image-Architektur stimmt nicht mit Lambda überein | Lambda ist x86_64. Auf Apple Silicon `docker buildx` + `--platform linux/amd64` verwenden |

## WAF- und Geo-Restriction-Konfiguration

### WAF-Regelkonfiguration

Die CloudFront WAF wird in `us-east-1` bereitgestellt und besteht aus 6 Regeln (in Prioritätsreihenfolge ausgewertet).

| Priorität | Regelname | Typ | Beschreibung |
|-----------|-----------|-----|--------------|
| 100 | RateLimit | Benutzerdefiniert | Blockiert, wenn eine einzelne IP-Adresse 3000 Anfragen in 5 Minuten überschreitet |
| 200 | AWSIPReputationList | AWS-verwaltet | Blockiert bösartige IP-Adressen wie Botnets und DDoS-Quellen |
| 300 | AWSCommonRuleSet | AWS-verwaltet | OWASP Top 10-konforme allgemeine Regeln (XSS, LFI, RFI usw.). `GenericRFI_BODY`, `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` für RAG-Anfragenkompatibilität ausgeschlossen |
| 400 | AWSKnownBadInputs | AWS-verwaltet | Blockiert Anfragen, die bekannte Schwachstellen wie Log4j (CVE-2021-44228) ausnutzen |
| 500 | AWSSQLiRuleSet | AWS-verwaltet | Erkennt und blockiert SQL-Injection-Angriffsmuster |
| 600 | IPAllowList | Benutzerdefiniert (optional) | Nur aktiv, wenn `allowedIps` konfiguriert ist. Blockiert IPs, die nicht auf der Liste stehen |

### Konfiguration der Embedding-Zieldokumente

Die in Bedrock KB eingebetteten Dokumente werden durch die Dateistruktur auf dem FSx ONTAP-Volume bestimmt.

#### Verzeichnisstruktur und SID-Metadaten

```
FSx ONTAP Volume (/data)
  ├── public/                          ← Für alle Benutzer zugänglich
  │   ├── product-catalog.md           ← Dokumentkörper
  │   └── product-catalog.md.metadata.json  ← SID-Metadaten
  ├── confidential/                    ← Nur Administratoren
  │   ├── financial-report.md
  │   └── financial-report.md.metadata.json
  └── restricted/                      ← Nur bestimmte Gruppen
      ├── project-plan.md
      └── project-plan.md.metadata.json
```

#### .metadata.json-Format

Legen Sie die SID-basierte Zugriffskontrolle in der `.metadata.json`-Datei fest, die jedem Dokument entspricht.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public",
    "doc_type": "catalog"
  }
}
```

| Feld | Erforderlich | Beschreibung |
|------|-------------|--------------|
| `allowed_group_sids` | ✅ | JSON-Array-String der zugelassenen SIDs. `S-1-1-0` ist Everyone |
| `access_level` | Optional | Zugriffsebene für UI-Anzeige (`public`, `confidential`, `restricted`) |
| `doc_type` | Optional | Dokumenttyp (für zukünftige Filterung) |

#### Wichtige SID-Werte

| SID | Name | Verwendung |
|-----|------|------------|
| `S-1-1-0` | Everyone | Dokumente, die allen Benutzern veröffentlicht werden |
| `S-1-5-21-...-512` | Domain Admins | Dokumente, die nur Administratoren zugänglich sind |
| `S-1-5-21-...-1100` | Engineering | Dokumente für die Engineering-Gruppe |

> **Details**: Siehe [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) für den SID-Filterungsmechanismus.

#### S3 Vectors Metadaten-Einschränkungen und Überlegungen

Bei Verwendung der S3 Vectors-Konfiguration (`vectorStoreType=s3vectors`) beachten Sie die folgenden Metadaten-Einschränkungen.

| Einschränkung | Wert | Auswirkung |
|--------------|------|------------|
| Filterbare Metadaten | 2KB/Vektor | Einschließlich Bedrock KB interner Metadaten (~1KB) sind benutzerdefinierte Metadaten effektiv **1KB oder weniger** |
| Nicht-filterbare Metadatenschlüssel | Max 10 Schlüssel/Index | Erreicht das Limit mit Bedrock KB Auto-Schlüsseln (5) + benutzerdefinierten Schlüsseln (5) |
| Gesamte Metadaten | 40KB/Vektor | Normalerweise kein Problem |

### Auswahl des Datenaufnahmepfads

| Pfad | Methode | CDK-Aktivierung | Status |
|------|---------|-----------------|--------|
| Haupt | FSx ONTAP → S3 Access Point → Bedrock KB → Vector Store | `post-deploy-setup.sh` nach CDK-Deploy ausführen | ✅ |
| Fallback | Direkter S3-Bucket-Upload → Bedrock KB → Vector Store | Manuell (`upload-demo-data.sh`) | ✅ |
| Alternativ (optional) | Embedding-Server (CIFS-Mount) → Direktes AOSS-Schreiben | `-c enableEmbeddingServer=true` | ✅ (nur AOSS-Konfiguration) |

> **Fallback-Pfad**: Wenn FSx ONTAP S3 AP nicht verfügbar ist (z.B. Organization SCP-Einschränkungen), können Sie Dokumente + `.metadata.json` direkt in einen S3-Bucket hochladen und als KB-Datenquelle konfigurieren. Die SID-Filterung hängt nicht vom Datenquellentyp ab.

### Manuelle Verwaltung von Embedding-Zieldokumenten

Sie können Embedding-Zieldokumente ohne CDK-Bereitstellung hinzufügen, ändern und löschen.

#### Dokumente hinzufügen

Über FSx ONTAP S3 Access Point (Hauptpfad):

```bash
# Dateien auf FSx ONTAP über SMB von EC2 oder WorkSpaces im VPC platzieren
SVM_IP=<SVM_SMB_IP>
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put new-document.md; put new-document.md.metadata.json"

# KB-Synchronisierung ausführen (nach dem Hinzufügen von Dokumenten erforderlich)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

Direkter S3-Bucket-Upload (Fallback-Pfad):

```bash
# Dokumente + Metadaten in S3-Bucket hochladen
aws s3 cp new-document.md s3://<DATA_BUCKET>/public/new-document.md
aws s3 cp new-document.md.metadata.json s3://<DATA_BUCKET>/public/new-document.md.metadata.json

# KB-Synchronisierung
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Dokumente aktualisieren

Nach dem Überschreiben eines Dokuments führen Sie die KB-Synchronisierung erneut aus. Bedrock KB erkennt automatisch geänderte Dokumente und bettet sie erneut ein.

```bash
# Dokument über SMB überschreiben
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put updated-document.md product-catalog.md"

# KB-Synchronisierung (Änderungserkennung + erneutes Embedding)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Dokumente löschen

```bash
# Dokument über SMB löschen
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; del old-document.md; del old-document.md.metadata.json"

# KB-Synchronisierung (Löschungserkennung + Entfernung aus dem Vektorspeicher)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### SID-Metadaten ändern (Zugriffsberechtigungsänderungen)

Um die Zugriffsberechtigungen eines Dokuments zu ändern, aktualisieren Sie die `.metadata.json` und führen Sie die KB-Synchronisierung aus.

```bash
# Beispiel: Ein öffentliches Dokument in vertraulich ändern
cat > financial-report.md.metadata.json << 'EOF'
{"metadataAttributes":{"allowed_group_sids":"[\"S-1-5-21-...-512\"]","access_level":"confidential","doc_type":"financial"}}
EOF

smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd confidential; put financial-report.md.metadata.json"

# KB-Synchronisierung
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

> **Hinweis**: Führen Sie nach dem Hinzufügen, Aktualisieren oder Löschen von Dokumenten immer die KB-Synchronisierung aus. Änderungen werden ohne Synchronisierung nicht im Vektorspeicher reflektiert. Die Synchronisierung dauert normalerweise 30 Sekunden bis 2 Minuten.

## Funktionsweise des berechtigungsbewussten RAG

### Verarbeitungsablauf (2-Stufen-Methode: Retrieve + Converse)

```
User              Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ 1.Frage senden   │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ 2.Benutzer-SIDs    │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ 3.Retrieve API (Vektorsuche + Metadaten)               │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ Suchergebnisse + Metadaten (SID)     │                │
  │                  │                    │                  │                │
  │                  │ 4.SID-Abgleich     │                  │                │
  │                  │ Benutzer-SID ∩     │                  │                │
  │                  │ Dokument-SID       │                  │                │
  │                  │                    │                  │                │
  │                  │ 5.Antwort nur mit erlaubten Dokumenten generieren      │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ 6.Gefiltertes    │                    │                  │                │
  │   Ergebnis       │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

1. Benutzer sendet eine Frage über den Chat
2. Ruft die SID-Liste des Benutzers (persönliche SID + Gruppen-SIDs) aus der DynamoDB `user-access`-Tabelle ab
3. Bedrock KB Retrieve API führt Vektorsuche durch, um relevante Dokumente abzurufen (Metadaten enthalten SID-Informationen)
4. Gleicht die `allowed_group_sids` jedes Dokuments mit der SID-Liste des Benutzers ab, nur übereinstimmende Dokumente werden zugelassen
5. Generiert eine Antwort über die Converse API unter Verwendung nur der Dokumente, auf die der Benutzer Zugriff hat, als Kontext
6. Zeigt die gefilterte Antwort und Zitationsinformationen an

## Technologie-Stack

| Schicht | Technologie |
|---------|------------|
| IaC | AWS CDK v2 (TypeScript) |
| Frontend | Next.js 15 + React 18 + Tailwind CSS |
| Auth | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + S3 Vectors / OpenSearch Serverless |
| Embedding | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024 dimensions) |
| Speicher | Amazon FSx for NetApp ONTAP + S3 |
| Compute | Lambda Web Adapter + CloudFront |
| Berechtigungen | DynamoDB (user-access: SID data, perm-cache: permission cache) |
| Sicherheit | AWS WAF + IAM Auth + OAC + Geo Restriction |

## Verifizierungsszenarien

Siehe [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) für Verfahren zur Verifizierung der Berechtigungsfilterung.

Wenn zwei Benutzertypen (Administrator und normaler Benutzer) dieselbe Frage stellen, können Sie bestätigen, dass basierend auf den Zugriffsberechtigungen unterschiedliche Suchergebnisse zurückgegeben werden.

## Dokumentationsliste

| Dokument | Inhalt |
|----------|--------|
| [docs/implementation-overview.md](docs/implementation-overview.md) | Detaillierte Implementierungsbeschreibung (8 Perspektiven) |
| [docs/ui-specification.md](docs/ui-specification.md) | UI-Spezifikation (KB/Agent-Moduswechsel, Agent-Verzeichnis, Seitenleisten-Design, Zitationsanzeige) |
| [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) | Details zur SID-basierten Berechtigungsfilterungsarchitektur |
| [docs/embedding-server-design.md](docs/embedding-server-design.md) | Embedding-Server-Design (einschließlich automatischer ONTAP ACL-Abfrage) |
| [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md) | CDK-Stack-Architekturleitfaden (Vektorspeichervergleich, Implementierungseinblicke) |
| [docs/verification-report.md](docs/verification-report.md) | Post-Deployment-Verifizierungsverfahren und Testfälle |
| [docs/demo-recording-guide.md](docs/demo-recording-guide.md) | Verifizierungs-Demo-Videoaufnahmeleitfaden (6 Beweisstücke) |
| [docs/demo-environment-guide.md](docs/demo-environment-guide.md) | Leitfaden zur Einrichtung der Verifizierungsumgebung |
| [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) | Dokumentationsindex (empfohlene Lesereihenfolge) |
| [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) | Verifizierungsszenarien (Bestätigung des Berechtigungsunterschieds Admin vs. normaler Benutzer) |
| [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD-Integration, CIFS-Freigabe, NTFS ACL-Konfiguration |

## FSx ONTAP + Active Directory-Einrichtung

Siehe [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) für FSx ONTAP AD-Integration, CIFS-Freigabe und NTFS ACL-Konfigurationsverfahren.

Die CDK-Bereitstellung erstellt AWS Managed Microsoft AD und FSx ONTAP (SVM + Volume). Der SVM AD-Domänenbeitritt wird nach der Bereitstellung über CLI ausgeführt (zur Timing-Kontrolle).

```bash
# AD DNS-IPs abrufen
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# SVM dem AD beitreten
# Hinweis: Für AWS Managed AD muss OrganizationalUnitDistinguishedName angegeben werden
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins",
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1
```

> **Wichtig**: Für AWS Managed AD wird der SVM AD-Beitritt `MISCONFIGURED`, wenn `OrganizationalUnitDistinguishedName` nicht angegeben wird. Das OU-Pfadformat ist `OU=Computers,OU=<AD ShortName>,DC=<domain>,DC=<tld>`.

Designentscheidungen für S3 Access Point (WINDOWS-Benutzertyp, Internetzugang) sind ebenfalls im Leitfaden dokumentiert.

## Lizenz

[Apache License 2.0](LICENSE)
