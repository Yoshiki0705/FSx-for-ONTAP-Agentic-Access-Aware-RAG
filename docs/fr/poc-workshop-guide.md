# Guide d'atelier PoC (90 minutes)

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | [한국어](../ko/poc-workshop-guide.md) | [简体中文](../zh-CN/poc-workshop-guide.md) | [繁體中文](../zh-TW/poc-workshop-guide.md) | **Français** | [Deutsch](../de/poc-workshop-guide.md) | [Español](../es/poc-workshop-guide.md)

**Date de création** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Architectes solutions, ingénieurs partenaires, équipes cloud clients

---

## Vue d'ensemble

Cet atelier vous permet de déployer le système Permission-aware Agentic RAG en 90 minutes et d'expérimenter le fonctionnement de la recherche avec gestion des permissions.

---

## Prérequis

| Élément | Exigence |
|---------|----------|
| Compte AWS | Permissions équivalentes à AdministratorAccess |
| AWS CLI | v2 configuré (`aws sts get-caller-identity` doit réussir) |
| Node.js | 22 ou supérieur |
| Docker | En cours d'exécution (`docker info` doit réussir) |
| CDK Bootstrap | Sera effectué pendant l'atelier si non réalisé |
| Accès aux modèles Bedrock | Claude Haiku / Sonnet, Titan Embed v2 activés |

---

## Programme

| Horaire | Section | Contenu |
|---------|---------|---------|
| 0:00–0:10 | 0. Introduction | Vue d'ensemble de l'architecture, explication des cas d'usage |
| 0:10–0:40 | 1. Déploiement de l'environnement | Clonage, dépendances, Bootstrap, déploiement |
| 0:40–0:55 | 2. Injection des données de démonstration | Création d'utilisateurs, placement des documents de test |
| 0:55–1:15 | 3. Test RAG avec permissions | Recherche avec différents utilisateurs, comparaison des résultats |
| 1:15–1:25 | 4. Revue du guide entreprise | Checklist de mise en production, modèle d'évaluation |
| 1:25–1:30 | 5. Nettoyage | Suppression des ressources, vérification des coûts |

---

## 0. Introduction (10 minutes)

### Le problème résolu par ce système

```
RAG traditionnel :
  Fichiers d'entreprise → Tous les documents transmis à l'IA → Tout le monde accède à toutes les informations
  → Les limites de permissions disparaissent → Risque de fuite de données confidentielles

Permission-aware RAG :
  Fichiers d'entreprise → ACL existantes maintenues → Documents visibles différents selon l'utilisateur
  → Utilisation de l'IA tout en respectant les permissions → Sécurité et commodité conciliées
```

### Architecture (pour tableau blanc)

```
Utilisateur → CloudFront → Lambda (Next.js)
                              ↓
                    Bedrock KB Retrieve API
                              ↓
                    Filtrage SID (côté application)
                              ↓
                    Génération de réponse uniquement avec les documents autorisés
```

---

## 1. Déploiement de l'environnement (30 minutes)

### Step 1.1 : Clonage du dépôt

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2 : CDK Bootstrap

```bash
# Région principale
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# Pour WAF (CloudFront nécessite us-east-1)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3 : Création du fichier de configuration

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **Remarque** : Modifiez `allowedCountries` en fonction du pays des participants.

### Step 1.4 : Préparation de l'image Docker & déploiement

```bash
# Build de l'image Docker
bash demo-data/scripts/pre-deploy-setup.sh

