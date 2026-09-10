# Atelier pratique — mise à jour AI 2026 Q2

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | [한국어](../ko/2026q2-update-hands-on-guide.md) | [简体中文](../zh-CN/2026q2-update-hands-on-guide.md) | [繁體中文](../zh-TW/2026q2-update-hands-on-guide.md) | **Français** | [Deutsch](../de/2026q2-update-hands-on-guide.md) | [Español](../es/2026q2-update-hands-on-guide.md)

**Création**: 2026-06-07  
**Durée**: environ 60 minutes  
**Public cible**: développeurs et partenaires qui veulent essayer les nouvelles fonctions

---

## Vue d'ensemble

Un atelier consacré aux fonctions ajoutées par la mise à jour AI 2026 Q2 (phases 0 à 5). Vous les activez une par une sur un déploiement existant et vérifiez chaque résultat.

---

## Prérequis

- un environnement Permission-aware RAG déjà déployé
- AWS CLI configuré
- Node.js 22+, npm

---

## Étape 1 : vérifier la mise à jour des modèles (5 min)

Vérifiez que les identifiants de modèles mis à jour en phase 0 se comportent comme prévu.

```bash
# Configuration actuelle des modèles
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# Attendu :
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

Envoyez une requête depuis l'interface de chat et vérifiez que `modelId` dans les métadonnées de réponse nomme le nouveau modèle.

---

## Étape 2 : vérifier l'effet du cache de prompts (10 min)

> **Prérequis** : le cache de prompts ne fonctionne qu'avec les modèles **Anthropic Claude**. Dans la configuration par défaut (aucun modèle choisi, repli sur Nova 2 Lite) rien n'est mis en cache. Avant les étapes ci-dessous, choisissez **Claude Sonnet 4.6** ou **Claude Opus 4.8** dans le sélecteur de modèle de la barre latérale.

Envoyez des requêtes consécutives dans une même session et vérifiez le succès du cache.

```bash
# 1. Poser une question dans l'interface de chat
# 2. Poser une deuxième question dans les 5 minutes
# 3. Vérifier dans CloudWatch Logs :
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# Ligne de journal attendue :
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

Vérifiez la métrique CloudWatch :
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

## Étape 3 : Automated Reasoning Guardrails (15 min)

Provoquez délibérément une violation de permission et vérifiez qu'Automated Reasoning la bloque.

```bash
# 1. Déployer avec les guardrails activés
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. Essayer, depuis l'interface de chat, une requête hors de la frontière de permissions
#    exemple : interroger un document réservé aux administrateurs avec un compte standard
#    → vérifier que la réponse indique que le contenu a été restreint par la politique de sécurité

# 3. Vérifier le journal d'intervention du guardrail
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Étape 4 : AgentCore Gateway et le Permission Interceptor (15 min)

```bash
# 1. Déployer avec le Gateway activé
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. Récupérer l'URL du Gateway dans les sorties de la stack
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. Vérifier les journaux de la Lambda Interceptor
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Étape 5 : citations et frontière de permissions (10 min)

Envoyez une requête depuis l'interface de chat et examinez les citations de la réponse.

```bash
# Vérifier le champ citations de la réponse d'API
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"Parle-moi du rapport de ventes","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# Attendu :
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Étape 6 : Graph RAG (facultatif, 5 min)

```bash
# 1. Déployer avec Graph RAG activé (le démarrage de Neptune Analytics prend ~10 min)
npx cdk deploy --all -c enableGraphRAG=true

# 2. Vérifier le point de terminaison Neptune Analytics
aws neptune-graph list-graphs --region ap-northeast-1

# 3. Requête de test sur le graphe (via la Lambda)
# la construction du graphe de relations entre documents nécessite un script distinct
```

---

## Nettoyage

Désactivez les nouvelles fonctions pour réduire le coût :

```bash
# Désactiver Graph RAG (arrête Neptune Analytics)
npx cdk deploy --all -c enableGraphRAG=false

# Désactiver le Gateway
npx cdk deploy --all -c enableAgentCoreGateway=false

# Désactiver les guardrails
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## Documents associés

- [Guide de choix de la stratégie de découpage](chunking-strategy-guide.md)
- [Feuille de calcul d'estimation des coûts](cost-estimation-worksheet.md)
- [Liste de contrôle avant production](production-readiness-checklist.md)
