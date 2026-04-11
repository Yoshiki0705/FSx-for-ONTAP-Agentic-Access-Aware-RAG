# Verifizierungsszenario-Leitfaden

## Übersicht

Verifizierungsverfahren für das Permission-aware RAG-System. SID-basierte Berechtigungsfilterung stellt sicher, dass verschiedene Benutzer bei derselben Frage unterschiedliche Suchergebnisse erhalten.

---

## Szenario 4: OIDC + LDAP Federation Verifizierung

> **Voraussetzungen**: CDK mit `oidcProviderConfig` + `ldapConfig` bereitgestellt. OpenLDAP-Server im VPC aktiv.

### 4-1. OpenLDAP-Einrichtung

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP-Testbenutzer

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Überprüfungspunkte

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Überprüfungsskripte

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Überlegungen zur OpenLDAP-Einrichtung

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Siehe [Authentifizierungsmodus-Einrichtungsanleitung](de/auth-mode-setup-guide.md).


---

## 5. Multi-Agent-Kollaboration Demo

### Voraussetzungen

Deployment mit `enableMultiAgent: true` in `cdk.context.json`.

### 5-1. Multi-Agent-Modus aktivieren

1. Klicken Sie auf den **[Multi Agent]**-Umschalter im Chat-Header
2. Wählen Sie den Supervisor Agent aus dem **[Agent Select]**-Dropdown im Header
3. Eine neue Multi-Agent-Sitzung wird automatisch erstellt

### 5-2. Berechtigungsgefilterte Multi-Agent-Suche

Melden Sie sich als **admin** an und stellen Sie eine Frage. Überprüfen Sie die Agent Trace UI für Timeline und Kostenaufschlüsselung. Melden Sie sich dann als **user** an und vergleichen Sie die Ergebnisse.

### 5-3. Single Agent vs Multi-Agent Vergleich

1. Frage im **Single-Modus** senden → Antwortzeit und Kosten notieren
2. In den **Multi-Modus** wechseln → gleiche Frage senden → vergleichen

### 5-4. Hinweise zur Bereitstellung

- **CloudFormation `AgentCollaboration` gültige Werte**: `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` nur. `COLLABORATOR` ist ungültig
- **2-Stufen-Bereitstellung**: Supervisor Agent mit `DISABLED` erstellen, dann Custom Resource Lambda: `UpdateAgent` → `SUPERVISOR_ROUTER`, `AssociateAgentCollaborator`, `PrepareAgent`
- **IAM-Berechtigungen**: Supervisor-Rolle benötigt `bedrock:GetAgentAlias` + `bedrock:InvokeAgent` auf `agent-alias/*/*`. Custom Resource Lambda benötigt `iam:PassRole`
- **Collaborator Aliases**: Jeder Collaborator Agent benötigt `CfnAgentAlias` vor Supervisor-Referenz
- **autoPrepare=true nicht erlaubt**: Kann nicht für Supervisor Agent verwendet werden

### 5-5. Betriebserkenntnisse

- **Team-Liste abrufen**: Der Multi-Modus-Umschalter auf der Chat-Seite ruft die Team-Liste beim Laden über die API ab und prüft `teams.length > 0`. Der Multi-Modus ist deaktiviert, wenn keine Teams vorhanden sind (beabsichtigtes Verhalten)
- **Direkte Supervisor-Auswahl**: Die Auswahl des Supervisor Agents aus dem Dropdown und der Aufruf im Single-Agent-Modus löst dennoch die Multi-Agent-Kollaboration auf der Bedrock-Seite aus (Supervisor → Collaborator Ausführungsfluss funktioniert)
- **Berechtigungsfilterung**: Supervisor-Agent-Antworten enthalten berechtigungsgefilterte Zitate (Admin-Benutzer können vertrauliche Dokumente sehen, normale Benutzer nur öffentliche)
- **Docker-Image-Aktualisierung**: Nach Codeänderungen sind 3 Schritte erforderlich: `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` (CDK erkennt Änderungen am `latest`-Tag nicht)
- **Multi-Modus-Integration**: Multi-Modus-Umschalter → `/api/bedrock/agent-team/invoke` Aufruf → Antwort mit `multiAgentTrace` → bedingte Darstellung von MultiAgentTraceTimeline + CostSummary funktioniert bestätigt
- **Collaborator-Traces**: `buildCollaboratorTraces` extrahiert Collaborator-Ausführungsinformationen aus Bedrock Agent InvokeAgent API Trace-Events, aber interne Collaborator-Aufrufe des Supervisors erscheinen möglicherweise nicht immer in Traces (Bedrock-seitige Einschränkung). Antworten werden unabhängig davon normal zurückgegeben
- **routingClassifierTrace**: Im `SUPERVISOR_ROUTER`-Modus erscheinen Collaborator-Traces in `routingClassifierTrace` (nicht `orchestrationTrace`) als `agentCollaboratorInvocationInput/Output`
- **filteredSearch SID-Auto-Auflösung**: Die filteredSearch Lambda löst SID-Informationen automatisch aus der DynamoDB User Access Table über `sessionAttributes.userId` auf. Berechtigungsfilterung funktioniert auch ohne explizite SID-Parameter
- **KB-Metadaten-Anführungszeichen**: Bedrock KB `allowed_group_sids` kann zusätzliche Anführungszeichen enthalten. Die `cleanSID`-Funktion entfernt diese für korrektes SID-Matching
- **Agent-Instruction i18n**: CDK `agentLanguage`-Eigenschaft (Standard: `'auto'`) ermöglicht englischbasierte Instruktionen mit automatischer Anpassung der Antwortsprache an die Benutzersprache
- **E2E-Verifizierung**: Admin-Benutzer im Multi-Modus → Produktkatalog-Abfrage → FSx for ONTAP-Inhalte mit Berechtigungsfilterung zurückgegeben. RetrievalAgent-Detailpanel und CostSummary korrekt angezeigt
