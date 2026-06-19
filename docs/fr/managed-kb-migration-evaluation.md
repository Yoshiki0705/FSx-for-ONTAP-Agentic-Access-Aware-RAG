# Évaluation du chemin de migration vers Amazon Bedrock Managed Knowledge Base

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | [한국어](../ko/managed-kb-migration-evaluation.md) | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | **Français** | [Deutsch](../de/managed-kb-migration-evaluation.md) | [Español](../es/managed-kb-migration-evaluation.md)

**Date de création** : 2026-06-18
**Région cible** : ap-northeast-1 (Tokyo) — Managed KB est disponible dans la région de Tokyo
**Statut** : Document d'évaluation (migration non effectuée / chemin existant conservé)
**Connexe** : `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md` (origine)

---

## 0. Objet de ce document

Ce document évalue le **chemin de migration** pour faire évoluer la configuration Permission-aware RAG existante de ce dépôt (Bedrock KB + OpenSearch Serverless / S3 Vectors) vers [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/), devenu disponible (GA) lors de l'AWS Summit New York 2026 (2026-06-17).

Hypothèses clés :

- Ce document est un **document d'évaluation** ; il ne recommande pas une migration immédiate.
- Le chemin existant (Bedrock KB + OpenSearch Serverless / S3 Vectors) n'est **pas supprimé**.
- Le contenu est classé en deux niveaux de preuve.

| Niveau | Définition | Traitement dans ce document |
|--------|-----------|------------------------------|
| Public evidence | Vérifiable depuis la documentation/les blogs officiels AWS | Cité avec liens vers les sources |
| Project-context expectation | Décisions/attentes de conception au sein de ce projet (non vérifiables publiquement) | Étiqueté « hypothèse du projet » |

> ⚠️ **Distinction discipline** : Nous séparons clairement la « description générale d'une fonctionnalité » du « comportement vérifié dans ce projet ». Les descriptions des fonctionnalités de Managed KB sont des explications générales basées sur des informations publiques AWS ; le comportement d'intégration ACL dans ce projet est **non vérifié** (voir les points de vérification ci-dessous).

---

## 1. Principales fonctionnalités de Managed KB (Public evidence)

Basé sur le [blog Introducing Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) et l'[annonce de GA](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/). Le contenu a été reformulé pour respecter les restrictions de licence tout en préservant l'intention de la source.

