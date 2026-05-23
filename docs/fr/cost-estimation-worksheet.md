# Feuille de calcul d'estimation des coûts

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | [한국어](../ko/cost-estimation-worksheet.md) | [简体中文](../zh-CN/cost-estimation-worksheet.md) | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | **Français** | [Deutsch](../de/cost-estimation-worksheet.md) | [Español](../es/cost-estimation-worksheet.md)

**Date de création** : 2026-05-23  
**Statut** : Brouillon  
**Public cible** : Chefs de projet, responsables de propositions partenaires, planificateurs budgétaires

> **⚠️ Remarque** : Les tarifs de cette feuille de calcul sont des valeurs de référence basées sur les prix publics de la région ap-northeast-1 en mai 2026. Les coûts réels varient selon la région, l'utilisation, les remises et les mises à jour tarifaires. Consultez [AWS Pricing](https://aws.amazon.com/pricing/) pour les tarifs les plus récents.

---

## Paramètres d'entrée

Remplissez les valeurs ci-dessous pour estimer votre coût mensuel.

| Paramètre | Valeur | Remarques |
|-----------|--------|-----------|
| Nombre de documents | _____ | Fichiers sur le volume FSx |
| Taille moyenne des documents | _____ Ko | Équivalent texte |
| Requêtes quotidiennes | _____ /jour | Total tous utilisateurs |
| Utilisateurs simultanés | _____ | Pic |
| Utilisateurs enregistrés | _____ | Cognito User Pool |
| Fréquence de synchronisation KB | _____ /jour | Calculée à partir de l'intervalle Auto-Sync |
| Taux d'utilisation du mode Agent | _____ % | Pourcentage de requêtes utilisant Agent |
| Exigence de disponibilité | Single-AZ / Multi-AZ | Configuration FSx |

---

## Formules de calcul des coûts

### 1. FSx for ONTAP

```
Mensuel = coût throughput + coût SSD + coût Capacity Pool + coût sauvegarde

Coût throughput :
  128 MB/s : ~$210/mois
  256 MB/s : ~$420/mois
  512 MB/s : ~$840/mois
  1,024 MB/s : ~$1,680/mois

Coût SSD : $0.125/GiB/mois × capacité SSD (GiB)
Coût Capacity Pool : $0.0125/GiB/mois × utilisation Capacity Pool (GiB)
Coût sauvegarde : $0.025/GiB/mois × capacité de sauvegarde (GiB)

Pour Multi-AZ : les coûts throughput + SSD sont environ doublés
```

**Exemples de calcul** :
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ) : $210 + $128 + $6.25 = **~$344/mois**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ) : $1,680 + $640 + $25 = **~$2,345/mois**

### 2. Stockage vectoriel

```
S3 Vectors :
  Stockage : $0.023/GB/mois × taille des données vectorielles
  Requêtes : $0.005/1,000 PUT + $0.0004/1,000 GET
  Estimation : 10,000 documents → ~$5/mois

OpenSearch Serverless :
  OCU : $0.24/OCU/heure × 24 × 30 = $172.80/OCU/mois
  Minimum 2 OCU (recherche + index) : ~$346/mois
  Recommandé 4 OCU : ~$691/mois
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2 : $0.0001/1,000 tokens

Embedding initial :
  = nombre de documents × taille moyenne (Ko) × 1,000 / 4 × $0.0001/1K
  Exemple : 10,000 docs × 10 Ko × 250 tokens/Ko × $0.0001/1K = $2.50

Embedding incrémentiel mensuel :
  = documents modifiés × taille moyenne × $0.0001/1K
  Exemple : 500 docs/mois × 10 Ko × 250 tokens/Ko × $0.0001/1K = $0.13
```

### 4. Bedrock (Modèles de génération)

```
Distribution Smart Routing (hypothèse par défaut) :
  Simple (Haiku) : 60% → $0.001/query
  Complex (Sonnet) : 30% → $0.01/query
  Full-context (Opus) : 10% → $0.10/query

Coût moyen pondéré/requête :
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

Mensuel :
  = requêtes quotidiennes × 30 × $0.014
  Exemple : 100 queries/jour × 30 × $0.014 = $42/mois
  Exemple : 1,000 queries/jour × 30 × $0.014 = $420/mois
```

