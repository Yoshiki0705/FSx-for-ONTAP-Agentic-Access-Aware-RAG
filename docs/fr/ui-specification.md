# Spécification de l'interface utilisateur du chatbot

**🌐 Language:** [日本語](../ui-specification.md) | [English](../en/ui-specification.md) | [한국어](../ko/ui-specification.md) | [简体中文](../zh-CN/ui-specification.md) | [繁體中文](../zh-TW/ui-specification.md) | **Français** | [Deutsch](../de/ui-specification.md) | [Español](../es/ui-specification.md)

**Date de création** : 2026-03-26  
**Public cible** : Développeurs et opérateurs  
**Application** : Chatbot RAG sensible aux permissions

---

## Vue d'ensemble

Ce document décrit les spécifications de chaque élément d'interface utilisateur du chatbot RAG et son intégration avec le backend.

---

## 1. Barre latérale — Section informations utilisateur

### Contenu affiché

| Élément | Source de données | Description |
|------|------------|-------------|
| Nom d'utilisateur | Cognito JWT | Adresse e-mail à la connexion |
| Rôle | Cognito JWT | `admin` ou `user` |

### Affichage des permissions d'accès

| Élément | Source de données | Description |
|------|------------|-------------|
| Répertoire | `/api/fsx/directories` | Répertoires accessibles basés sur les SID |
| Lecture | Idem | `✅` si les données SID existent |
| Écriture | Idem | `✅` uniquement si l'utilisateur a le SID Domain Admins |

### Fonctionnement des répertoires accessibles

Le message d'introduction affiche trois types d'informations de répertoire.

| Élément | Icône | Source de données | Description |
|------|------|------------|-------------|
| Répertoires accessibles FSx | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | Répertoires accessibles au niveau fichier sur FSx ONTAP |
| Répertoires recherchables RAG | 🔍 | Correspondance SID dans `.metadata.json` S3 | Répertoires de documents correspondant au SID dans la recherche KB |
| Répertoires cibles d'Embedding | 📚 | Tous les `.metadata.json` dans le bucket S3 | Tous les répertoires indexés dans la KB |

#### Exemples d'affichage par utilisateur

| Utilisateur | Accès FSx | Recherche RAG | Cible d'Embedding |
|------|-----------|---------|----------------|
| admin@example.com | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` (affiché) |
| user@example.com | `public/` | `public/` | Masqué (cache l'existence des répertoires inaccessibles pour la sécurité) |

Les répertoires cibles d'Embedding ne sont pas affichés aux utilisateurs généraux (pour éviter de révéler l'existence de répertoires auxquels ils ne peuvent pas accéder). Les 📚 répertoires cibles d'Embedding ne sont affichés que lorsque les répertoires recherchables RAG et les répertoires cibles d'Embedding sont identiques, comme c'est le cas pour les administrateurs.

---

## 2. Barre latérale — Section région Bedrock

### Contenu affiché

| Élément | Source de données | Description |
|------|------------|-------------|
| Nom de la région | `RegionConfigManager` | Nom d'affichage de la région sélectionnée |
| ID de la région | `regionStore` | Ex. : `ap-northeast-1` |
| Nombre de modèles | `/api/bedrock/region-info` | Nombre de modèles disponibles dans la région sélectionnée |

### Flux de changement de région

```
User selects a region
  ↓
RegionSelector → /api/bedrock/change-region (POST)
  ↓
Update Cookie bedrock_region
  ↓
Page reload
  ↓
/api/bedrock/region-info → Retrieve model list for the new region
  ↓
/api/bedrock/models → Update model selector
```

---

## 3. Section de sélection du modèle IA

### Récupération de la liste des modèles

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
Auto-detect provider via provider-patterns.ts
  ↓
Return all models (including Unknown providers)
```

### Fournisseurs supportés (13)

amazon, anthropic, cohere, deepseek, google, minimax, mistral, moonshot, nvidia, openai, qwen, twelvelabs, zai

### Chaîne de repli

```
Selected model → (failure) → apac.amazon.nova-lite-v1:0 → (failure) → anthropic.claude-3-haiku-20240307-v1:0
```

