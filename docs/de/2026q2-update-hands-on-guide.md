# Praxisleitfaden zur AI-Aktualisierung 2026 Q2

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | [한국어](../ko/2026q2-update-hands-on-guide.md) | [简体中文](../zh-CN/2026q2-update-hands-on-guide.md) | [繁體中文](../zh-TW/2026q2-update-hands-on-guide.md) | [Français](../fr/2026q2-update-hands-on-guide.md) | **Deutsch** | [Español](../es/2026q2-update-hands-on-guide.md)

**Erstellt**: 2026-06-07  
**Dauer**: etwa 60 Minuten  
**Zielgruppe**: Entwickler und Partner, die die neuen Funktionen ausprobieren wollen

---

## Überblick

Ein Praxisleitfaden zu den Funktionen aus der AI-Aktualisierung 2026 Q2 (Phasen 0 bis 5). Sie aktivieren sie einzeln auf einem bestehenden Deployment und prüfen jeweils das Ergebnis.

---

## Voraussetzungen

- eine bereits deployte Permission-aware-RAG-Umgebung
- konfigurierte AWS CLI
- Node.js 22+, npm

---

## Schritt 1: Modellaktualisierung prüfen (5 Min.)

Prüfen Sie, dass jede Stufe (leicht, Standard, leistungsstark) auf das neueste Modell der Region aufgelöst wird. Ein Modell, das in begrenzten Regionen verarbeitet wird (etwa `jp.`), hat Vorrang vor einem neueren Modell mit nur einem `global.`-Profil. Modelle sind keine festen Werte: Sie werden zur Laufzeit aus den Bedrock-APIs bestimmt (`ListFoundationModels` und `ListInferenceProfiles`, siehe `docker/nextjs/src/lib/model-catalog`).

```text
# Öffnen Sie diese URL in einem angemeldeten Browser und sehen Sie sich data.tiers an
https://<CloudFront-Domäne>/api/bedrock/models
# Beispiel (aus der Aufzeichnung für ap-northeast-1 vom 2026-11-15):
# "light": "jp.anthropic.claude-haiku-5-5"
# "standard": "jp.anthropic.claude-sonnet-4-6"
```

Senden Sie eine Anfrage über die Chat-Oberfläche und prüfen Sie, dass `modelId` in den Antwortmetadaten das neue Modell nennt.

---

## Schritt 2: Wirkung des Prompt-Caches prüfen (10 Min.)

> **Voraussetzung**: Prompt-Caching funktioniert nur mit **Anthropic-Claude-Modellen**. Standardmäßig (kein Modell gewählt) wird die Standardstufe verwendet, die auf ein Claude-Sonnet-Modell aufgelöst wird; sie wird also gecacht. Ein Nicht-Claude-Modell wie Nova wird nicht gecacht.

Senden Sie in derselben Sitzung aufeinanderfolgende Anfragen und prüfen Sie den Cache-Treffer.

```bash
# 1. Eine Frage in der Chat-Oberfläche stellen
# 2. Innerhalb von 5 Minuten eine zweite Frage stellen
# 3. In CloudWatch Logs prüfen:
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# Erwartete Logzeile:
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

Die CloudWatch-Metrik prüfen:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "RAG/TokenUsage" \
  --metric-name "CachedInputTokens" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## Schritt 3: Automated Reasoning Guardrails (15 Min.)

Provozieren Sie absichtlich einen Berechtigungsverstoß und prüfen Sie, dass Automated Reasoning ihn blockiert.

```bash
# 1. Mit aktivierten Guardrails deployen
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. In der Chat-Oberfläche eine Anfrage außerhalb der Berechtigungsgrenze versuchen
#    Beispiel: mit einem Standardkonto nach einem Dokument nur für Administratoren fragen
#    → prüfen, dass die Antwort auf die Einschränkung durch die Sicherheitsrichtlinie hinweist

# 3. Das Eingriffsprotokoll des Guardrails prüfen
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Schritt 4: AgentCore Gateway und der Permission Interceptor (15 Min.)

```bash
# 1. Mit aktiviertem Gateway deployen
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. Die Gateway-URL aus den Stack-Ausgaben holen
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. Die Logs der Interceptor-Lambda prüfen
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Schritt 5: Citations und die Berechtigungsgrenze (10 Min.)

Senden Sie eine Anfrage über die Chat-Oberfläche und sehen Sie sich die Citations der Antwort an.

```bash
# Das Feld citations der API-Antwort prüfen
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"Erzähl mir vom Umsatzbericht","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# Erwartet:
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Schritt 6: Graph RAG (optional, 5 Min.)

```bash
# 1. Mit aktiviertem Graph RAG deployen (der Start von Neptune Analytics dauert ~10 Min.)
npx cdk deploy --all -c enableGraphRAG=true

# 2. Den Neptune-Analytics-Endpunkt prüfen
aws neptune-graph list-graphs --region ap-northeast-1

# 3. Testabfrage auf den Graphen (über die Lambda)
# der Aufbau des Dokumentbeziehungsgraphen erfordert ein separates Skript
```

---

## Aufräumen

Deaktivieren Sie die neuen Funktionen, um Kosten zu sparen:

```bash
# Graph RAG deaktivieren (stoppt Neptune Analytics)
npx cdk deploy --all -c enableGraphRAG=false

# Gateway deaktivieren
npx cdk deploy --all -c enableAgentCoreGateway=false

# Guardrails deaktivieren
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## Zugehörige Dokumente

- [Leitfaden zur Wahl der Chunking-Strategie](chunking-strategy-guide.md)
- [Arbeitsblatt zur Kostenschätzung](cost-estimation-worksheet.md)
- [Checkliste für den Produktionsbetrieb](production-readiness-checklist.md)
