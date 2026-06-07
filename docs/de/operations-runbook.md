# Operations-Runbook

**🌐 Sprache:** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **Deutsch**

**Erstellt**: 2026-06-08  
**Status**: Operativ  
**Zielgruppe**: Betriebsteam, Entwickler, Partner

---

## Überblick

Runbook mit konsolidierten Verfahren für den täglichen Betrieb, die Verifizierung und Fehlerbehebung des Permission-aware RAG-Systems. Erkenntnisse aus der Deployment-Verifizierung werden in reproduzierbare Abläufe systematisiert.

---

## 1. ONTAP-Versionsprüfung

### Hintergrund

S3 Access Points erfordern ONTAP 9.14.1 oder höher. Die FSx for ONTAP AWS API (`describe-file-systems`) liefert keine Versionsinformation, sodass ein direkter Zugriff auf die ONTAP REST API erforderlich ist.

### Voraussetzungen

- FSx Management-Endpunkt-IP (z. B. `10.0.3.72`)
- `fsxadmin`-Passwort (in Secrets Manager gespeichert)
- SSM-fähige Instanz im selben VPC (Management-Endpunkt nur über Private IP erreichbar)

### Vorgehensweise

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### Erwartete Ausgabe

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### Hinweise

- Die Security Group des Management-Endpunkts muss eingehenden HTTPS-Verkehr (443) zulassen
- Die IAM-Rolle der SSM-Instanz benötigt KEINE `secretsmanager:GetSecretValue`-Berechtigung (das Passwort wird lokal abgerufen und in den SSM-Befehl eingebettet)
- `curl -sk`: `-s` (stiller Modus), `-k` (selbstsigniertes Zertifikat akzeptieren)

---

## 2. Industry-Packs-Demodaten-Ingestion

### Hintergrund

7 Branchen × 5 Dokumente = 35 Dokumente + 35 Metadatendateien für die branchenübergreifende Permission-aware RAG-Demo.

### Vorgehensweise

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### Branchen-SID-Zuordnung

| Branche | Ordner | SID (außer Domain Admins) |
|---------|--------|--------------------------|
| Bauwesen | `construction/` | `-8100` |
| Bildung | `education/` | `-2200` |
| Regierung | `government/` | `-2100` |
| Gesundheitswesen | `healthcare/` | `-2200` |
| Versicherung | `insurance/` | `-8200` |
| Recht | `legal/` | `-8300` |
| Fertigung | `manufacturing/` | `-2300` |

---

## 3. WebApp Docker-Build und -Deployment

### Hintergrund

Nach Quellcodeänderungen verwendet der Docker-Layer-Cache alte Quellen wieder. Die Standardeinstellung `--no-cache` behebt dieses Problem.

### Empfohlene Vorgehensweise

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### Fehlerbehebung: Änderungen werden nicht übernommen

| Ursache | Prüfung | Lösung |
|---------|---------|--------|
| Docker-Layer-Cache | `docker images`-Zeitstempel | Mit `--no-cache` neu bauen |
| ECR `latest`-Tag veraltet | `aws ecr describe-images` Digest | Explizite Tags verwenden |
| Lambda wird noch aktualisiert | `get-function` LastUpdateStatus | `wait function-updated` |
| CloudFront-Cache | Browser DevTools Netzwerk-Tab | `create-invalidation` |
| `.next`-Cache | Existenz von `docker/nextjs/.next/` | `rm -rf docker/nextjs/.next` dann neu bauen |

---

## 4. Permission-Filter-Debugging

### Verifizierungsschritte

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### Metadaten-Formatvarianten

| Format | Beispiel | Parsing-Methode |
|--------|----------|-----------------|
| Array | `["S-1-1-0", "S-1-5-21-xxx-512"]` | Direkt verwenden |
| Kommagetrennte Zeichenkette | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| JSON-Zeichenkette | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| Einzelwert | `"S-1-1-0"` | `[value]` |

---

## 5. Prompt-Caching-Verifizierung

### Voraussetzungen

- **Nur Anthropic Claude-Modelle** (Nova, OpenAI nicht unterstützt)
- Claude Sonnet 4.6 oder Opus 4.8 in der Oberfläche ausgewählt
- Bedrock Prompt Cache TTL: 5 Minuten (ephemeral)

### Prüfverfahren

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### Cache funktioniert nicht?

| Ursache | Prüfung |
|---------|---------|
| Nova / OpenAI-Modell im Einsatz | `modelId` in der Antwort prüfen |
| System-Prompt < 2048 Zeichen | Größe von `prompt-templates.ts` prüfen |
| Abfrageintervall > 5 Min. | CloudWatch-Log-Zeitstempel prüfen |
| Andere Benutzersitzung | Prompt Cache ist pro Benutzer × Modell |

---

## 6. Vollständige Deployment-Verifizierungs-Checkliste

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## Verwandte Dokumente

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — Fehlerspezifische Lösungen
- [Production Readiness Checklist](../production-readiness-checklist.md) — Anforderungen vor der Produktivsetzung
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — Monatliche Kostenschätzungen
- [metadata-json-schema](../metadata-json-schema.md) — Formale .metadata.json-Spezifikation