Essaie automatiquement le modèle suivant lors d'erreurs de modèle Legacy, d'erreurs d'indisponibilité on-demand ou de ValidationException.

---

## 4. Zone de chat — Message d'introduction

### Contenu affiché

Un message initial généré automatiquement après la connexion.

| Section | Contenu |
|---------|---------|
| Salutation | Message de bienvenue incluant le nom d'utilisateur |
| Permissions d'accès | Nom d'utilisateur, rôle, répertoires accessibles |
| Type d'environnement | Basé sur SID / Production FSx / Simulation |
| Détails des permissions | Disponibilité lecture / écriture / exécution |
| Fonctionnalités disponibles | Recherche de documents et Q&R, contrôle d'accès basé sur les permissions |

### Support multilingue

Supporte 8 langues (ja, en, de, es, fr, ko, zh-CN, zh-TW). Les clés de traduction sont définies dans la section `introduction` de `docker/nextjs/src/messages/{locale}.json`.

---

## 5. Zone de chat — Flux de recherche RAG

### Méthode en deux étapes (Retrieve + Converse)

```
User question
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
Step 1: DynamoDB user-access → Retrieve user SID
  ↓
Step 2: Bedrock KB Retrieve API → Vector search (with metadata)
  ↓
Step 3: SID Filtering
  - Match document's allowed_group_sids against user SID
  - Match → ALLOW, Mismatch → DENY
  ↓
Step 4: Converse API → Generate response using only permitted documents
  ↓
Return response + Citation + filterLog
```

### Pourquoi ne pas utiliser l'API RetrieveAndGenerate

L'API RetrieveAndGenerate n'inclut pas `allowed_group_sids` de `.metadata.json` dans le champ `metadata` de la citation. Comme l'API Retrieve retourne correctement les métadonnées, la méthode en deux étapes est adoptée.

### Repli frontend

Si l'API KB Retrieve retourne une erreur 500, le frontend se replie sur l'API Chat Bedrock standard (`/api/bedrock/chat`). Dans ce cas, une réponse IA générale est retournée sans référencer les documents KB.

---

## 6. Liste des API

| Point de terminaison | Méthode | Description |
|----------|--------|-------------|
| `/api/bedrock/kb/retrieve` | POST | Recherche RAG + filtrage SID + génération de réponse |
| `/api/bedrock/chat` | POST | Chat standard (sans KB, pour le repli) |
| `/api/bedrock/models` | GET | Liste des modèles disponibles |
| `/api/bedrock/region-info` | GET | Informations de région + nombre de modèles |
| `/api/bedrock/change-region` | POST | Changer de région (mise à jour du Cookie) |
| `/api/fsx/directories` | GET | Répertoires accessibles de l'utilisateur (basé sur SID) |
| `/api/auth/signin` | POST | Authentification Cognito |
| `/api/auth/session` | GET | Informations de session |
| `/api/auth/signout` | POST | Déconnexion |
| `/api/health` | GET | Vérification de l'état |

---

## 7. Variables d'environnement

Variables d'environnement définies pour la fonction Lambda.

| Nom de la variable | Description | Exemple |
|--------------|-------------|---------|
| `DATA_BUCKET_NAME` | Nom du bucket S3 source de données KB | `perm-rag-demo-demo-kb-data-${ACCOUNT_ID}` |
| `BEDROCK_KB_ID` | ID de la Knowledge Base | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Région Bedrock | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | Nom de la table DynamoDB user-access | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | ID du Cognito User Pool | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | ID du client Cognito | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | Activer la vérification des permissions | `true` |

---

## 8. Dépannage

### Le chat ne retourne pas d'informations de documents

| Symptôme | Cause | Résolution |
|---------|-------|------------|
| Aucune information retournée pour tous les utilisateurs | KB non synchronisée ou BEDROCK_KB_ID non défini | Exécutez `sync-kb-datasource.sh`, vérifiez les variables d'environnement |
| Informations confidentielles non retournées même pour admin | Données SID non enregistrées | Exécutez `setup-user-access.sh` |
| Réponse retournée mais pas de citation | L'API Chat de repli est utilisée | Vérifiez les logs Lambda pour les erreurs 500 |
| "Aucun document trouvé avec les permissions d'accès" | Pas de correspondance SID | Vérifiez les données SID dans DynamoDB et les SID dans les métadonnées |

