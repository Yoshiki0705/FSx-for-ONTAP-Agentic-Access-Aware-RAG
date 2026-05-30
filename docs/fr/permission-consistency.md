# Modèle de cohérence des changements de permissions

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | **Français** | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Concepteurs d'opérations, ingénieurs sécurité

---

## Aperçu

Ce document clarifie quand et comment les modifications des ACL de fichiers sur FSx for ONTAP sont reflétées dans le magasin vectoriel et le cache de permissions, et définit les niveaux de garantie de cohérence lors des changements de permissions.

---

## Flux global des données de permissions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Flux de propagation des changements de permissions         │
│                                                                              │
│  ① Changement ACL   ② Régénération métadonnées ③ Re-sync KB      ④ Invali- │
│                                                                    dation    │
│                                                                    cache     │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx for ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json update │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ Change   │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │expiry  │  │
│  L'admin modifie   Le rôle de service    KB Auto-Sync           └────────┘  │
│  les permissions   Lambda re-récupère    (EventBridge            TTL 5 min  │
│  du fichier        l'ACL                 Scheduler)              invalidation│
│                                           ou déclenchement       automatique │
│                                           manuel                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Détails des étapes

### Étape ① : Changement ACL (FSx for ONTAP)

| Opération | Délai de réflexion | Notes |
|-----------|-------------------|-------|
| Changement ACL de fichier | Immédiat (sur FSx) | L'ACL NTFS est immédiatement reflétée sur le volume FSx |
| Changement d'appartenance à un groupe | Après propagation AD (typiquement sous 15 min) | Dépend du délai de réplication AD |
| Déplacement de fichier (rename/move) | Immédiat (sur FSx) | Les permissions héritées sont recalculées |
| Changement de permission héritée | Immédiat (sur FSx) | Les changements ACL du dossier parent se propagent aux enfants |

### Étape ② : Régénération des métadonnées

Méthodes pour mettre à jour `allowed_group_sids` dans `.metadata.json` :

| Méthode | Déclencheur | Délai | Notes |
|---------|-------------|-------|-------|
| Upload via Transfer Family | Lors de l'upload du fichier | Immédiat | Quand `enableTransferFamily=true`. Génère automatiquement les métadonnées pour les fichiers uploadés |
| AD Sync Lambda | Manuel / Planifié | Dépend de la configuration | `lambda/agent-core-ad-sync/` re-récupère l'ACL NTFS |
| Mise à jour manuelle | Opération admin | Immédiat | Pour le chemin de secours S3 bucket, mettre à jour directement `.metadata.json` |

### Étape ③ : Mise à jour du magasin vectoriel (Re-sync KB)

| Méthode | Déclencheur | Délai | Notes |
|---------|-------------|-------|-------|
| KB Auto-Sync | EventBridge Scheduler (polling) | Intervalle configuré (par défaut : 15 min) | Quand `enableKbAutoSync=true`. Exécute StartIngestionJob uniquement lorsque des changements de fichiers sont détectés |
| Sync KB manuelle | Console AWS / CLI | Démarre immédiatement, se termine en minutes | `aws bedrock-agent start-ingestion-job` |
| Événement CloudTrail | S3 PutObject | Quelques minutes | Quand `enableCloudTrailIngestion=true` sur le chemin Transfer Family |

**Durée estimée de la synchronisation KB :**

| Nombre de documents | Temps de synchronisation (estimation) |
|---------------------|--------------------------------------|
| ~100 | 1–3 min |
| ~1 000 | 5–15 min |
| ~10 000 | 30–60 min |
| ~100 000 | Plusieurs heures (synchronisation incrémentale recommandée) |

### Étape ④ : Invalidation du cache de permissions

| Cache | TTL | Méthode d'invalidation | Notes |
|-------|-----|------------------------|-------|
| DynamoDB `perm-cache` | 5 min | Expiration automatique du TTL | Cache des résultats de filtrage |
| DynamoDB `user-access` | Aucun (persistant) | Mise à jour explicite requise | SID utilisateur / SID de groupe |
| Session navigateur | Pendant la session | Déconnexion / expiration de session | Cache mémoire frontend |

---

## Délai maximum de propagation des permissions

### Opérations normales

```
Changement ACL → Régénération métadonnées → Re-sync KB → Expiration cache
  0 min            0–15 min                  1–15 min     0–5 min
                                              
Délai max : ~35 min (15 min polling + 15 min sync KB + 5 min cache)
```

### Expression de type RPO

| Scénario | Délai max | Description |
|----------|-----------|-------------|
| Opérations normales (KB Auto-Sync intervalle 15 min) | Max 35 min | Intervalle de polling + sync KB + TTL cache |
| Synchronisation haute fréquence (KB Auto-Sync intervalle 5 min) | Max 15 min | Intervalle de polling réduit |
| Synchronisation manuelle immédiate | Max 10 min | Sync KB manuelle + TTL cache |
| Révocation d'urgence des permissions | Max 5 min | Vidage forcé du cache + Fail-Closed |

---

## Procédure de révocation d'urgence des permissions

Lorsqu'une révocation immédiate des permissions d'accès d'un utilisateur est requise :

### Étape 1 : Supprimer le SID de l'utilisateur de DynamoDB (effet immédiat)

```bash
# Supprimer les données SID de l'utilisateur → Fail-Closed refuse tous les documents
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Étape 2 : Vidage forcé du cache de permissions

```bash
# Supprimer les entrées de cache pour l'utilisateur cible
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### Étape 3 : Désactiver l'utilisateur Cognito (invalidation de session)

```bash
# Désactiver l'utilisateur Cognito
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Effet

- Après l'étape 1 : Les nouvelles requêtes de recherche refusent immédiatement tous les documents (Fail-Closed)
- Après l'étape 2 : Empêche l'utilisation des anciennes informations de permissions en cache
- Après l'étape 3 : Invalide la session de l'utilisateur elle-même

---

## Comportement par scénario de changement de permissions

### Scénario 1 : Changement ACL de fichier

```
L'admin retire l'utilisateur X de l'ACL du fichier A
  → Retirer le SID de l'utilisateur X de allowed_group_sids dans .metadata.json
  → La re-sync KB met à jour les métadonnées du magasin vectoriel
  → Le fichier A est exclu des prochains résultats de recherche de l'utilisateur X
```

**Délai** : Max 35 min (opérations normales)

### Scénario 2 : Changement d'appartenance à un groupe AD

```
L'admin retire l'utilisateur X du groupe Engineering
  → Réplication AD (~15 min)
  → Mise à jour des groupSIDs dans DynamoDB user-access (lors de l'exécution du AD Sync Lambda)
  → Les documents restreints au groupe Engineering sont exclus de la prochaine recherche de l'utilisateur X
```

**Délai** : Réplication AD + intervalle d'exécution du AD Sync Lambda + TTL cache

### Scénario 3 : Déplacement de fichier (rename / move)

```
L'admin déplace le fichier A de /public/ vers /confidential/
  → Les permissions héritées sont recalculées sur FSx
  → Régénération de .metadata.json requise
  → La re-sync KB met à jour les métadonnées du magasin vectoriel
```

**Note** : La régénération automatique de `.metadata.json` peut ne pas se produire lors d'un déplacement de fichier. Une conception où le polling KB Auto-Sync détecte les changements de chemin de fichier et déclenche la régénération des métadonnées est recommandée.

### Scénario 4 : Changement de permission héritée

```
L'admin modifie l'ACL du dossier /confidential/ (héritage activé)
  → Les permissions effectives changent pour tous les fichiers en dessous
  → Régénération de .metadata.json requise pour chaque fichier
  → Re-sync KB
```

**Note** : Les changements de permissions en masse pour un grand nombre de fichiers prennent du temps pour la synchronisation KB. Des changements progressifs sont recommandés.

---

## Niveaux de garantie de cohérence

| Niveau | Garantie | Implémentation |
|--------|----------|----------------|
| **Fail-Closed** | Refuser tout si les informations SID ne peuvent être récupérées | En cas d'erreur DynamoDB / absence d'enregistrement |
| **Cohérence à terme** | Les changements ACL sont finalement reflétés dans les résultats de recherche | KB Auto-Sync + TTL cache |
| **Pas de faux positif** | Les documents sans permission ne sont jamais affichés | Correspondance SID (intersection d'ensembles) |
| **Métadonnées requises** | Les documents sans métadonnées sont exclus | `.metadata.json` requis |

### Note : Possibilité de faux négatifs

Dans les cas suivants, des documents qui devraient être accessibles peuvent temporairement ne pas être affichés (faux négatif) :

- Immédiatement après l'octroi de permissions (métadonnées pas encore mises à jour)
- Pendant la synchronisation KB (anciennes métadonnées restantes)
- Pendant le délai de réplication AD

**Principe de conception** : Pour la sécurité, les faux négatifs (éléments accessibles non visibles) sont tolérés, tandis que les faux positifs (éléments restreints visibles) visent zéro occurrence.

---

## Configuration recommandée de surveillance et d'alertes

```yaml
# Paramètres d'alarme CloudWatch recommandés
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # Taux élevé de cache miss = fréquence élevée de mise à jour des données de permissions
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # Alerte après 3 échecs consécutifs
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # Alerte immédiate en cas d'échec de résolution SID
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Investiguer si le Fail-Closed se déclenche fréquemment
```

---

## Documents associés

| Document | Description |
|----------|-------------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Détails de l'architecture de filtrage SID |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de vérification pour la mise en production |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionnement et performance FSx for ONTAP |
