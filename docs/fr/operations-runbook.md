# Runbook opérationnel

**🌐 Langue :** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **Français**

**Création** : 2026-06-08  
**Statut** : Opérationnel  
**Public cible** : Équipe d'exploitation, Développeurs, Partenaires

---

## Présentation

Runbook consolidant les procédures d'exploitation quotidienne, de vérification et de dépannage du système Permission-aware RAG. Les connaissances acquises lors de la vérification du déploiement sont systématisées en procédures reproductibles.

---

## 1. Vérification de la version ONTAP

### Contexte

Les S3 Access Points requièrent ONTAP 9.14.1 ou supérieur. L'API AWS FSx for ONTAP (`describe-file-systems`) ne retourne pas les informations de version, ce qui nécessite un accès direct à l'API REST ONTAP.

### Prérequis

- IP du Management endpoint FSx (ex. : `10.0.3.72`)
- Mot de passe `fsxadmin` (stocké dans Secrets Manager)
- Instance SSM dans le même VPC (le Management endpoint est en IP privée uniquement)

### Procédure

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

### Sortie attendue

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

### Remarques

- Le Security Group du Management endpoint doit autoriser le trafic entrant HTTPS (443)
- Le rôle IAM de l'instance SSM n'a PAS besoin de `secretsmanager:GetSecretValue` (le mot de passe est récupéré localement et intégré dans la commande SSM)
- `curl -sk` : `-s` (silencieux), `-k` (accepter les certificats auto-signés)

---

## 2. Ingestion des données de démonstration Industry-Packs

### Contexte

7 secteurs × 5 documents = 35 documents + 35 fichiers de métadonnées pour la démonstration Permission-aware RAG multi-sectorielle.

### Procédure

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

### Correspondance secteur / SID

| Secteur | Dossier | SID (hors Domain Admins) |
|---------|---------|--------------------------|
| Construction | `construction/` | `-8100` |
| Éducation | `education/` | `-2200` |
| Gouvernement | `government/` | `-2100` |
| Santé | `healthcare/` | `-2200` |
| Assurance | `insurance/` | `-8200` |
| Juridique | `legal/` | `-8300` |
| Industrie | `manufacturing/` | `-2300` |

---

## 3. Build et déploiement Docker de la WebApp

### Contexte

Après modification du code source, le cache des couches Docker réutilise les anciens fichiers. L'option `--no-cache` par défaut résout ce problème.

### Procédure recommandée

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### Dépannage : modifications non prises en compte

| Cause | Vérification | Solution |
|-------|-------------|----------|
| Cache des couches Docker | Horodatage `docker images` | Reconstruire avec `--no-cache` |
| Tag ECR `latest` obsolète | Digest `aws ecr describe-images` | Utiliser des tags explicites |
| Lambda encore en mise à jour | `get-function` LastUpdateStatus | `wait function-updated` |
| Cache CloudFront | Onglet réseau du DevTools | `create-invalidation` |
| Cache `.next` | Existence de `docker/nextjs/.next/` | `rm -rf docker/nextjs/.next` puis reconstruire |

---

## 4. Débogage du filtre de permissions

### Étapes de vérification

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

### Variations du format des métadonnées

| Format | Exemple | Méthode d'analyse |
|--------|---------|-------------------|
| Tableau | `["S-1-1-0", "S-1-5-21-xxx-512"]` | Utilisation directe |
| Chaîne séparée par des virgules | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| Chaîne JSON | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| Valeur unique | `"S-1-1-0"` | `[value]` |

---

## 5. Vérification du Prompt Caching

### Prérequis

- **Modèles Anthropic Claude uniquement** (Nova, OpenAI non pris en charge)
- Claude Sonnet 4.6 ou Opus 4.8 sélectionné dans l'interface
- TTL du Prompt Cache Bedrock : 5 minutes (éphémère)

### Procédure de vérification

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### Le cache ne fonctionne pas ?

| Cause | Vérification |
|-------|-------------|
| Utilisation d'un modèle Nova / OpenAI | Vérifier le `modelId` dans la réponse |
| Prompt système < 2048 caractères | Vérifier la taille de `prompt-templates.ts` |
| Intervalle entre requêtes > 5 min | Vérifier les horodatages dans CloudWatch |
| Session utilisateur différente | Le Prompt Cache est par utilisateur × modèle |

---

## 6. Checklist complète de vérification du déploiement

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

## Documents associés

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — Solutions par type d'erreur
- [Production Readiness Checklist](../production-readiness-checklist.md) — Exigences pré-production
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — Estimation des coûts mensuels
- [metadata-json-schema](../metadata-json-schema.md) — Spécification formelle .metadata.json