### Erreur 500 lors de la sélection du modèle

| Symptôme | Cause | Résolution |
|---------|-------|------------|
| 500 sur un modèle spécifique | Modèle Legacy ou on-demand indisponible | Géré par le repli automatique |
| 500 sur tous les modèles | Timeout Lambda | Définissez le timeout Lambda à 30 secondes ou plus |

---

## 8. Basculement mode KB/Agent

### Vue d'ensemble

Un toggle de mode KB/Agent est placé dans l'en-tête, permettant un basculement fluide entre deux modes.

```
┌─────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵  │
│                                                         │
│    📚 Knowledge Base  ← Change dynamiquement par mode   │
│    🤖 Agent                                             │
└─────────────────────────────────────────────────────────┘
```

### Mécanisme de basculement de mode

| Élément | Description |
|------|-------------|
| Position du toggle | Côté droit du titre dans l'en-tête |
| Gestion d'état | `useState` + paramètre URL (`?mode=agent`) |
| Persistance | Persisté via le paramètre URL (ajout aux favoris possible) |
| Par défaut | Mode KB (pas de paramètre `?mode`) |

### Comportement par mode

| Fonctionnalité | Mode KB | Mode Agent |
|---------|---------|------------|
| Barre latérale | KBModeSidebar (inline) | AgentModeSidebar (composant) |
| Liste des modèles | `/api/bedrock/region-info` (tous les modèles) | `/api/bedrock/agent-models` (modèles compatibles Agent uniquement) |
| API de chat | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve` (avec flag `agentMode=true`) |
| Filtrage SID | ✅ Oui | ✅ Oui (méthode hybride) |
| Badge d'en-tête | 📚 Knowledge Base (bleu) | 🤖 Agent (violet) |

### Méthode hybride du mode Agent

Le mode Agent adopte une méthode hybride pour réaliser un RAG sensible aux permissions.

```
User question
  │
  ▼
KB Retrieve API (vector search)
  │
  ▼
SID Filtering (same pipeline as KB mode)
  │ User SID ∩ Document SID → Allow/Deny
  ▼
Only permitted documents as context
  │
  ▼
Converse API (with Agent system prompt)
  │ "Respond using multi-step reasoning and document search as an AI agent"
  ▼
