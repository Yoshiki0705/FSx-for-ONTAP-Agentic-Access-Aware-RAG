# Guide de choix de la stratégie de découpage

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | [한국어](../ko/chunking-strategy-guide.md) | [简体中文](../zh-CN/chunking-strategy-guide.md) | [繁體中文](../zh-TW/chunking-strategy-guide.md) | **Français** | [Deutsch](../de/chunking-strategy-guide.md) | [Español](../es/chunking-strategy-guide.md)

**Création**: 2026-06-07  
**Statut**: Première édition  
**Public cible**: responsables du réglage de la qualité RAG, ingénieurs de données

---

## Vue d'ensemble

La stratégie de découpage d'une Bedrock Knowledge Base agit directement sur la précision de la recherche, la qualité des réponses et le coût. Ce guide aide à choisir celle qui correspond aux caractéristiques des documents stockés sur FSx for ONTAP.

---

## Stratégies disponibles

Se règle par le contexte CDK `kbChunkingStrategy` :

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # par défaut
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **Changer la stratégie de découpage impose une resynchronisation de la source de données (réingestion).**

**Toute valeur en dehors de ces quatre lève une erreur au moment du synth.** Retomber silencieusement sur la valeur par défaut laisserait la sortie `KbChunkingStrategy` afficher la faute de frappe alors que la configuration émise indiquerait `FIXED_SIZE` : la valeur affichée et la configuration déployée seraient en désaccord. La casse est normalisée (`semantic` → `SEMANTIC`).

---

## Comparaison des stratégies

| Stratégie | Taille de bloc | Chevauchement | Précision | Coût | Adaptée à |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 jetons | 10% | ⭐⭐⭐ | 💰 faible | usage général, premier déploiement, documents de structure uniforme |
| **HIERARCHICAL** | parent 1500 / enfant 300 | 60 jetons | ⭐⭐⭐⭐ | 💰💰 moyen | rapports longs, documents hiérarchiques, documentation technique |
| **SEMANTIC** | ≤300 jetons | automatique (unités de sens) | ⭐⭐⭐⭐⭐ | 💰💰💰 élevé | corpus hétérogène, FAQ, dialogues, comptes rendus |
| **NONE** | document entier | aucun | ⭐⭐ | 💰 le plus faible | documents courts (<300 jetons), métadonnées seulement |

---

## Caractéristiques des documents et stratégie recommandée

| Caractéristiques | Recommandée | Pourquoi |
|---|---|---|
| **Documents de conception et spécifications** (hiérarchiques, longs) | HIERARCHICAL | conserve la hiérarchie chapitre → section → paragraphe, ce qui donne à la fois un contexte large et une recherche précise |
| **Contrats et documents juridiques** (par article) | SEMANTIC | détecte la frontière sémantique entre les articles et n'en coupe aucun |
| **FAQ** (paires question-réponse courtes) | SEMANTIC | garde la question et sa réponse dans le même bloc |
| **Comptes rendus et courriels** (dialogue) | SEMANTIC | découpe naturellement là où le sujet change |
| **Manuels et procédures** (étape par étape) | HIERARCHICAL | la procédure entière devient le parent et chaque étape un enfant |
| **Rapports financiers** (tableaux et chiffres) | FIXED_SIZE | la taille fixe est plus stable lorsque la structure des tableaux est complexe |
| **Avis courts** (moins d'une page) | NONE | aucun découpage nécessaire quand le document tient dans un bloc |
| **Corpus mixte** (types variés) | SEMANTIC | produit un découpage sémantiquement raisonnable quel que soit le type |

---

## Par secteur

| Secteur | Documents principaux | Recommandée | Remarques |
|---|---|---|---|
| **Industrie** | plans (parties textuelles), normes qualité, instructions de travail | HIERARCHICAL | associer les plans à un KB multimodal |
| **Services financiers** | documents réglementaires, rapports internes, rapports de conformité | SEMANTIC | préserve l'intégrité sémantique des articles |
| **Secteur public** | documents de politique, circulaires, comptes rendus | SEMANTIC | le découpage par sujet des comptes rendus compte |
| **Santé** | recommandations cliniques, procédures, articles de recherche | HIERARCHICAL | exploite la structure en chapitres |
| **Juridique** | contrats, jurisprudence, textes de loi | SEMANTIC | évite de couper les articles |
| **Éducation** | supports de cours, programmes, documents de recherche | FIXED_SIZE | structure uniforme, sensible au coût |
| **Assurance** | critères d'évaluation, rapports de détection de fraude | HIERARCHICAL | correspond à des critères de décision hiérarchiques |

---

## Caractéristiques de performance

### Durée d'ingestion

| Stratégie | 1,000 documents (estimation) | 10,000 documents (estimation) |
|---|---|---|
| FIXED_SIZE | ~5 min | ~30 min |
| HIERARCHICAL | ~8 min | ~50 min |
| SEMANTIC | ~15 min | ~90 min |
| NONE | ~3 min | ~15 min |

> SEMANTIC effectue un appel de modèle supplémentaire à chaque frontière candidate, ce qui augmente la durée d'ingestion et le coût.

### Latence de recherche

La stratégie de découpage n'agit pas directement sur la latence de recherche — la performance de la recherche vectorielle dépend de la taille de l'index. HIERARCHICAL effectue une recherche parent/enfant en deux temps et peut donc ajouter un peu de latence (~50 ms).

---

## Relation avec le RAG sensible aux permissions

**Important** : quelle que soit la stratégie de découpage, le filtrage des permissions s'applique toujours **par document**.

```
Document A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (hérité du document)
  ├── Chunk 2 → SID: [Admin, Engineering] (hérité du document)
  └── Chunk 3 → SID: [Admin, Engineering] (hérité du document)
```

- Les informations de SID dans `.metadata.json` sont attachées par document.
- Des permissions différentes par bloc ne sont pas possibles ; l'ensemble du document porte un seul jeu de permissions.
- Lorsqu'un document a besoin de permissions différentes selon ses parties, il faut le scinder en fichiers distincts.

---

## Changer de stratégie

```bash
# 1. Vérifier la stratégie actuelle
grep kbChunkingStrategy cdk.context.json

# 2. Mettre à jour le contexte CDK
# modifier cdk.context.json, ou passer la valeur en ligne de commande

# 3. Examiner le diff CDK
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. Déployer (met à jour uniquement la configuration de la source de données)
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. Resynchroniser la source de données (obligatoire)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. Attendre la fin de la réingestion
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. Évaluer la qualité (comparer avec RAGAS)
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## Comment évaluer un changement

Après un changement de stratégie, mesurez toujours :

1. **Évaluation RAGAS** : comparez fidélité, pertinence des réponses et précision du contexte avec `tests/rag-evaluation/`.
2. **Régression de la matrice de permissions** : vérifiez que le filtrage se comporte toujours sur les 31 scénarios.
3. **Temps de réponse** : contrôlez les latences P50/P95/P99 dans CloudWatch.
4. **Coût** : comparez la somme du coût d'ingestion et du coût de requête.

---

## Implémentation CDK

`buildChunkingConfiguration()` dans `lib/stacks/demo/demo-ai-stack.ts` :

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE : aucun découpage (le document entier devient un vecteur)
```

---

## Documents associés

- [Dimensionnement et performance de FSx for ONTAP](fsxn-sizing-and-performance.md)
- [Cadre d'évaluation RAG / Agent](evaluation.md)
- [Feuille de calcul d'estimation des coûts](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
