# Modèle de cohérence des métadonnées de permission

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | **Français** | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**Créé le** : 2026-05-21
**Mis à jour le** : 2026-09-07 (retrait du flux de propagation automatique à partir des ACL, après vérification de l'implémentation)
**Statut** : Brouillon
**Public cible** : Concepteurs d'opérations, ingénieurs sécurité

---

## Vue d'ensemble

Ce document définit à quel moment une modification des données utilisées pour la décision de permission au moment de la requête devient visible dans les résultats de recherche. Deux jeux de données sont utilisés : `.metadata.json` du côté document, et la table DynamoDB `user-access` du côté utilisateur.

**Aucun mécanisme ne suit automatiquement les modifications des ACL NTFS des fichiers sur FSx for ONTAP.** L'index de permissions n'est pas une projection de l'ACL ; c'est un index construit et maintenu séparément. Les raisons et les implications opérationnelles sont dans « Pourquoi les modifications d'ACL n'arrivent pas ».

---

## Données utilisées pour la décision de permission

| Donnée | Emplacement | Produite/mise à jour par | Rôle au moment de la requête |
|--------|-------------|--------------------------|------------------------------|
| `.metadata.json` (`allowed_group_sids` / `allowed_uids` / `allowed_gids`) | Objet adjacent sur le S3 AP → attribut de métadonnées dans le Bedrock KB | Dépend du chemin (voir ci-dessous) | Ensemble des SID / UID / GID autorisés du chunk récupéré |
| `user-access` (`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`) | DynamoDB | Lambda de synchronisation AD / LDAP (`lambda/agent-core-ad-sync/`) | Ensemble des SID / UID / GID de l'appelant |
| `perm-cache` | DynamoDB (TTL 5 minutes) | Filtre de permissions | Cache des résultats de décision |

Origine de `.metadata.json` :

| Chemin | Origine | Déclencheur |
|--------|---------|-------------|
| Transfer Family SFTP (`enableTransferFamily=true`) | Table de correspondance DynamoDB maintenue par l'administrateur (clé : nom de l'utilisateur d'upload) | À l'upload du fichier |
| Serveur d'embeddings auto-hébergé (`ENV_AUTO_METADATA=true`, optionnel, non par défaut) | ACL NTFS réelle récupérée via l'API REST ONTAP | À la détection d'un fichier non traité (selon `mtime`) |
| Environnement de démonstration | Exemples fournis dans le dépôt, placés manuellement | Manuel |

Les utilisateurs SFTP portent un Deny IAM sur `*.metadata.json` : celui qui dépose un fichier ne peut pas rédiger ses propres permissions.

---

## Chemins de propagation

Deux chemins se propagent automatiquement.

### Chemin A : modification de permission côté document

| Étape | Prise en charge par | Latence |
|-------|---------------------|---------|
| ① Mise à jour de `.metadata.json` | L'origine du tableau ci-dessus, ou une mise à jour directe par un administrateur | Selon le déclencheur |
| ② Détection de différence | KB Auto-Sync (EventBridge Scheduler ; compare `size` / `lastModified` / `ETag`) | Intervalle de polling (15 min par défaut) |
| ③ Mise à jour du store vectoriel | `StartIngestionJob` | 1 à 15 min (selon le nombre de documents) |
| ④ Expiration du cache de décision | TTL de `perm-cache` | Jusqu'à 5 min |

### Chemin B : modification de permission côté utilisateur

| Étape | Prise en charge par | Latence |
|-------|---------------------|---------|
| ① Modification d'appartenance à un groupe AD | Réplication AD | Généralement sous 15 min |
| ② Mise à jour de `user-access` | Lambda de synchronisation AD / LDAP. **Déclenchée par Cognito PostAuthentication / PostConfirmation ; aucune exécution planifiée** | Jusqu'à la prochaine connexion de l'utilisateur (indéfini) |
| ③ Expiration du cache de décision | TTL de `perm-cache`, ou invalidation explicite via les DynamoDB Streams de `user-access` | Jusqu'à 5 min |

L'étape ② du chemin B n'arrive jamais pour un utilisateur dont la session se poursuit. Pour révoquer de manière fiable, utilisez la procédure de révocation d'urgence.

---

## Pourquoi les modifications d'ACL n'arrivent pas

Modifier l'ACL NTFS d'un fichier ne régénère `.metadata.json` dans aucune configuration de déploiement. Vérifié sur l'implémentation :

| Mécanisme | S'exécute lors d'une modification d'ACL ? | Base |
|-----------|-------------------------------------------|------|
| Lambda de synchronisation AD / LDAP | Non | Ni la récupération d'ACL ni l'écriture de `.metadata.json` ne sont implémentées. Elle ne récupère que les SID des utilisateurs depuis AD |
| Génération de métadonnées Transfer Family | Non | Déclenchée par l'upload de fichier. L'origine est une table DynamoDB maintenue par l'administrateur, qui ne consulte pas l'ACL |
| Serveur d'embeddings auto-hébergé (`ENV_AUTO_METADATA=true`) | Non | Le retraitement se base sur `mtime`. Une modification d'ACL seule ne change pas `mtime` |
| KB Auto-Sync | Non | La différence porte sur `size` / `lastModified` / `ETag`. Une modification d'ACL n'en change aucun |
| Service de permissions FSx (`lambda/permissions/fsx-permission-service.ts`) | Hors périmètre | Du code lisant les ACL existe, mais aucune stack CDK ne le déploie |

**Implication** : pour refléter une modification d'ACL dans les résultats de recherche, un opérateur doit régénérer `.metadata.json` et le placer sur le S3 AP. L'exactitude de cet index dépend des opérations ; l'accord avec l'ACL n'est pas garanti automatiquement. Pour un blocage d'accès urgent, agissez du côté utilisateur (suppression dans `user-access` + purge du cache + invalidation de session) plutôt que sur l'ACL.

---

## Détail des étapes

### Mise à jour du store vectoriel (re-synchronisation KB)

| Méthode | Déclencheur | Latence | Remarques |
|---------|-------------|---------|-----------|
| KB Auto-Sync | EventBridge Scheduler (polling) | Intervalle configuré (défaut : 15 min) | Avec `enableKbAutoSync=true`. StartIngestionJob ne s'exécute que si un changement de fichier est détecté |
| Synchronisation KB manuelle | Console AWS / CLI | Démarrage immédiat, quelques minutes pour finir | `aws bedrock-agent start-ingestion-job` |
| Événement CloudTrail | S3 PutObject | Quelques minutes | Sur le chemin Transfer Family avec `enableCloudTrailIngestion=true` |

**Durée indicative de la synchronisation KB :**

| Nombre de documents | Durée (indicative) |
|---------------------|--------------------|
| jusqu'à 100 | 1 à 3 min |
| jusqu'à 1 000 | 5 à 15 min |
| jusqu'à 10 000 | 30 à 60 min |
| jusqu'à 100 000 | Plusieurs heures (synchronisation incrémentale recommandée) |

### Invalidation du cache de permissions

| Cache | TTL | Invalidation | Remarques |
|-------|-----|--------------|-----------|
| DynamoDB `perm-cache` | 5 min | Expiration du TTL / suppression explicite via les Streams de `user-access` | Cache des résultats de filtrage |
| DynamoDB `user-access` | Aucun (persistant) | Nécessite une mise à jour explicite | SID utilisateur / SID de groupes |
| Session navigateur | Pendant la session | Déconnexion / expiration de session | Cache mémoire du front-end |

---

## Délai maximal de propagation

| Origine | Délai maximal | Décomposition |
|---------|---------------|---------------|
| Modification côté document (chemin A, Auto-Sync toutes les 15 min) | ~35 min | 15 min polling + 15 min sync KB + 5 min cache |
| Modification côté document (Auto-Sync toutes les 5 min) | ~25 min | 5 min polling + 15 min sync KB + 5 min cache |
| Modification côté document (sync KB manuelle) | ~20 min | 15 min sync KB + 5 min cache |
| Modification côté utilisateur (chemin B) | Non définissable | 15 min réplication AD + jusqu'à la prochaine connexion (indéfini) + 5 min cache |
| Révocation d'urgence (procédure ci-dessous) | Jusqu'à 5 min | Purge forcée du cache + Fail-Closed |
| Modification de l'ACL d'un fichier | **Non définissable** | Aucun mécanisme ne la suit. Suppose une régénération de `.metadata.json` par un opérateur |

Les 15 min de synchronisation KB dépendent du nombre de documents (voir la durée indicative ci-dessus). À 10 000 documents, cela devient 30 à 60 min, et le délai total croît d'autant.

---

## Procédure de révocation d'urgence

Lorsque l'accès d'un utilisateur doit être révoqué immédiatement :

### Étape 1 : supprimer les SID de l'utilisateur dans DynamoDB (effet immédiat)

```bash
# Supprimer les données SID de l'utilisateur → Fail-Closed refuse tous les documents
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Étape 2 : purger de force le cache de permissions

```bash
# Supprimer les entrées de cache de l'utilisateur
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

### Étape 3 : désactiver l'utilisateur Cognito (invalidation de session)

```bash
# Désactiver l'utilisateur Cognito
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Effet

- Après l'étape 1 : les nouvelles requêtes de recherche sont immédiatement refusées pour tous les documents (Fail-Closed)
- Après l'étape 2 : les données de permission mises en cache ne peuvent plus être utilisées
- Après l'étape 3 : la session de l'utilisateur elle-même est invalidée

**Notez que cette procédure arrête le côté utilisateur, pas le côté document.** Masquer un document précis à une seule personne passe par la mise à jour de `.metadata.json` et la re-synchronisation KB, et subit donc la latence du chemin A.

---

## Comportement par scénario de modification

### Scénario 1 : modification des métadonnées de permission d'un document

```
L'administrateur retire le SID de User X du .metadata.json du fichier A
  → KB Auto-Sync détecte la différence (ETag modifié)
  → StartIngestionJob met à jour les métadonnées du store vectoriel
  → Après expiration du TTL de perm-cache, le fichier A est exclu des recherches de User X
```

**Latence** : jusqu'à ~35 min (Auto-Sync toutes les 15 min)

### Scénario 2 : modification d'appartenance à un groupe AD

```
L'administrateur retire User X du groupe Engineering
  → Réplication AD (~15 min)
  → À la prochaine connexion de User X, la Lambda de synchronisation AD met à jour groupSIDs dans user-access
  → Après expiration de perm-cache, les documents réservés à Engineering sont exclus
```

**Latence** : réplication AD + jusqu'à la prochaine connexion (indéfini) + TTL du cache. **Rien n'est reflété pendant que la session se poursuit.** Si l'immédiateté est requise, utilisez la procédure de révocation d'urgence.

### Scénario 3 : déplacement de fichier (rename / move)

```
L'administrateur déplace le fichier A de /public/ vers /confidential/
  → Les permissions héritées sont recalculées sur FSx (permissions effectives côté ONTAP uniquement)
  → .metadata.json ne suit pas les permissions de la destination
  → Un opérateur doit régénérer et placer .metadata.json
```

**Remarque** : les SID autorisés de l'emplacement d'origine subsistent, donc un déplacement seul ne change pas la visibilité en recherche. Si la structure de répertoires sert de frontière de permissions, faites du déplacement et de la mise à jour de `.metadata.json` une seule procédure.

### Scénario 4 : modification d'ACL en masse sur un dossier parent

```
L'administrateur modifie l'ACL de /confidential/ (héritage activé)
  → Les permissions effectives changent sur ONTAP pour tous les fichiers en dessous
  → .metadata.json ne suit pas (voir « Pourquoi les modifications d'ACL n'arrivent pas »)
  → Une régénération de .metadata.json pour ces fichiers plus une re-synchronisation KB sont nécessaires
```

**Remarque** : les modifications en masse sur de nombreux fichiers allongent la re-synchronisation. Des changements par étapes sont recommandés.

---

## Niveaux de garantie de cohérence

| Niveau | Garantie | Implémentation |
|--------|----------|----------------|
| **Fail-Closed** | Tout refuser lorsque les informations de SID ne peuvent pas être récupérées | Erreur DynamoDB / enregistrement absent |
| **Eventually Consistent** | Les modifications des métadonnées de permission (`.metadata.json` / `user-access`) atteignent finalement les résultats de recherche | KB Auto-Sync + TTL du cache + invalidation par Streams |
| **No False Positive** | Les documents pour lesquels l'utilisateur n'a pas de permission ne sont pas affichés | Correspondance de SID (intersection d'ensembles) |
| **Metadata Required** | Les documents sans métadonnées sont exclus | `.metadata.json` obligatoire |
| **Absence de suivi des ACL** | Les modifications d'ACL de fichiers ne sont pas reflétées automatiquement | Suppose une régénération de `.metadata.json` par un opérateur |

### Remarque : faux négatifs possibles

Dans les cas suivants, un document auquel l'utilisateur a droit peut temporairement ne pas apparaître (faux négatif) :

- Juste après un octroi (`.metadata.json` pas encore mis à jour, ou avant la re-synchronisation KB)
- Pendant la synchronisation KB (métadonnées obsolètes encore présentes)
- Pendant un délai de réplication AD, ou avant que l'utilisateur ne se reconnecte

**Position de conception** : pour la sécurité, les faux négatifs (ce qui devrait être visible ne l'est pas) sont acceptés, et les faux positifs (ce qui ne doit pas être visible l'est) sont visés à zéro.

Cependant, **cette position suppose que l'index de permissions est correct.** Si une ACL a été restreinte mais que `.metadata.json` n'a pas été mis à jour, l'index renvoie toujours une autorisation, ce qui est un faux positif. La maintenance de l'index est la frontière elle-même.

---

## Surveillance et alertes recommandées

```yaml
# Alarmes CloudWatch recommandées
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # taux de miss élevé = mises à jour fréquentes des données de permission

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # alerte après 3 échecs consécutifs

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # alerte immédiate en cas d'échec de résolution de SID

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # des déclenchements fréquents de Fail-Closed justifient une investigation
```

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Détails de conception du filtrage SID |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checklist de mise en production |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Conception performance et capacité FSx for ONTAP |