Response + Citation display
```

**Pourquoi la méthode hybride :**
- L'API InvokeAgent de Bedrock Agent ne permet pas le filtrage SID côté application
- L'API KB Retrieve retourne les métadonnées (`allowed_group_sids`), permettant le filtrage SID
- Le pipeline de filtrage SID existant peut être réutilisé tel quel

### Fichiers associés

| Fichier | Rôle |
|------|------|
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Toggle de mode, rendu conditionnel de la barre latérale |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Barre latérale du mode Agent |
| `docker/nextjs/src/components/bedrock/AgentInfoSection.tsx` | Sélection et affichage des informations Agent |
| `docker/nextjs/src/components/bedrock/ModelSelector.tsx` | Sélection de modèle (propriété `mode` pour le basculement KB/Agent) |
| `docker/nextjs/src/app/api/bedrock/agent-models/route.ts` | API des modèles compatibles Agent (récupération dynamique) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | API Agent (invoke, create, delete, list) |
| `docker/nextjs/src/hooks/useAgentMode.ts` | Logique de basculement de mode |
| `docker/nextjs/src/hooks/useAgentsList.ts` | Récupération de la liste des Agents |
| `docker/nextjs/src/store/useAgentStore.ts` | Gestion d'état Agent (Zustand) |

---

## 9. Interface orientée tâches basée sur des cartes

### Vue d'ensemble

Une fonctionnalité qui affiche une grille de cartes dans l'état initial de la zone de chat (lorsqu'aucun message utilisateur n'existe). En mode KB, 14 cartes spécifiques (recherche de documents, création de résumés, etc.) sont présentées, et en mode Agent, 14 cartes de workflow (analyse financière, gestion de projet, création de présentations, etc.) sont présentées, permettant aux utilisateurs de saisir des prompts en un clic.

### Structure des composants

| Composant | Chemin du fichier | Rôle |
|-----------|----------|------|
| CardGrid | `docker/nextjs/src/components/cards/CardGrid.tsx` | Conteneur principal. Intègre InfoBanner, CategoryFilter et TaskCard ; gère l'affichage des cartes, le filtrage et le tri des favoris par mode |
| TaskCard | `docker/nextjs/src/components/cards/TaskCard.tsx` | Composant de carte individuelle (partagé par KB/Agent). Affiche l'icône, le titre, la description et le toggle de favori |
| InfoBanner | `docker/nextjs/src/components/cards/InfoBanner.tsx` | Bannière d'informations de permissions. Affiche les informations existantes du texte d'introduction dans un format compact pliable/dépliable |
| CategoryFilter | `docker/nextjs/src/components/cards/CategoryFilter.tsx` | Puces de filtre de catégorie. Filtre les cartes par catégories spécifiques au mode |

### Liste des cartes mode KB (14 cartes)

#### Catégorie recherche (8 cartes)

| ID | Icône | Catégorie | Objectif |
|----|------|---------|---------|
| `kb-doc-search` | 🔍 | search | Recherche de documents |
| `kb-doc-summary` | 📝 | summary | Création de résumés |
| `kb-quiz-gen` | 📚 | learning | Génération de quiz |
| `kb-compare` | ⚖️ | analysis | Analyse comparative |
| `kb-keyword-search` | 🏷️ | search | Recherche par mots-clés |
| `kb-report-summary` | 📊 | summary | Résumé de rapports |
| `kb-qa-gen` | ❓ | learning | Génération de Q&R |
| `kb-trend-analysis` | 📈 | analysis | Analyse de tendances |

#### Catégorie production (6 cartes)

| ID | Icône | Catégorie | Objectif |
|----|------|---------|---------|
| `kb-presentation` | 🎬 | output | Création de présentations |
| `kb-approval` | 📋 | output | Création de documents d'approbation |
| `kb-minutes` | 🗒️ | output | Création de comptes rendus de réunion |
| `kb-report-gen` | 📑 | output | Génération automatisée de rapports |
| `kb-contract` | 📄 | output | Revue de contrats |
| `kb-onboarding` | 🎓 | output | Matériaux d'intégration |

### Liste des cartes mode Agent (14 cartes)

#### Catégorie recherche (8 cartes)

| ID | Icône | Catégorie | Objectif |
|----|------|---------|---------|
| `agent-financial` | 📊 | financial | Analyse de rapport financier |
| `agent-project` | 📝 | project | Vérification de l'avancement du projet |
| `agent-cross-search` | 🔍 | search | Recherche inter-documents |
| `agent-hr` | 📋 | hr | Vérification de la politique RH |
| `agent-risk` | ⚠️ | financial | Analyse de risques |
| `agent-milestone` | 🎯 | project | Gestion des jalons |
| `agent-compliance` | 🔐 | hr | Vérification de conformité |
| `agent-data-analysis` | 📉 | search | Analyse de données |

#### Catégorie production (6 cartes)

| ID | Icône | Catégorie | Objectif |
|----|------|---------|---------|
| `agent-presentation` | 📊 | presentation | Création de présentations |
| `agent-approval` | 📋 | approval | Création de documents d'approbation |
| `agent-minutes` | 📝 | minutes | Création de comptes rendus de réunion |
| `agent-report` | 📈 | report | Création de rapports |
| `agent-contract` | 📄 | contract | Revue de contrats |
| `agent-onboarding` | 🎓 | onboarding | Création de matériaux d'intégration |

### Conditions d'affichage

L'affichage de CardGrid est contrôlé par la présence de messages utilisateur.

| Condition | Contenu affiché |
|-----------|----------------|
| Pas de messages utilisateur (`messages` a 0 entrées avec `role === 'user'`) | CardGrid affiché |
| Messages utilisateur existants (`role === 'user'` a 1 ou plus entrées) | Affichage normal de la liste de messages + bouton "🔄 Retour à la sélection de workflow" |
| Clic sur le bouton "Nouveau chat" | Créer une nouvelle session → CardGrid ré-affiché |
| Clic sur le bouton "🔄 Retour à la sélection de workflow" | Créer une nouvelle session → CardGrid ré-affiché |

### Gestion des favoris

#### Store Zustand

**Fichier** : `docker/nextjs/src/store/useFavoritesStore.ts`

```typescript
interface FavoritesStore {
  favorites: string[];                        // Liste des ID de cartes favorites
  toggleFavorite: (cardId: string) => void;   // Toggle de favori (ajout/suppression)
  isFavorite: (cardId: string) => boolean;    // Vérification de favori
}
```

| Élément | Description |
|------|-------------|
| Méthode de persistance | Middleware `persist` Zustand + localStorage |
| Clé localStorage | `card-favorites-storage` |
| Repli | En mémoire uniquement lorsque localStorage n'est pas disponible (conservé pendant la session) |
| Comportement de tri | Les cartes favorites sont affichées en haut de la grille. L'ordre relatif au sein de chaque groupe est maintenu |

### Filtrage par catégorie

#### Catégories mode KB

| ID de catégorie | Clé de traduction | Nom d'affichage (fr) |
|------------|----------------|-------------------|
| `all` | `cards.categories.all` | Tout |
| `search` | `cards.categories.search` | Recherche |
| `summary` | `cards.categories.summary` | Résumé |
| `learning` | `cards.categories.learning` | Apprentissage |
| `analysis` | `cards.categories.analysis` | Analyse |
| `output` | `cards.categories.output` | Création de documents |

#### Catégories mode Agent

| ID de catégorie | Clé de traduction | Nom d'affichage (fr) |
|------------|----------------|-------------------|
| `all` | `cards.categories.all` | Tout |
| `financial` | `cards.categories.financial` | Finance |
| `project` | `cards.categories.project` | Projet |
| `hr` | `cards.categories.hr` | RH |
| `search` | `cards.categories.search` | Recherche |
| `presentation` | `cards.categories.presentation` | Création de documents |
| `approval` | `cards.categories.approval` | Approbation |
| `minutes` | `cards.categories.minutes` | Comptes rendus |
| `report` | `cards.categories.report` | Rapport |
| `contract` | `cards.categories.contract` | Contrat |
| `onboarding` | `cards.categories.onboarding` | Intégration |

### InfoBanner

Consolide les informations existantes du texte d'introduction dans une bannière compacte.

#### État replié (par défaut)

Affichage sur une ligne : `Nom d'utilisateur | Rôle | 📁 Accès à N répertoires`