### 5. Lambda

```
WebApp Lambda :
  Requêtes : $0.20/1 million de requêtes
  Calcul : $0.0000166667/GB-seconde
  Mémoire : 1,024 MB, durée d'exécution moyenne : 3 secondes
  
  Mensuel = requêtes × (mémoire_GB × secondes_exec × $0.0000166667 + $0.0000002)
  Exemple : 100,000 req/mois × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/mois

Lambda de synchronisation (KB Auto-Sync, AD Sync) :
  Intervalle de 5 minutes × 30 jours = 8,640 invocations/mois
  128 MB × 5 secondes = ~$0.60/mois
```

### 6. Autres services

```
CloudFront : $0.114/GB (Japon) × volume de transfert
  Exemple : 10 GB/mois = $1.14/mois

WAF : $5/WebACL + $1/règle × 6 + $0.60/1 million de requêtes
  Base : $11/mois + facturation à l'usage

DynamoDB (à la demande) :
  Écritures : $1.25/1 million WRU
  Lectures : $0.25/1 million RRU
  Stockage : $0.25/GB/mois
  Exemple : ~$5/mois (petite échelle)

Cognito :
  Premiers 50,000 MAU : Gratuit
  50,001–100,000 : $0.0055/MAU
  Exemple : 100 MAU = $0 (dans le niveau gratuit)

CloudWatch :
  Ingestion de logs : $0.76/GB
  Stockage de logs : $0.033/GB/mois
  Métriques : $0.30/métrique/mois (premiers 10,000)
  Exemple : ~$10–$30/mois
```

---

## Modèles d'estimation mensuelle par configuration

### Modèle A : PoC à petite échelle

| Ressource | Configuration | Mensuel |
|-----------|--------------|---------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 vecteurs | $5 |
| Bedrock Embedding | Initial + incrémentiel | $3 |
| Bedrock Génération | 100 queries/jour, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | Basique | $15 |
| DynamoDB | À la demande | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | Basique | $10 |
| **Total** | | **~$430/mois** |

### Modèle B : Production à moyenne échelle

| Ressource | Configuration | Mensuel |
|-----------|--------------|---------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | Synchronisation périodique | $10 |
| Bedrock Génération | 1,000 queries/jour, Smart Routing | $420 |
| Lambda | WebApp + Sync + Surveillance | $30 |
| CloudFront + WAF | Trafic de production | $50 |
| DynamoDB | Provisionné | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | Logs + Métriques + Alarmes | $50 |
| **Total** | | **~$3,626/mois** |

### Modèle C : Grande entreprise

| Ressource | Configuration | Mensuel |
|-----------|--------------|---------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | Synchronisation à grande échelle | $50 |
| Bedrock Génération | 5,000 queries/jour, Smart Routing | $2,100 |
| Lambda | Toutes fonctionnalités | $100 |
| CloudFront + WAF | Trafic élevé | $200 |
| DynamoDB | Provisionné + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | Surveillance complète | $100 |
| **Total** | | **~$8,512/mois** |

---

## Points d'optimisation des coûts

| Méthode | Économie | Conditions d'application |
|---------|----------|------------------------|
| S3 Vectors (au lieu de AOSS) | -$700/mois | QPS < 10, latence tolérée |
| Smart Routing (priorité Haiku) | -30–50% | Majorité de questions simples |
| Capacity Pool Tiering | -50–80% (stockage) | Données peu fréquemment accédées |
| Réduction du throughput (phase opérationnelle) | -50% | Après l'indexation initiale |
| Savings Plans (Lambda) | -17% | Engagement 1 an |
| Reserved Capacity (AOSS) | Contacter AWS | Utilisation à long terme confirmée |

---

## Documents associés

| Document | Description |
|----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | Dimensionnement et performance FSx for ONTAP |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | Modèles de déploiement partenaires (comparaison des coûts incluse) |
| [evaluation.md](../evaluation.md) | Métriques d'évaluation RAG / Agent |
