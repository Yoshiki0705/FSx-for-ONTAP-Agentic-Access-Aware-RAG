# Guide des scénarios de vérification

## Aperçu

Procédures de vérification du système Permission-aware RAG. Le filtrage basé sur les SID garantit des résultats de recherche différents pour différents utilisateurs posant la même question.

---

## Scénario 4 : Vérification OIDC + LDAP Federation

> **Prérequis** : CDK déployé avec `oidcProviderConfig` + `ldapConfig`. Serveur OpenLDAP en fonctionnement dans le VPC.

### 4-1. Configuration OpenLDAP

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. Utilisateurs de test LDAP

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Points de vérification

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Scripts de vérification

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Considérations pour la configuration OpenLDAP

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Voir [Guide de configuration par mode d'authentification](fr/auth-mode-setup-guide.md).


---

## 5. Démo Collaboration Multi-Agent

### Prérequis

Déploiement avec `enableMultiAgent: true` dans `cdk.context.json`.

### 5-1. Activer le Mode Multi-Agent

1. Cliquez sur le bascule **[Multi Agent]** dans l'en-tête du chat
2. Sélectionnez le Supervisor Agent dans le menu déroulant **[Agent Select]** de l'en-tête
3. Une nouvelle session multi-agent est automatiquement créée

### 5-2. Recherche Multi-Agent avec Filtrage des Permissions

Connectez-vous en tant qu'**admin** et posez une question. Vérifiez l'UI Agent Trace pour la chronologie et la répartition des coûts. Connectez-vous ensuite en tant qu'**user** et comparez les résultats.

### 5-3. Comparaison Single Agent vs Multi-Agent

1. Envoyez une question en **mode Single** → notez le temps de réponse et le coût
2. Passez en **mode Multi** → envoyez la même question → comparez

### 5-4. Notes de Déploiement

- **Valeurs valides de CloudFormation `AgentCollaboration`** : `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` uniquement. `COLLABORATOR` est invalide
- **Déploiement en 2 étapes** : Créer le Supervisor Agent avec `DISABLED`, puis Custom Resource Lambda : `UpdateAgent` → `SUPERVISOR_ROUTER`, `AssociateAgentCollaborator`, `PrepareAgent`
- **Permissions IAM** : Le rôle Supervisor nécessite `bedrock:GetAgentAlias` + `bedrock:InvokeAgent` sur `agent-alias/*/*`. Le Custom Resource Lambda nécessite `iam:PassRole`
- **Alias Collaborator** : Chaque Collaborator Agent nécessite `CfnAgentAlias` avant la référence Supervisor
- **autoPrepare=true interdit** : Ne peut pas être utilisé sur le Supervisor Agent

### 5-5. Constatations Opérationnelles

- **Récupération de la liste des Teams** : Le bascule Multi sur la page de chat récupère la liste des teams via l'API au chargement et vérifie `teams.length > 0`. Le mode Multi est désactivé lorsqu'aucun team n'existe (comportement prévu)
- **Sélection directe du Supervisor** : Sélectionner le Supervisor Agent dans le menu déroulant et l'invoquer en mode Single Agent déclenche quand même la collaboration multi-agent côté Bedrock (le flux Supervisor → Collaborator fonctionne)
- **Filtrage des permissions** : Les réponses du Supervisor Agent incluent des citations filtrées par permissions (les utilisateurs admin peuvent voir les documents confidentiels, les utilisateurs réguliers ne voient que les publics)
- **Mise à jour de l'image Docker** : Après des modifications de code, 3 étapes sont nécessaires : `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` (CDK ne détecte pas les changements du tag `latest`)
- **Intégration mode Multi** : Bascule Multi → appel `/api/bedrock/agent-team/invoke` → réponse avec `multiAgentTrace` → rendu conditionnel de MultiAgentTraceTimeline + CostSummary vérifié fonctionnel
- **Traces Collaborator** : `buildCollaboratorTraces` extrait les informations d'exécution des Collaborators depuis les événements de trace de l'API InvokeAgent de Bedrock Agent, mais les appels internes du Supervisor aux Collaborators peuvent ne pas toujours apparaître dans les traces (limitation côté Bedrock). Les réponses sont retournées normalement indépendamment
- **routingClassifierTrace** : En mode `SUPERVISOR_ROUTER`, les traces Collaborator apparaissent dans `routingClassifierTrace` (pas `orchestrationTrace`) comme `agentCollaboratorInvocationInput/Output`
- **Résolution automatique SID filteredSearch** : La Lambda filteredSearch résout automatiquement les informations SID depuis la table DynamoDB User Access via `sessionAttributes.userId`. Le filtrage des permissions fonctionne même sans paramètres SID explicites
- **Problème de guillemets métadonnées KB** : Les `allowed_group_sids` de Bedrock KB peuvent contenir des guillemets supplémentaires. La fonction `cleanSID` les supprime pour un matching SID correct
- **i18n instructions Agent** : La propriété CDK `agentLanguage` (défaut : `'auto'`) permet des instructions en anglais avec adaptation automatique de la langue de réponse à la langue de l'utilisateur
- **Vérification E2E réussie** : Utilisateur admin en mode Multi → requête catalogue produits → contenu FSx for ONTAP retourné avec filtrage des permissions. Panneau détail RetrievalAgent et CostSummary affichés correctement