#### État déplié

| Élément affiché | Description |
|-------------|-------------|
| Nom d'utilisateur | Adresse e-mail du JWT Cognito |
| Rôle | `admin` ou `user` |
| SID | Identifiant de sécurité de l'utilisateur |
| Liste des répertoires | Trois types : FSx / RAG / Embedding |
| Détails des permissions | Lecture ✅/❌, Écriture ✅/❌, Exécution ✅/❌ |

---

## 10. Refonte de la disposition de la barre latérale

### Vue d'ensemble

Refonte de la barre latérale du mode Agent pour rendre les paramètres système (région, sélection de modèle, etc.) pliables, avec la section workflow placée en haut de la barre latérale.

### Structure de la disposition

Dans les modes KB et Agent, la section de gestion système (région, sélection de modèle, etc.) est pliable.

### Nouveaux composants

| Composant | Chemin du fichier | Rôle |
|-----------|----------|------|
| CollapsiblePanel | `docker/nextjs/src/components/ui/CollapsiblePanel.tsx` | Panneau pliable/dépliable. Enveloppe la section des paramètres système |
| WorkflowSection | `docker/nextjs/src/components/ui/WorkflowSection.tsx` | Liste des cartes de workflow. Affiché en haut de la barre latérale en mode Agent |

---

## 11. Liaison dynamique Agent-Carte

### Vue d'ensemble

Une fonctionnalité qui recherche un Agent correspondant à une catégorie lorsqu'une carte est cliquée, et en crée dynamiquement un s'il n'existe pas, le liant à la carte.