| Fonctionnalité | Aperçu | Pertinence pour ce projet |
|----------------|--------|---------------------------|
| 6 connecteurs de données natifs | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler. Ingère automatiquement données et permissions | La question clé est de savoir si le **connecteur S3** peut se connecter au FSx for ONTAP S3 Access Point |
| Smart Parsing | Sélectionne automatiquement la stratégie de parsing optimale par type de données et connecteur (PDF, Office, tableaux, multimodal) | Pourrait automatiser la sélection manuelle de stratégie de chunking existante |
| Agentic Retriever | Décompose les requêtes complexes en sous-requêtes et exécute une récupération multi-hop itérative | Nécessite une ré-autorisation dans le contexte Permission-aware (voir ci-dessous) |
| Stockage vectoriel managé | Pas de provisionnement de DB vectorielle. Optimisé prix/performance | Supprime la charge opérationnelle d'OpenSearch Serverless / S3 Vectors |
| Intégration AgentCore Gateway | Exposé comme connector target intégré (MCP) avec deux outils : `Retrieve` et `AgenticRetrieveStream` | Intégrable avec l'AgentCore Gateway de ce projet (déjà implémenté) |
| Compatibilité API existante | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` etc. sont identiques | Changement de KB ID uniquement, pas de changement de code (affirmation AWS, à vérifier) |
| Régions | GA dans plusieurs régions dont Tokyo | Cohérent avec le déploiement ap-northeast-1 |

### Modèle de tarification (Public evidence)

Selon la [description d'AWS](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/), la facturation comporte deux dimensions (taille des données indexées + nombre de récupérations à la demande). Aucun engagement initial.

> ⚠️ **Note sur l'estimation des coûts** : Ce qui précède est la structure du modèle de tarification publié ; le coût réel pour la charge de travail de ce projet n'est pas mesuré. Avant toute décision de migration, effectuez une comparaison des coûts unitaires entre « l'actuel (OpenSearch Serverless OCU / stockage S3 Vectors) » et « Managed KB (taille des données + nombre de récupérations) » en utilisant les volumes de requêtes et de données attendus.

---

## 2. Comparaison avec la configuration existante

### 2.1 Comparaison d'architecture

| Aspect | Actuel (Custom : Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|--------|-------------------------------------------------------------------|------------|
| Exploitation du vector store | Autogéré (conception OCU AOSS / gestion d'index S3 Vectors) | Entièrement managé (pas de provisionnement) |
| Source de données | FSx ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | Via connecteur S3 (connexion S3 AP à vérifier) |
| Parsing et chunking | Sélection manuelle via `kbChunkingStrategy` (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing sélectionne automatiquement (personnalisable) |
| Modèle d'embedding | Fixé au déploiement (`embeddingModel`, changement nécessite recréation) | Auto-sélectionné par défaut + modèle Bedrock optionnel |
| Récupération | Retrieve unique + filtre SID côté application | `Retrieve` (hybride unique) + `AgenticRetrieveStream` (multi-hop) |
| Filtre ACL | Correspondance `allowed_group_sids` côté application (indépendant du vector store) | Opérateurs `filter` de métadonnées + `userContext` (à vérifier) |
| Intégration Gateway | Personnalisée (AgentCore Gateway + Permission Interceptor implémentés) | Connector target intégré |
| Charge opérationnelle | Moyenne (conception du vector store / pipeline requise) | Faible (managé) |
| Personnalisabilité | Élevée (tous les composants contrôlables) | Moyenne (ajustable dans le périmètre managé) |

### 2.2 Approche de filtrage SID existante (Project-context)

Selon [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md), ce projet utilise l'approche indépendante du vector store suivante.

```
Bedrock KB Retrieve API → résultats de recherche + métadonnées(allowed_group_sids)
→ côté application (route.ts) correspondance SID utilisateur ∩ SID document
→ seuls les documents correspondants vont à Converse API
→ Fail-Closed : tout refuser si la récupération du SID échoue
```

La force de cette approche est que **la logique d'autorisation côté application reste inchangée** même si le vector store (AOSS / S3 Vectors) change. Le point le plus critique est de savoir si cet invariant peut être préservé après migration vers Managed KB.

---

## 3. Critères de décision de migration

Cadré comme « le bon outil pour la tâche », et non « remplacer un concurrent ». Les compromis des deux configurations sont énoncés de façon symétrique.

### 3.1 Quand envisager la migration vers Managed KB

- Vous voulez **réduire la charge opérationnelle/de conception** du vector store (OpenSearch Serverless OCU / index S3 Vectors)
- Vous voulez tirer parti de Smart Parsing pour le **parsing automatique de documents multi-formats** (PDF, Office, tableaux)
- Vous recherchez des améliorations de précision pour les **requêtes complexes multi-hop** via Agentic Retriever
- Vous voulez **adopter de nouveaux modèles d'embedding/re-ranking sans reconstruire l'infrastructure**
- Vous voulez intégrer dans une architecture centrée sur AgentCore Gateway et **simplifier la connexion via un connector target intégré**

### 3.2 Quand conserver la configuration actuelle

- Vous avez une **exigence d'appliquer strictement l'ACL au niveau fichier (NTFS / SID) au moment de la récupération** et voulez un contrôle total du comportement de correspondance `allowed_group_sids`
- Vous avez une **logique personnalisée de reflet immédiat** des changements de permissions, suppressions et renommages (la capacité de la synchronisation managée à l'égaler est non vérifiée)
- Vous voulez un **contrôle fin du filter / ranking / reranking du vector store**
- Vous ne voulez pas compromettre les garanties Fail-Closed de production alors que **la rétention/le filtrage des métadonnées ACL dans le stockage managé est non vérifié**
- Les exigences de souveraineté des données ou d'audit imposent de **gérer explicitement où les données vectorielles sont stockées**

### 3.3 Flux de décision

```
Devez-vous appliquer strictement l'ACL au moment de la récupération ?
├─ OUI → Pouvez-vous valider tous les points de vérification du §4 ?
│        ├─ OUI → Envisager une migration progressive (§5)
│        └─ NON → Conserver la configuration actuelle (prioriser la garantie ACL)
└─ NON → Prioriser la charge opérationnelle / précision ; envisager Managed KB
```

> ⚠️ L'objectif principal de ce projet est le **Permission-aware RAG**, et l'application stricte de l'ACL est une exigence non négociable. Par conséquent, à moins que la vérification du §4 ne soit validée, conserver la configuration actuelle est la politique par défaut.

---

## 4. Impact sur le Permission-aware RAG (le plus critique)

Le filtre ACL basé sur SID de ce projet peut-il être préservé avec le stockage managé de Managed KB ? Nous organisons les preuves publiques et les points de vérification.

### 4.1 Public evidence : méthodes de contrôle d'accès de Managed KB

Selon la [documentation du connector target AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), Managed KB dispose de deux méthodes de contrôle d'accès.

**(A) Opérateurs `filter` de métadonnées (outil `Retrieve`)**

`managedSearchConfiguration.filter` prend en charge ces opérateurs (en résumant l'intention de la source) :
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains` pourrait être utilisable pour faire correspondre un SID utilisateur avec `allowed_group_sids` (un tableau)**. Cela pourrait pousser la correspondance côté application actuelle vers la couche de récupération.