# Déploiement (environ 30 minutes)
npx cdk deploy --all --require-approval never
```

> Vous pouvez optimiser le temps en expliquant la section suivante pendant le déploiement.

---

## 2. Injection des données de démonstration (15 minutes)

### Step 2.1 : Création des utilisateurs de test & données

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Ce script exécute les opérations suivantes :
- Création des utilisateurs de test Cognito (admin@example.com, user@example.com)
- Enregistrement des données SID dans DynamoDB
- Upload des documents de test + `.metadata.json` vers S3
- Synchronisation de la source de données Bedrock KB

### Step 2.2 : Obtention de l'URL d'accès

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. Test RAG avec permissions (20 minutes)

### Test 1 : Connexion avec l'utilisateur administrateur

1. Accédez à l'URL CloudFront
2. Connectez-vous avec `admin@example.com` / mot de passe (vérifiez la sortie de post-deploy-setup.sh)
3. Posez la question « Parlez-moi du chiffre d'affaires de l'entreprise »
4. **Résultat attendu** : Réponse incluant les informations de chiffre d'affaires de 15 milliards de yens (référence au document confidentiel)

### Test 2 : Connexion avec l'utilisateur standard

1. Déconnectez-vous
2. Connectez-vous avec `user@example.com`
3. Posez la même question « Parlez-moi du chiffre d'affaires de l'entreprise »
4. **Résultat attendu** : Pas d'information sur le chiffre d'affaires (référence uniquement aux documents publics)

### Test 3 : Mode Agent

1. Basculez vers « Agent » avec le sélecteur de mode dans l'en-tête
2. Posez la question « Résumez le contenu du catalogue produits »
3. **Résultat attendu** : L'Agent utilise l'outil de recherche KB et répond dans le périmètre des permissions

### Points de vérification

- [ ] La même question produit des réponses différentes
- [ ] Les citations affichent un badge de niveau d'accès
- [ ] Les citations de documents confidentiels ne s'affichent pas pour l'utilisateur standard

---

## 4. Revue du guide entreprise (10 minutes)

Présentez les documents suivants aux participants :

| Document | Points de vérification |
|----------|----------------------|
| [Checklist de mise en production](production-readiness-checklist.md) | Niveaux de maturité Demo/PoC/Production |
| [Modèle d'évaluation](evaluation.md) | Résumé en une page du rapport d'évaluation PoC |
| [Guide d'expérimentation sûre](safe-experimentation-guide.md) | Checklist avant injection de données réelles |
| [Modèle de menaces](threat-model.md) | 10 catégories de menaces et correspondance des contre-mesures |

---

## 5. Nettoyage (5 minutes)

```bash
# Suppression de toutes les ressources
npx cdk destroy --all --force
```

> **Remarque** : La suppression de FSx for ONTAP prend 10 à 15 minutes. Après la fin de la commande, vérifiez l'état de suppression dans la console AWS.

### Vérification des coûts

```bash
# Vérification des ressources restantes
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## Critères de succès

| Critère | Méthode de vérification |
|---------|------------------------|
| L'environnement est déployé avec succès | L'URL CloudFront est accessible |
| Des réponses différentes sont retournées pour différents utilisateurs | Comparaison des tests 1 et 2 |
| Le scénario de refus de permission fonctionne en Fail-Closed | Aucune information confidentielle affichée pour l'utilisateur standard |
| Les journaux d'audit sont générés | Les journaux de recherche sont enregistrés dans CloudWatch Logs |
| Le nettoyage est terminé | Aucune ressource restante |

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Échec du CDK Bootstrap | Vérifiez les identifiants AWS CLI. `aws sts get-caller-identity` réussit-il ? |
| Échec du build Docker | Vérifiez que Docker est en cours d'exécution. `docker info` |
| Déploiement supérieur à 40 minutes | La création de FSx for ONTAP prend 20 à 30 minutes, c'est normal |
| Impossible de se connecter | Vérifiez que les utilisateurs Cognito ont été créés. Consultez la sortie de `post-deploy-setup.sh` |
| 0 résultat de recherche | Vérifiez que la synchronisation KB est terminée. Attendez quelques minutes et réessayez |

---

## Prochaines étapes

Après la fin de l'atelier, envisagez les actions suivantes :

1. **PoC avec données réelles** : Injectez des données réelles en suivant le [Guide d'expérimentation sûre](safe-experimentation-guide.md)
2. **Évaluation** : Évaluez quantitativement les résultats du PoC avec le [Modèle d'évaluation](evaluation.md)
3. **Étude de mise en production** : Vérifiez les contre-mesures nécessaires avec la [Checklist de mise en production](production-readiness-checklist.md)

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [README.md](../README.md) | Vue d'ensemble du système, procédure de déploiement |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guide d'expérimentation sûre |
| [evaluation.md](evaluation.md) | Métriques d'évaluation RAG / Agent |
| [threat-model.md](threat-model.md) | Modèle de menaces |