### Flux

```
Card click
  │
  ▼
cardAgentBindingService
  │ 1. Determine category via AGENT_CATEGORY_MAP
  │ 2. Search for existing Agent (name matching)
  │ 3. If not found → Dynamically create via Bedrock CreateAgent API
  │ 4. Persist card-Agent mapping
  ▼
Execute via Agent InvokeAgent API
```

### AGENT_CATEGORY_MAP (10 catégories)

Un mapping qui définit la correspondance entre les catégories de cartes et les Agents. Chaque catégorie a un préfixe de nom d'Agent, un prompt système et un modèle recommandé configurés.

| Catégorie | Préfixe du nom d'Agent | Objectif |
|----------|------------------|---------|
| financial | FinancialAnalysis | Analyse de rapport financier et analyse de risques |
| project | ProjectManagement | Avancement du projet et gestion des jalons |
| hr | HRPolicy | Politique RH et conformité |
| search | DocumentSearch | Recherche inter-documents et analyse de données |
| presentation | PresentationDraft | Création de présentations |
| approval | ApprovalDocument | Création de documents d'approbation |
| minutes | MeetingMinutes | Création de comptes rendus de réunion |
| report | ReportGeneration | Création de rapports |
| contract | ContractReview | Revue de contrats |
| onboarding | OnboardingGuide | Intégration |

---

## 12. Cartes de workflow orientées production

### Vue d'ensemble

Étend les cartes du mode Agent à un total de 14 cartes : 8 "Recherche" + 6 "Production". Les cartes de production sont conçues pour générer des livrables spécifiques (présentations, documents d'approbation, comptes rendus de réunion, rapports, contrats, matériaux d'intégration).

---

## 13. Affichage des citations — Affichage du chemin de fichier et badge de niveau d'accès

### Vue d'ensemble

Le composant CitationDisplay (`docker/nextjs/src/components/chat/CitationDisplay.tsx`) affiche le chemin de fichier FSx et le badge de niveau d'accès pour chaque document source dans les résultats de recherche RAG.

### Affichage du chemin de fichier

Extrait et affiche le chemin de fichier sur FSx depuis l'URI S3. En incluant le chemin du répertoire plutôt que juste le nom du fichier, cela évite la confusion lorsque des fichiers portant le même nom existent dans des dossiers différents.

| Format d'affichage | Exemple |
|---------------|---------|
| URI S3 | `s3://bucket-alias/confidential/financial-report.md` |
| Chemin affiché | `confidential/financial-report.md` |

### Badge de niveau d'accès

| Valeur `access_level` | Couleur du badge | Libellé affiché | Signification |
|---------------------|-------------|--------------|---------|
| `public` | Vert | Accessible à tous | SID Everyone — accessible à tous les utilisateurs |
| `confidential` | Rouge | Administrateurs uniquement | Accessible uniquement au SID Domain Admins |
| `restricted` | Jaune | Groupes spécifiques | Groupes spécifiques (ex. : Engineering + Domain Admins) |
| Autre / Non défini | Jaune | (valeur brute affichée telle quelle) | Niveau d'accès non catégorisé |

---

## 10. Agent Directory — Écran de gestion des Agents

**Dernière mise à jour** : 2026-03-29

### Vue d'ensemble

Agent Directory (`/[locale]/genai/agents`) est un écran dédié à la liste et à la gestion des Bedrock Agents dans un format catalogue. Il est conçu en référence au pattern UX Agent Directory de Bedrock Engineer.

### Méthode d'accès

- URL : `/{locale}/genai/agents` (ex. : `/ja/genai/agents`, `/en/genai/agents`)
- Accès via le lien "📋 Liste des Agents" dans l'en-tête
- Accès via l'onglet "Liste des Agents" dans la barre de navigation

### Barre de navigation

Trois onglets sont affichés en haut de l'écran.

| Onglet | Destination | Description |
|-----|------------|-------------|
| Mode Agent | `/genai?mode=agent` | Écran de grille de cartes du mode Agent |
| Liste des Agents | `/genai/agents` | Agent Directory (écran actuel) |
| Mode KB | `/genai` | Écran de grille de cartes du mode KB |