**(B) Filtrage de contrôle d'accès via `userContext`**

Selon la documentation, lorsqu'un KB applique un contrôle d'accès par utilisateur/groupe, l'application appelante inclut `userContext` (par ex. `userId`) dans la requête. Le Gateway le transmet au KB, qui applique le filtrage en fonction de `userContext`. Point critique : **le Gateway ne renseigne pas `userContext` à partir de l'identité IAM de l'appelant — l'application doit le fournir explicitement**. Il est également indiqué explicitement que **`userContext` est fourni par l'application, pas par le modèle**.

→ Cette conception « l'application le fournit explicitement » / « pas laissé au modèle » s'aligne directionnellement avec le principe **Fail-Closed, imposé par l'application** de ce projet.

### 4.2 Points de vérification (à confirmer avant la migration)

Tous les éléments suivants sont **non vérifiés** et déterminent la faisabilité de la migration. Les hypothèses Project-context sont indiquées à côté.

| # | Élément de vérification | Hypothèse du projet | Risque |
|---|-------------------------|---------------------|--------|
| V1 | Le connecteur S3 peut-il utiliser le **FSx ONTAP S3 Access Point** comme source de données (format alias, frontière IAM) ? | Supposé connectable si compatible S3 | Si non connectable, la migration est infaisable |
| V2 | Le `allowed_group_sids` de `.metadata.json` est-il **conservé comme métadonnée** dans l'index Managed KB ? | Supposé conservé | Si non conservé, le filtre ACL est impossible |
| V3 | Le `filter` de `Retrieve` fonctionne-t-il pour la **correspondance de tableau SID via `listContains`** ? | Supposé fonctionnel | Sinon, passer à la méthode userContext |
| V4 | La méthode `userContext` est-elle valide pour les **données ingérées par connecteur S3** (pas uniquement les connecteurs SaaS) ? | Inconnu si valide pour S3 | Si invalide pour S3, dépend de la méthode filter |
| V5 | L'ACL est-elle appliquée à **chaque étape de `AgenticRetrieveStream` (multi-hop)** ? | Application par étape requise | Risque que des données non autorisées entrent aux étapes intermédiaires |
| V6 | La **latence de reflet des changements/suppressions/renommages de permissions** est-elle acceptable dans le stockage managé ? | Attente de la même immédiateté qu'actuellement | Risque de données à permissions obsolètes dû au délai de reflet |
| V7 | L'**application de l'ACL est-elle maintenue pour l'historique de conversation/le cache** ? | Maintenue côté application | Comportement du cache côté managé inconnu |

