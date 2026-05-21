# Métriques d'évaluation RAG / Agent

**🌐 Language:** [日本語](../evaluation.md) | [English](../en/evaluation.md) | [한국어](../ko/evaluation.md) | [简体中文](../zh-CN/evaluation.md) | [繁體中文](../zh-TW/evaluation.md) | **Français** | [Deutsch](../de/evaluation.md) | [Español](../es/evaluation.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Évaluateurs PoC, chefs de projet, personnel d'assurance qualité

---

## Aperçu

Ce document fournit des définitions de métriques et des méthodes d'évaluation pour évaluer quantitativement la qualité et l'efficacité du système RAG sensible aux permissions. L'évaluation est menée selon 4 axes : KPI métier, Qualité RAG, Contrôle des permissions et Performance de l'Agent.

---

## Cadre d'évaluation

```
┌─────────────────────────────────────────────────────────────┐
│                    4 axes d'évaluation                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ KPI métier   │  │ Qualité RAG  │  │ Contrôle des │       │
│  │              │  │              │  │ permissions  │       │
│  │ ・Réduction  │  │ ・Précision  │  │ ・Taux de    │       │
│  │   temps rech.│  │   réponses   │  │   violation  │       │
│  │ ・Résolution │  │ ・Fidélité   │  │ ・Faux pos.  │       │
│  │   1er appel  │  │              │  │ ・Faux nég.  │       │
│  │ ・Réduction  │  │ ・Précision  │  │ ・Délai de   │       │
│  │   demandes   │  │   contexte   │  │   propagation│       │
│  │ ・Taux       │  │ ・Temps de   │  │              │       │
│  │   utilisation│  │   réponse    │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐                                            │
│  │ Perf. Agent  │                                            │
│  │              │                                            │
│  │ ・Succès     │                                            │
│  │   tâches     │                                            │
│  │ ・Précision  │                                            │
│  │   outils     │                                            │
│  │ ・Taux       │                                            │
│  │   escalade   │                                            │
│  │ ・Coût/tâche │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. KPI métier

### Définitions et méthodes de mesure

| KPI | Définition | Cible (PoC) | Méthode de mesure |
|-----|-----------|-------------|-------------------|
| Taux de réduction du temps de recherche | Gain de temps par rapport à la recherche manuelle traditionnelle | 50 %+ | Enquête utilisateur + comparaison d'horodatages |
| Taux de résolution au premier appel | Pourcentage résolu par la réponse IA seule | 60 %+ | Retour utilisateur (👍/👎) |
| Taux de réduction des demandes | Diminution des demandes au helpdesk | 30 %+ | Comparaison avant/après du nombre de tickets |
| Taux de citation | Pourcentage de réponses avec citations | 90 %+ | Agrégation automatique de la présence de citations |
| Nombre de violations de permissions | Nombre de documents non autorisés affichés | 0 | Test de matrice de permissions + journaux d'audit |
| Taux d'utilisateurs actifs mensuels | Taux d'utilisation mensuel parmi les utilisateurs enregistrés | 70 %+ | Cognito + journaux d'accès |

### Tableau de bord de mesure

Visualiser les éléments suivants sur le tableau de bord CloudWatch (`enableMonitoring=true`) :

- Nombre de requêtes de recherche quotidien/hebdomadaire
- Fréquence d'utilisation par utilisateur
- Taux de succès de génération de réponses
- Temps de réponse moyen (P50/P95/P99)
- Taux d'intervention Guardrails

---

## 2. Métriques de qualité RAG

### 2.1 Pertinence des réponses

**Définition** : Degré de pertinence de la réponse générée par rapport à la question de l'utilisateur

**Méthode d'évaluation** :
- Évaluation humaine : Échelle à 5 points (1 : Non pertinent – 5 : Parfaitement pertinent)
- Évaluation automatisée : LLM-as-Judge (notation automatique par Claude)

**Cible** : Moyenne 4,0+ (échelle à 5 points)

### 2.2 Fidélité

**Définition** : Si la réponse générée est fidèle au contenu des documents récupérés (pas d'hallucination)

**Méthode d'évaluation** :
- Vérifier chaque affirmation de la réponse par rapport aux documents cités
- Mesurer la proportion d'affirmations non étayées

**Formule** :
```
Fidélité = (Nombre d'affirmations étayées) / (Total des affirmations dans la réponse)
```

**Cible** : 0,90+

### 2.3 Précision du contexte

**Définition** : Proportion de documents récupérés ayant effectivement contribué à la génération de la réponse

**Méthode d'évaluation** :
- Déterminer si chaque document dans les résultats de recherche a été utilisé dans la réponse
- Les documents mieux classés sont pondérés plus fortement

**Formule** :
```
Précision du contexte = Σ(Precision@k × relevance@k) / (Nombre de documents pertinents)
```

**Cible** : 0,80+

### 2.4 Taux de violation de permissions

**Définition** : Proportion de résultats de recherche contenant des documents non autorisés

**Méthode d'évaluation** :
- Exécuter la même requête avec des utilisateurs de test (différents niveaux de permissions)
- Vérifier qu'aucun document non autorisé n'apparaît dans les résultats de recherche de chaque utilisateur

**Formule** :
```
Taux de violation de permissions = (Nombre d'affichages de documents non autorisés) / (Nombre total de recherches)
```

**Cible** : 0 % (tolérance zéro)

### 2.5 Latence de réponse

| Percentile | Cible (Mode KB) | Cible (Mode Agent) |
|-----------|-----------------|-------------------|
| P50 | < 3 s | < 8 s |
| P95 | < 8 s | < 20 s |
| P99 | < 15 s | < 30 s |

---

## 3. Métriques de contrôle des permissions

### 3.1 Matrice de test

| Cas de test | Résultat attendu | Méthode de vérification |
|-------------|-----------------|-------------------------|
| L'admin recherche des documents confidentiels | Affichés | Confirmer la correspondance SID |
| L'utilisateur général recherche des documents confidentiels | Non affichés | Confirmer la non-correspondance SID |
| Tous les utilisateurs recherchent des documents Everyone | Affichés pour tous | Confirmer la correspondance S-1-1-0 |
| L'utilisateur sans SID recherche | Refuser tout (Fail-Closed) | Comportement sans enregistrement DynamoDB |
| L'utilisateur recherche immédiatement après l'ajout au groupe | Documents du nouveau groupe affichés | Vérifier le comportement après AD Sync |
| L'utilisateur recherche immédiatement après le retrait du groupe | Documents de l'ancien groupe masqués | Vérifier le comportement après TTL cache |

### 3.2 Tests de cas limites

| Cas | Comportement attendu | Notes |
|-----|---------------------|-------|
| Conflit Allow / Deny | Deny prioritaire (ce système utilise uniquement une liste Allow) | Les ACE Deny NTFS ACL ne sont pas reflétées dans `.metadata.json` par conception |
| Imbrication de groupes | Autorisé par le SID du groupe parent | Les groupes imbriqués AD gérés comme liste SID étendue |
| Permissions héritées vs explicites | Les deux SID inclus dans `.metadata.json` | Tous les SID de permissions effectives énumérés |
| Permissions après Rename / Move | Les permissions héritées de la destination s'appliquent | Régénération de `.metadata.json` requise |
| Accès mixte SMB et NFS | Dépend du style de sécurité | Style NTFS : SID, Style UNIX : UID/GID |
| Utilisateur avec SID non résolvable | Fail-Closed (refuser tout) | Pas de données SID dans DynamoDB |
| Recherche immédiatement après le retrait de permissions | Recherche possible avec anciennes permissions dans le TTL cache | Délai max 5 min (vidage manuel pour les urgences) |

---

## 4. Métriques d'évaluation de l'Agent

### 4.1 Taux de succès des tâches

**Définition** : Pourcentage de tâches correctement complétées par l'Agent

**Formule** :
```
Taux de succès des tâches = (Tâches correctement complétées) / (Total des tâches)
```

**Cible** : 80 %+

### 4.2 Précision des appels d'outils

**Définition** : Pourcentage d'appels d'outils appropriés avec des paramètres appropriés par l'Agent

**Éléments d'évaluation** :
- Sélection correcte de l'outil
- Paramétrage correct
- Évitement des appels d'outils inutiles

**Cible** : 90 %+

### 4.3 Taux d'escalade humaine

**Définition** : Pourcentage de cas où l'Agent a déféré le jugement à un humain

**Formule** :
```
Taux d'escalade = (Nombre d'escalades) / (Total des tâches)
```

**Cible** : 20 % ou moins (acceptable pour les tâches complexes)

### 4.4 Coût par tâche

**Formule** :
```
Coût par tâche = (Tokens d'entrée × prix d'entrée + Tokens de sortie × prix de sortie) / Nombre de tâches
```

**Estimations** :
| Modèle | Prix d'entrée | Prix de sortie | Coût moyen par tâche |
|--------|--------------|----------------|---------------------|
| Claude Haiku | 0,001 $/1K | 0,005 $/1K | 0,005–0,02 $ |
| Claude Sonnet | 0,003 $/1K | 0,015 $/1K | 0,02–0,10 $ |
| Claude Opus | 0,015 $/1K | 0,075 $/1K | 0,10–0,50 $ |

---

## Modèle d'évaluation (résumé 1 page)

### Modèle de rapport d'évaluation PoC

```markdown
# Rapport d'évaluation PoC RAG sensible aux permissions

## Période d'évaluation : AAAA/MM/JJ – AAAA/MM/JJ
## Évaluateur : [Nom]
## Nombre d'utilisateurs cibles : XX utilisateurs

### KPI métier
| Métrique | Cible | Réel | Jugement |
|----------|-------|------|----------|
| Taux de réduction du temps de recherche | 50 % | __% | ⬜ |
| Taux de résolution au premier appel | 60 % | __% | ⬜ |
| Nombre de violations de permissions | 0 | __ | ⬜ |
| Taux de citation | 90 % | __% | ⬜ |

### Qualité RAG
| Métrique | Cible | Réel | Jugement |
|----------|-------|------|----------|
| Pertinence des réponses | 4,0/5 | __/5 | ⬜ |
| Fidélité | 0,90 | __ | ⬜ |
| Précision du contexte | 0,80 | __ | ⬜ |
| Violation de permissions | 0 % | __% | ⬜ |

### Performance de réponse
| Métrique | Cible | Réel | Jugement |
|----------|-------|------|----------|
| Latence P50 | < 3 s | __s | ⬜ |
| Latence P95 | < 8 s | __s | ⬜ |

### Performance de l'Agent (lorsque le mode Agent est utilisé)
| Métrique | Cible | Réel | Jugement |
|----------|-------|------|----------|
| Taux de succès des tâches | 80 % | __% | ⬜ |
| Précision des appels d'outils | 90 % | __% | ⬜ |
| Coût par tâche | < 0,05 $ | $__ | ⬜ |

### Jugement global
- [ ] Succès du PoC (production recommandée)
- [ ] Succès conditionnel (réévaluer après améliorations)
- [ ] Vérification supplémentaire nécessaire

### Éléments d'amélioration / Prochaines actions
1. 
2. 
3. 
```

---

## Comparaison modèle / coût / latence

### Sélection du magasin vectoriel

| Aspect | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Coût mensuel (petite échelle) | 5–20 $ | 700+ $ |
| Latence de requête | 100 ms–1 s | 50 ms–200 ms |
| Échelle recommandée | ~10 000 documents | 10 000+ documents |
| Utilisation recommandée | PoC, production petite échelle | Production à QPS élevé |

### Sélection du modèle d'embedding

| Modèle | Dimensions | Multilingue | Coût | Utilisation recommandée |
|--------|-----------|-------------|------|-------------------------|
| Titan Embed Text v2 | 1024 | ✅ | 0,0001 $/1K tokens | Par défaut (efficace en coût) |
| Nova Multimodal | 1024 | ✅ | 0,0002 $/image | Recherche multimodale |

### Sélection du modèle de génération

| Modèle | Cas d'utilisation | Coût d'entrée | Coût de sortie | Latence |
|--------|-------------------|--------------|----------------|---------|
| Claude Haiku | Questions simples, Smart Routing : simple | 0,001 $/1K | 0,005 $/1K | ~2 s |
| Claude Sonnet | Questions analytiques, Smart Routing : complex | 0,003 $/1K | 0,015 $/1K | ~5 s |
| Claude Opus | Grand contexte, Smart Routing : full-context | 0,015 $/1K | 0,075 $/1K | ~10 s |

### Modèle d'estimation des coûts mensuels

```
Paramètres d'entrée :
  Nombre de documents : _____ fichiers
  Taille moyenne des documents : _____ Ko
  Nombre de chunks (estimé) : Nombre de documents × Taille moyenne / 512
  Nombre de requêtes quotidiennes : _____ requêtes
  Tokens d'entrée moyens/requête : _____ tokens
  Tokens de sortie moyens/requête : _____ tokens

Calcul des coûts :
  Embedding (initial) : Nombre de chunks × Taille moyenne du chunk × 0,0001 $/1K = $____
  Embedding (incrémental mensuel) : Chunks modifiés × Taille moyenne du chunk × 0,0001 $/1K = $____
  Génération (mensuel) : Requêtes quotidiennes × 30 × (tokens d'entrée × prix d'entrée + tokens de sortie × prix de sortie) = $____
  Magasin vectoriel : S3 Vectors $____ ou OpenSearch Serverless $____
  FSx for ONTAP : débit + SSD + pool de capacité = $____
  Autres (Lambda, CloudFront, DynamoDB) : $____
  
  Total mensuel : $____
```

---

## Documents associés

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de vérification pour la mise en production |
| [governance-and-audit.md](governance-and-audit.md) | Conception de la gouvernance et de l'audit |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guide d'expérimentation sécurisée |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionnement et performance FSx for ONTAP |
