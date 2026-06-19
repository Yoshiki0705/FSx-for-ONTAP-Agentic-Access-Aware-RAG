# Chemin de mise à niveau vers Amazon Bedrock Managed Knowledge Base (procédures de validation)

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | [한국어](../ko/managed-kb-upgrade-path.md) | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | **Français** | [Deutsch](../de/managed-kb-upgrade-path.md) | [Español](../es/managed-kb-upgrade-path.md)

**Date de création** : 2026-06-18
**Région cible** : ap-northeast-1 (Tokyo) — Managed KB est disponible dans la région de Tokyo (GA 2026-06-17)
**Statut** : Document de procédure de validation (migration non implémentée / chemin existant conservé)
**Connexe** : [Évaluation de migration Managed KB](managed-kb-migration-evaluation.md) (critères de décision / compromis)

---

## 0. Objet de ce document

Ce document traduit les points de vérification organisés dans l'[Évaluation de migration Managed KB](managed-kb-migration-evaluation.md) en **procédures de validation exploitables**. Référez-vous au document d'évaluation de migration pour la discussion des critères de décision et des compromis ; ce document se concentre sur le « comment valider ».

Hypothèses importantes :

- Ce document est un **guide de procédure de validation** et ne recommande pas une migration immédiate.
- Le chemin existant (Bedrock KB + OpenSearch Serverless / S3 Vectors) n'est **pas supprimé**. Il s'agit d'une validation supplémentaire d'une option parallèle.
- Managed KB n'est pas « supérieur » au KB conventionnel. C'est un choix de **bon outil pour la tâche** ; savoir s'il peut répondre à l'exigence principale de ce projet, le Permission-aware RAG (application stricte de l'ACL), détermine la faisabilité de la migration.
- Les niveaux de preuve du contenu ci-dessous sont classés comme suit.

| Niveau | Définition | Traitement dans ce document |
|--------|-----------|------------------------------|
| Public evidence | Vérifiable depuis la documentation/les blogs officiels AWS | Cité avec liens vers les sources |
| Project-context expectation | Décisions/attentes de conception au sein de ce projet (non vérifiables publiquement) | Étiqueté explicitement « hypothèse du projet » |

> ⚠️ **Validation Required** : Les procédures de ce document incluent l'**hypothèse** que le tutoriel officiel AWS ([pour le KB conventionnel](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)) est réinterprété pour Managed KB. Savoir si le connecteur S3 de Managed KB reconnaît le FSx for ONTAP S3 Access Point n'est pas officiellement confirmé, et la validation V1 doit le vérifier en premier.

---

## 1. Aperçu de la validation

La validation pour la décision de faisabilité de la migration comprend les 3 phases suivantes. Chaque phase suppose le succès de la précédente.

```
Phase A : Validation de connexion (V1, V2)
  └─ S3 AP peut-il être utilisé comme source de données / les métadonnées sont-elles préservées
       │ PASS
       ▼
Phase B : Validation d'autorisation (V3, V4, V5)
  └─ Le filtre ACL fonctionne-t-il / est-il maintenu en multi-hop / latence de propagation
       │ PASS
       ▼
Phase C : Validation d'audit et d'exploitation (V6, V7)
  └─ enregistrement de lineage / ACL sur l'historique de conversation et le cache
       │ PASS
       ▼
Décision de faisabilité de la migration (→ doc d'évaluation de migration §5)
```

> Chaque phase est réalisée sur un **volume de validation créé avec FlexClone, et non sur des données de production** (voir §4).

---

## 2. Phase A : Validation de connexion de la source de données S3 Access Point

### 2.1 Validation V1 : le connecteur S3 reconnaît-il l'URI S3 AP ?

⚠️ **Validation Required** : Le tutoriel officiel concerne le KB conventionnel, et savoir si le connecteur S3 de Managed KB accepte l'URI au format alias de S3 AP n'est pas confirmé.

**Prérequis** :

1. Créer un volume de validation avec FlexClone (procédure au §4)
2. Créer un S3 Access Point pour le volume de validation (se référer à la logique de l'existant `setup-kb-datasource.sh`)
3. Confirmer l'alias S3 AP (format : `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` ou ARN)

**Procédure de validation** :

```bash
# 1. Créer un Managed KB (stockage vectoriel managé)
#    ⚠️ Ce qui suit est une commande supposée. Vérifiez les paramètres API exacts de Managed KB dans la documentation GA
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ La façon de spécifier le stockage managé nécessite confirmation

# 2. Ajouter le connecteur S3 comme source de données et spécifier l'URI S3 AP
#    Cœur de la validation : savoir si le format alias / ARN de S3 AP est accepté
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ Savoir si ceci est accepté est l'essence de V1
    }
  }'
```

**Critères de jugement** :

| Résultat | Jugement | Action suivante |
|----------|----------|-----------------|
| ARN/alias S3 AP accepté, synchronisation réussie | ✅ PASS | Passer à V2 |
| S3 AP impossible mais un bucket S3 normal fonctionne | △ Conditionnel | Envisager un chemin de relais S3 basé sur DataSync (validation supplémentaire nécessaire pour la préservation des métadonnées ACL) |
| La synchronisation du connecteur S3 elle-même échoue | ❌ FAIL | Migration non faisable. Conserver la configuration actuelle |

> **Hypothèse du projet** : Nous supposons que la connexion est possible si l'API compatible S3 fonctionne, mais les contraintes spécifiques à S3 AP (comme la latence ListObjectsV2 notée dans la [matrice de compatibilité FSx ONTAP S3 AP](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)) peuvent affecter le crawler de Managed KB.

### 2.2 Validation V2 : préservation des métadonnées

**Procédure de validation** :

1. Placer `.metadata.json` (contenant `allowed_group_sids`) sur le volume de validation
2. Exécuter la synchronisation Managed KB
3. Récupérer un document via l'API `Retrieve` et vérifier si les métadonnées sont incluses dans la réponse

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "requête de test"}' \
  --region ap-northeast-1
# Vérifier si le champ metadata de la réponse inclut allowed_group_sids
```

**Critères de jugement** :

| Résultat | Jugement |
|----------|----------|
| `allowed_group_sids` est préservé comme métadonnée et récupérable | ✅ PASS → Passer à la Phase B |
| Les métadonnées sont manquantes ou converties dans un autre format | ❌ FAIL → Filtre ACL impossible. Conserver la configuration actuelle |

> ⚠️ La façon dont le Smart Parsing de Managed KB traite les métadonnées n'est pas confirmée. Vérifiez si l'approche sidecar `.metadata.json` fonctionne comme pour le KB conventionnel, ou si une autre méthode d'attribution de métadonnées (attributs de connecteur, etc.) est requise.

---

## 3. Phase B : Validation des défis de conception du Permission-aware RAG

L'objectif principal de ce projet est le Permission-aware RAG, et l'application stricte de l'ACL est une exigence non négociable. À moins que la validation de la Phase B ne soit validée, conserver la configuration actuelle reste la politique par défaut.

### 3.1 Invariant avec l'approche existante

L'implémentation actuelle utilise une [approche indépendante du vector store](s3-vectors-sid-architecture-guide.md).

```
Bedrock KB Retrieve → résultats de recherche + allowed_group_sids
→ Côté application (route.ts) correspondance SID utilisateur ∩ SID document (Fail-Closed)
→ Seuls les documents correspondants vont à l'API Converse
```

**Invariant à maintenir durant la migration** : « Imposer l'autorisation finale côté application, et tout refuser si la récupération du SID est impossible (Fail-Closed). » Vérifiez que Managed KB ne brise pas cet invariant.

### 3.2 Validation V3 : correspondance de tableau SID via `listContains`

Selon la [documentation du connector target AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), l'outil `Retrieve` de Managed KB prend en charge l'opérateur `listContains` dans `managedSearchConfiguration.filter` (résumé de la source).

**Procédure de validation** :

```bash
# Ne récupérer que les documents où le SID de l'utilisateur est dans le tableau allowed_group_sids
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "test de document confidentiel"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**Critères de jugement** :

| Cas de test | Résultat attendu |
|-------------|------------------|
| Document où le SID utilisateur est dans le tableau | Récupéré |
| Document où le SID utilisateur n'est pas dans le tableau | Exclu |
| Document sans `allowed_group_sids` | Exclu (Fail-Closed) |

> ⚠️ **Important** : Même si `listContains` filtre au niveau de la couche de récupération, le principe de conception de ce projet est la **ré-autorisation côté application**. Nous recommandons une défense à deux couches qui utilise le filtre Managed KB comme « filtre primaire » tout en maintenant l'autorisation finale côté application (ne pas dépendre du seul filtre).

### 3.3 Validation V4 : maintien du filtre durant le multi-hop d'Agentic Retrieval

C'est le plus grand risque spécifique à Managed KB. `AgenticRetrieveStream` décompose une requête en sous-requêtes et itère plusieurs recherches. **Si le filtre de métadonnées n'est pas maintenu à chaque hop, des données non autorisées peuvent être mélangées à une étape intermédiaire.**

**Procédure de validation** :

1. Préparer une requête complexe nécessitant de couvrir plusieurs documents avec des permissions différentes (par ex. « Comparer le document de conception confidentiel du Département A avec la spécification publique »)
2. Exécuter `AgenticRetrieveStream` en tant qu'utilisateur ne pouvant pas accéder au document non autorisé (confidentiel du Département A)
3. Inspecter la trace de chaque hop (CloudWatch / étapes intermédiaires dans la réponse) et vérifier que le document non autorisé n'est **référencé à aucun hop**

**Critères de jugement** :

| Résultat | Jugement |
|----------|----------|
| `userContext` / filtre appliqué à tous les hops, aucune donnée non autorisée référencée | ✅ PASS |
| Le filtre tombe à un hop intermédiaire et des données non autorisées se mélangent | ❌ FAIL → Désactiver le multi-hop, n'utiliser qu'un seul `Retrieve` |

> ⚠️ **Validation Required** : La propagation du filtre à chaque étape multi-hop n'est pas documentée officiellement. Si elle ne peut être confirmée lors de la validation, restreindre à un seul `Retrieve` + correspondance côté application sans utiliser `AgenticRetrieveStream` (prioriser les garanties ACL même au prix de l'abandon de l'avantage multi-hop).

### 3.4 Validation V5 : latence de propagation des changements/suppressions de permissions

**Procédure de validation** :

1. Retirer le SID d'un utilisateur d'un groupe (ou changer le `allowed_group_sids` d'un document)
2. Après la fin de la synchronisation Managed KB, refaire une recherche en tant que cet utilisateur
3. Mesurer la latence jusqu'à ce que les données à l'ancienne permission ne soient plus renvoyées

**Critères de jugement** : Savoir si la latence de propagation est dans la plage acceptable définie dans le [modèle de cohérence des permissions](permission-consistency.md) de ce projet. Si hors plage, la conception doit garantir séparément la révocation d'urgence via l'invalidation du cache côté application.

---

## 4. Modèle de validation sûre avec FlexClone

Les données de production ne doivent jamais devenir une cible de crawl direct de Managed KB. Créez un volume de validation équivalent à la production avec FlexClone et validez dans un environnement isolé.

### 4.1 Pourquoi FlexClone

| Aspect | Accès direct à la production | Validation FlexClone |
|--------|------------------------------|----------------------|
| Impact sur les E/S de production | La charge de crawl affecte les charges de travail métier | Aucun impact (le clone est indépendant) |
| Cohérence des données | Incohérence possible due aux mises à jour pendant le crawl | Cohérent à un instant donné |
| Reproductibilité de la validation | Difficile à reproduire en raison des changements de données de production | Reproductible un nombre illimité de fois depuis le même snapshot |
| Risque d'accidents | Risque d'écritures erronées sur les données de production | Le clone est jetable |
| Coût | — | Delta de snapshot uniquement (initialement quelques Mo) |

### 4.2 Procédure de création du clone de validation

```bash
# 1. Créer un snapshot du volume de production (ONTAP REST API / CLI)
#    ⚠️ Accéder à l'endpoint de gestion ONTAP depuis l'intérieur du VPC
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. Créer un FlexClone à partir du snapshot
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. Créer un S3 Access Point pour le volume cloné
#    (Réutiliser la logique de l'existant setup-kb-datasource.sh pour la validation)

# 4. Après la fin de la validation, détruire le clone (aucun impact sur la production)
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> Pour les paramètres exacts de l'API REST ONTAP, référez-vous à la section des opérations ONTAP du [Runbook d'exploitation](operations-runbook.md). Suivez les procédures de production pour les informations sur la clé SSH / l'endpoint de gestion.

### 4.3 Principes d'isolation de l'environnement de validation

- Créer le Managed KB de validation comme une **ressource distincte** du KB de production ; ne pas changer le KB ID de production
- Le S3 AP de validation ne pointe que vers le clone de validation (ne référence pas le volume de production)
- Cadrer le rôle IAM de validation avec le **moindre privilège** sur les ressources de validation (ne pas accorder l'accès en lecture aux données de production)
- Après la fin de la validation, détruire l'ensemble du clone / KB / S3 AP / rôle IAM

---

## 5. Validation d'audit et de lineage (Phase C / Optionnel)

⚠️ **Validation Required** : Savoir si l'accès via Managed KB est enregistré dans le lineage Unity Catalog de la cible d'intégration ([fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)) n'est pas confirmé.

**Aspects de validation** :

- Savoir si les appels `Retrieve` / `AgenticRetrieveStream` de Managed KB sont enregistrés dans CloudTrail
- Savoir si « qui, quand, a utilisé l'information de quel document, dans quelle réponse » est traçable
- Savoir si l'application de l'ACL à l'historique de conversation / au cache est maintenue côté application (le comportement du cache côté managé étant inconnu, le contrôler explicitement côté application)

Pour les détails des exigences d'audit, voir [Conception de gouvernance et d'audit](governance-and-audit.md).

---

## 6. Liste de vérification (résumé)

Validez tous les éléments suivants avant la décision de faisabilité de la migration.

- [ ] **V1** : Le connecteur S3 reconnaît FSx ONTAP S3 AP (Phase A)
- [ ] **V2** : `allowed_group_sids` est préservé comme métadonnée (Phase A)
- [ ] **V3** : La correspondance de tableau SID via `listContains` fonctionne (Phase B)
- [ ] **V4** : Le filtre est maintenu durant le multi-hop d'Agentic Retrieval (Phase B)
- [ ] **V5** : La latence de propagation des changements/suppressions de permissions est dans la plage acceptable (Phase B)
- [ ] **V6** : Enregistré dans CloudTrail / lineage (Phase C)
- [ ] **V7** : L'application de l'ACL à l'historique de conversation / au cache est maintenue (Phase C)
- [ ] Toute validation réalisée sur un **volume de validation FlexClone** (aucun impact sur la production)
- [ ] L'invariant de ré-autorisation Fail-Closed côté application est maintenu

> Si un élément ÉCHOUE, à moins qu'il n'existe un complément de conception pouvant tolérer ce risque, **conserver la configuration actuelle (OpenSearch Serverless / S3 Vectors)** reste la politique par défaut. L'intégration de Managed KB dans la stack CDK ne commence qu'après que toute la validation est validée.

---

## 7. Documents connexes

| Document | Contenu |
|----------|---------|
| [Évaluation de migration Managed KB](managed-kb-migration-evaluation.md) | Critères de décision / compromis / comparaison de configuration existante |
| [Guide d'architecture de stack CDK](stack-architecture-comparison.md) | Comparaison des configurations de vector store (incl. colonne Managed KB) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Conception du filtrage SID |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Approche d'autorisation indépendante du vector store |
| [Modèle de cohérence des permissions](permission-consistency.md) | Flux de propagation des changements ACL / latence acceptable |
| [Conception de gouvernance et d'audit](governance-and-audit.md) | Exigences de journal d'audit / lineage |
| [Runbook d'exploitation](operations-runbook.md) | Opérations ONTAP (procédure de création FlexClone) |

---

## Liens de référence

- [Annonce de GA d'Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [Tutoriel officiel AWS (KB conventionnel)](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [Connector target AgentCore Gateway (Managed KB)](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> Le contenu a été reformulé pour respecter les restrictions de licence. Les informations officielles AWS sont résumées et reformulées tout en préservant l'intention des sources.