> ⚠️ **Non négociable** : Si V2, V3 (ou V4) ou V5 n'est pas satisfait, la migration est **BLOCKED** car **des données non autorisées pourraient entrer dans les résultats de recherche**. Cela violerait les exigences non négociables de la revue d'architecture FSxN AI/RAG (« une conception où des données non autorisées peuvent entrer dans les résultats de vector search », « une conception sans contrôle d'autorisation sur le contexte passé au LLM »).

### 4.3 Maintien de la défense en profondeur

Même lors de la migration, maintenez la défense en profondeur sans dépendre d'une seule méthode.

```
1. Authentification utilisateur via IdP / Cognito / AD
2. Récupérer le principal utilisateur / les SID de groupe (DynamoDB user-access)
3. filter (listContains) ou userContext au moment de la récupération Managed KB
4. ★ Re-correspondance ACL côté application juste avant l'injection du contexte LLM (conserver la logique route.ts actuelle) ★
5. Ré-autorisation après chaque étape lors de l'utilisation d'AgenticRetrieveStream
6. Ré-autorisation lors de l'affichage des liens de source de citation
7. Journal d'audit (qui a utilisé quelle information dérivée d'un SID, et quand)
```

→ Même en utilisant le filtrage côté Managed KB, nous **recommandons fortement de conserver l'étape 4 (correspondance ACL finale côté application)**. Cela garantit le Fail-Closed même si le filtre côté managé se comporte différemment de l'attendu.

---

## 5. Chemin de migration (progressif / chemin existant conservé)

Comme le modèle de migration Dual KB existant ([migration-guide-multimodal.md](../en/migration-guide-multimodal.md)), vérifiez par étapes avec un **fonctionnement parallèle**. Le chemin existant n'est pas supprimé.

### Phase 0 : Vérification PoC (pas d'impact sur la production)

1. Créer un Managed KB avec un petit jeu de données de vérification (données cohérentes depuis Snapshot / FlexClone recommandées)
2. Vérifier V1–V7 du §4.2 dans l'ordre
3. Confirmer le comportement du filtrage SID (filter / userContext) par rapport aux 31 scénarios de [tests/permission-matrix/](../../tests/permission-matrix/)

### Phase 1 : Fonctionnement parallèle (Shadow)

1. Conserver le KB existant et exécuter le Managed KB comme **shadow en lecture seule** en parallèle
2. Envoyer des requêtes identiques aux deux systèmes et comparer les résultats de recherche, les résultats du filtre ACL et la cohérence des citations
3. Comparer la précision et la citation precision avec RAGAS etc. ([evaluation.md](evaluation.md))

### Phase 2 : Migration progressive (Canary)

1. Utiliser les tests A/B d'AgentCore Gateway (AgentCore Optimization — déjà implémenté dans ce dépôt) pour router une partie du trafic vers le chemin Managed KB
2. Confirmer que tous les tests de permissions (Fail-Closed, imbrication de groupes, cas limites d'ACL) passent
3. Après confirmation de la significativité statistique, déplacer progressivement le trafic

### Phase 3 : Décision de bascule

- Toutes les vérifications validées → faire de Managed KB le chemin par défaut
- Tout élément non satisfait → conserver la configuration actuelle ; garder Managed KB en shadow ou le retirer

> Nous recommandons de conserver le chemin existant (Bedrock KB + OpenSearch Serverless / S3 Vectors) comme **chemin de rollback pendant une période** même après l'achèvement de la migration.

---

## 6. Liste de vérification

Confirmez tous les éléments suivants avant une décision de migration.

### Fondation des données
- [ ] V1 : Le connecteur S3 peut enregistrer FSx ONTAP S3 AP comme source de données
- [ ] PoC effectué avec des données cohérentes depuis Snapshot / FlexClone
- [ ] Les données de production ne sont pas soumises à un crawling direct intensif

### Permission-aware RAG (le plus critique)
- [ ] V2 : `allowed_group_sids` est conservé comme métadonnée
- [ ] V3 ou V4 : Le filtre SID fonctionne via le filter `listContains` ou `userContext`
- [ ] V5 : L'ACL est appliquée à chaque étape d'AgenticRetrieveStream
- [ ] L'étape 4 de défense en profondeur (correspondance finale côté application) est maintenue
- [ ] Fail-Closed : tout refuser quand la récupération du SID échoue
- [ ] Les 31 scénarios de test de permissions passent

### Cycle de vie des données
- [ ] V6 : La latence de reflet des changements/suppressions/renommages de permissions est acceptable
- [ ] V7 : L'ACL est appliquée à l'historique de conversation/au cache

### Coût et performance
- [ ] Comparaison des coûts unitaires actuel vs Managed KB effectuée (taille des données + nombre de récupérations)
- [ ] Estimation mensuelle créée pour le volume de requêtes attendu

### Exploitation
- [ ] Procédure de rollback (retour au chemin existant) documentée dans un runbook
- [ ] Historique d'utilisation traçable via le journal d'audit

---

## 7. Recommandation

**Verdict actuel : REQUEST CHANGES (migration en attente jusqu'à la fin de la vérification)**

Conditions de levée :

1. Vérifier les points V1–V7 du §4.2 via un PoC
2. Valider spécifiquement **V2, V3 (ou V4) et V5** (BLOCKED si non satisfait)
3. La conception doit maintenir l'étape 4 de défense en profondeur (correspondance ACL finale côté application)
4. La comparaison des coûts montre l'absence de désavantage vs l'actuel, ou la réduction de la charge opérationnelle l'emporte sur toute augmentation des coûts

**Justification :**

- La réduction de la charge opérationnelle, le Smart Parsing et l'Agentic Retriever de Managed KB offrent une valeur claire pour ce projet (public evidence).
- Cependant, l'**exigence prioritaire de ce projet est l'application stricte de l'ACL pour le Permission-aware RAG**, et le comportement du filtre SID dans le stockage managé est **non vérifié**.
- `userContext` (fourni par l'application, indépendant du modèle) et le filter `listContains` s'alignent directionnellement, donc **la migration est tout à fait faisable selon la vérification**.

> Ce document est une évaluation. La migration réelle ne doit être effectuée qu'après la vérification ci-dessus et l'approbation via la revue concernée (revue d'architecture FSxN AI/RAG).

---

## Documents connexes

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Procédures de validation Managed KB (validation de connexion S3 AP / modèle de validation sûre FlexClone)
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — Conception fondamentale du filtrage SID
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — Intégration S3 Vectors + SID
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — Configuration de stack existante et quotas KB
- [metadata-json-schema.md](metadata-json-schema.md) — Schéma de métadonnées `allowed_group_sids`
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Modèle de référence pour la migration progressive Dual KB (en anglais)
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — Stratégie de chunking actuelle
- [evaluation.md](evaluation.md) — Méthodes d'évaluation RAG