### Liste des Agents (vue grille)

#### Recherche et filtrage

| Fonctionnalité | Description |
|---------|-------------|
| Recherche textuelle | Recherche de correspondance partielle insensible à la casse sur le nom et la description de l'Agent |
| Filtre de catégorie | 10 catégories (financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding) + "Tout" |

La recherche et le filtre de catégorie peuvent être combinés (condition ET).

#### Carte Agent

Chaque carte affiche les informations suivantes.

| Élément | Description |
|------|-------------|
| Nom de l'Agent | Nom du Bedrock Agent |
| Badge de statut | Ready (vert) / Creating/Preparing (bleu + spinner) / Failed (rouge) / Autre (gris) |
| Description | Description de l'Agent (jusqu'à 2 lignes) |
| Tag de catégorie | Auto-inféré à partir du nom/description de l'Agent via correspondance de mots-clés (tag violet) |

### Panneau de détail de l'Agent

Un écran de détail affiché lorsqu'une carte Agent est cliquée.

#### Boutons d'action

| Bouton | Comportement |
|--------|----------|
| Utiliser dans le chat | Définit `useAgentStore.selectedAgentId` et navigue vers `/genai?mode=agent` |
| Modifier | Bascule vers le formulaire d'édition inline |
| Exporter | Télécharge la configuration de l'Agent en fichier JSON (lorsque `enableAgentSharing`) |
| Uploader vers le bucket partagé | Uploade la configuration de l'Agent vers le bucket S3 partagé (lorsque `enableAgentSharing`) |
| Créer un planning | Configure l'exécution périodique cron avec EventBridge Scheduler (lorsque `enableAgentSchedules`) |
| Supprimer | Dialogue de confirmation incluant le nom de l'Agent → Exécuter l'API Delete |

### Intégration API

Agent Directory partage l'API existante `/api/bedrock/agent` et n'ajoute pas de nouveaux points de terminaison.

| Action | Requête | Objectif |
|--------|---------|---------|
| `list` | `POST {action: 'list'}` | Récupérer la liste des Agents |
| `get` | `POST {action: 'get', agentId}` | Récupérer les détails de l'Agent |
| `create` | `POST {action: 'create', agentName, instruction, foundationModel, description, attachActionGroup}` | Créer un Agent à partir d'un modèle |
| `update` | `POST {action: 'update', agentId, agentName, description, instruction, foundationModel}` | Sauvegarder les modifications de l'Agent |
| `delete` | `POST {action: 'delete', agentId}` | Supprimer l'Agent |

---

## 11. Barre latérale — Paramètres d'historique de chat

**Dernière mise à jour** : 2026-03-29

### Vue d'ensemble

Les paramètres de sauvegarde de l'historique de chat sont affichés comme une section indépendante dans la barre latérale, commune aux modes KB et Agent (placée au-dessus du CollapsiblePanel de gestion système).

### Contenu affiché

| État | Icône | Texte | Couleur de fond |
|-------|------|------|-----------------|
| Sauvegarde activée | 💾 | "Sauvegarder l'historique" + "Sauvegarde automatique" | Vert (`bg-green-100`) |
| Sauvegarde désactivée | 🚫 | "Historique désactivé" + "Session uniquement" | Gris (`bg-gray-50`) |

---

## 12. Zone de saisie des messages

**Dernière mise à jour** : 2026-03-29

### Disposition

```
[➕] [Text input field                              ] [Send button]
```

| Élément | Description |
|---------|-------------|
| Bouton ➕ | Démarre une nouvelle session de chat. Retourne à la grille de cartes |
| Saisie de texte | Saisie de message. Désactivé pendant l'envoi |
| Bouton d'envoi | Envoie le message. Désactivé lorsque la saisie est vide ou pendant l'envoi |

Pendant un chat, un lien "🔄 Retour à la sélection de workflow" est affiché au-dessus de la zone de saisie.

---

## 14. Fonctionnalités d'entreprise Agent (optionnel)

**Dernière mise à jour** : 2026-03-30

### Vue d'ensemble

Un ensemble de fonctionnalités de gestion d'Agent orientées entreprise qui peuvent être activées via des paramètres optionnels lors du déploiement CDK.

### Comment activer

```bash
# Enable Agent sharing feature
npx cdk deploy --all -c enableAgentSharing=true

# Enable Agent scheduled execution feature
npx cdk deploy --all -c enableAgentSchedules=true

# Enable both
npx cdk deploy --all -c enableAgent=true -c enableAgentSharing=true -c enableAgentSchedules=true
```

### 5 fonctionnalités

| # | Fonctionnalité | Paramètre CDK | Ressources supplémentaires |
|---|---------|--------------|---------------------|
| 1 | Interface de sélection d'outils Agent | Aucun (fonctionnalité UI uniquement) | Aucune |
| 2 | Paramètres UI Guardrails | `enableGuardrails` | Bedrock Guardrail |
| 3 | Profils d'inférence d'application | Aucun (fonctionnalité UI uniquement) | Aucune |
| 4 | Partage organisationnel | `enableAgentSharing` | Bucket S3 (`${prefix}-shared-agents`) |
| 5 | Agent en arrière-plan | `enableAgentSchedules` | Lambda + DynamoDB + EventBridge Scheduler |

---

## 14. Interface de connexion AD — Support de la fédération SAML

### Vue d'ensemble

Lorsque la fédération SAML AD est activée (`enableAdFederation=true`), un bouton "Se connecter avec AD" est ajouté à la page de connexion pour supporter le flux SAML via l'interface hébergée Cognito.

### Conditions d'affichage

| Condition | Contenu affiché |
|-----------|----------------|
| Variable d'environnement `COGNITO_DOMAIN` définie | Bouton "Se connecter avec AD" + formulaire e-mail/mot de passe existant |
| Variable d'environnement `COGNITO_DOMAIN` non définie | Formulaire e-mail/mot de passe existant uniquement (rétrocompatibilité) |

---

## Interface d'upload d'images (fonctionnalités RAG avancées)

### ImageUploadZone

Une zone de glisser-déposer et un bouton de sélection de fichier placés dans la zone de saisie du chat.

| Élément | Spécification |
|------|--------------|
| Placement | À l'intérieur du formulaire de saisie du chat, à gauche de la saisie de texte |
| Formats supportés | JPEG, PNG, GIF, WebP |
| Limite de taille | 3 Mo |
| Pendant le glissement | Zone de dépôt mise en surbrillance (`border-blue-500 bg-blue-50`) |

### Interface de connexion Knowledge Base (fonctionnalités RAG avancées)

### KBSelector

Composant de sélection de Knowledge Base dans les formulaires de création et d'édition d'Agent.

| Élément | Spécification |
|------|--------------|
| Éléments affichés | Nom KB, description, badge de statut, nombre de sources de données |
| Couleurs du badge de statut | ACTIVE → vert, CREATING → bleu, FAILED → rouge |
| Restriction de sélection | Case à cocher activée uniquement pour ACTIVE |
| Sélection multiple | Supportée (mise en surbrillance à la sélection) |

### Interface de routage intelligent (fonctionnalités RAG avancées)

### RoutingToggle

Toggle ON/OFF du routage intelligent placé dans la section des paramètres de la barre latérale.

| Élément | Spécification |
|------|--------------|
| Placement | Barre latérale mode KB, sous ModelSelector |
| Toggle | `role="switch"`, `aria-checked` |
| Quand ON | Affiche la paire nom du modèle léger / nom du modèle haute performance (fond bleu) |
| Quand OFF | Paire de modèles non affichée |
| Persistance | localStorage (clé `smart-routing-enabled`) |
| Par défaut | OFF |

### Fichiers associés

| Fichier | Rôle |
|------|------|
| `docker/nextjs/src/types/image-upload.ts` | Définitions de types pour l'upload d'images |
| `docker/nextjs/src/types/kb-selector.ts` | Définitions de types pour l'interface de connexion KB |
| `docker/nextjs/src/types/smart-routing.ts` | Définitions de types pour le routage intelligent |
| `docker/nextjs/src/messages/{locale}.json` | Fichiers de traduction (espaces de noms `imageUpload`, `kbSelector`, `smartRouting`) |