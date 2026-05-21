# Liste de vérification pour la mise en production

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | [한국어](../ko/production-readiness-checklist.md) | [简体中文](../zh-CN/production-readiness-checklist.md) | [繁體中文](../zh-TW/production-readiness-checklist.md) | **Français** | [Deutsch](../de/production-readiness-checklist.md) | [Español](../es/production-readiness-checklist.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Équipes envisageant la migration PoC → Production

---

## Aperçu

Ce document fournit une liste de vérification des éléments à valider lors de la migration du système RAG sensible aux permissions d'un environnement PoC vers un environnement de production.

---

## Définitions des niveaux de maturité

| Niveau | Nom | Description | Cible |
|--------|-----|-------------|-------|
| L1 | Démo | Vérifier le fonctionnement avec les données et utilisateurs d'exemple fournis. Déploiement le plus rapide | Validation technique, démonstrations internes |
| L2 | PoC | Connecter l'AD/IdP du client, ingérer des fichiers réels, collecter les journaux d'évaluation | Propositions clients, vérification d'efficacité |
| L3 | Production | Multi-comptes, rétention des journaux d'audit, DR, SLO, modèle de menaces, Runbook opérationnel | Utilisation métier en production |

---

## Liste de vérification L1 → L2 (Démo → PoC)

### Authentification et fédération d'identité

- [ ] Connecter le Cognito User Pool à l'IdP du client (OIDC / SAML / LDAP)
- [ ] Confirmer la connexion SSO réussie avec les utilisateurs de test
- [ ] Confirmer que la récupération automatique des SID / UID+GID fonctionne
- [ ] Définir `authFailureMode` sur `fail-closed` et confirmer le comportement de blocage en cas d'échec de récupération des permissions

### Ingestion des données

- [ ] Placer des fichiers réels (10–100) sur le volume FSx for ONTAP
- [ ] Confirmer que les fichiers `.metadata.json` sont générés correctement
- [ ] Confirmer que la synchronisation de la source de données Bedrock KB se termine avec succès
- [ ] Confirmer que les résultats de recherche sont correctement filtrés pour les utilisateurs ayant des permissions différentes

### Évaluation

- [ ] Évaluation qualitative de la précision des réponses (10+ questions)
- [ ] Confirmer zéro violation de permissions
- [ ] Mesurer les temps de réponse (P50 / P95 / P99)

---

## Liste de vérification L2 → L3 (PoC → Production)

### 1. Sécurité

#### Chiffrement

- [ ] Chiffrement KMS CMK pour S3 / DynamoDB / FSx (`enableKmsEncryption=true`)
- [ ] Activer la rotation des clés KMS
- [ ] Imposer TLS 1.2 ou supérieur (CloudFront, ALB, FSx)
- [ ] Gérer les mots de passe et clés API avec Secrets Manager (ne pas coder en dur dans `cdk.context.json`)

#### Réseau

- [ ] Activer les VPC endpoints (`enableVpcEndpoints=true`)
  - S3, DynamoDB, Bedrock, Bedrock Agent, CloudWatch Logs, STS
- [ ] Minimiser les permissions des groupes de sécurité (supprimer les règles entrantes inutiles)
- [ ] Restreindre le trafic sortant via NAT Gateway
- [ ] Configurer les restrictions géographiques CloudFront appropriées

#### WAF

- [ ] Définir les valeurs de limitation de débit en production (par défaut : 2000 req/5min)
- [ ] Configurer la liste d'autorisation IP (IPs internes uniquement)
- [ ] Activer le stockage des journaux WAF vers S3
- [ ] Envisager l'ajout de règles Bot Control

#### IAM

- [ ] Minimiser les permissions des rôles d'exécution Lambda
- [ ] Minimiser les permissions du rôle Bedrock KB
- [ ] Restreindre l'accès inter-comptes
- [ ] Détecter les permissions inutilisées avec IAM Access Analyzer

### 2. Audit et journalisation

- [ ] Activer CloudTrail (toutes les régions, événements de gestion + événements de données)
- [ ] Définir la période de rétention CloudWatch Logs (minimum 1 an)
- [ ] Activer la journalisation d'accès S3
- [ ] Suivre les changements de permissions via DynamoDB Streams
- [ ] Activer la journalisation des invocations de modèles Bedrock
- [ ] Empêcher la falsification des journaux d'audit (S3 Object Lock / Glacier Vault Lock)
- [ ] Stocker les journaux de recherche RAG (ID utilisateur, requête, documents référencés, résultats de filtrage)

### 3. Disponibilité et DR

- [ ] Confirmer la configuration Multi-AZ de FSx for ONTAP
- [ ] Activer la récupération ponctuelle DynamoDB (PITR)
- [ ] Activer le versionnement S3
- [ ] Configurer le calendrier de sauvegarde (sauvegardes automatiques FSx)
- [ ] Définir et vérifier le RTO / RPO
- [ ] Sélectionner la région DR et concevoir la réplication SnapMirror
- [ ] Créer la documentation de procédure de basculement manuel

### 4. Opérations

- [ ] Configurer le tableau de bord CloudWatch (`enableMonitoring=true`)
- [ ] Définir les seuils d'alerte
  - Taux d'erreur Lambda > 1%
  - Latence Bedrock P95 > 10s
  - Limitation DynamoDB
  - Utilisation du stockage FSx > 80%
- [ ] Créer le Runbook opérationnel
  - Procédure de re-synchronisation KB
  - Procédure de vidage forcé du cache de permissions
  - Procédure de révocation d'urgence des permissions
  - Procédure de retour arrière
- [ ] Définir le flux de réponse aux incidents
- [ ] Établir la structure d'astreinte

### 5. Gestion des coûts

- [ ] Définir des alertes de coûts avec AWS Budgets
- [ ] Définir la stratégie de balisage (Environment, Project, CostCenter)
- [ ] Politique de cycle de vie S3 (migration Glacier pour les journaux)
- [ ] Définir des valeurs appropriées de mémoire et de timeout Lambda
- [ ] Surveiller l'utilisation des modèles Bedrock
- [ ] Établir un processus de revue mensuelle des coûts

### 6. Évolutivité

- [ ] Sélectionner le mode de capacité DynamoDB (On-Demand vs Provisioned)
- [ ] Configurer les limites de concurrence Lambda
- [ ] Vérifier le débit Bedrock (envisager le Provisioned Throughput)
- [ ] Définir la capacité de débit FSx appropriée
- [ ] Optimiser la stratégie de mise en cache CloudFront

### 7. Conformité

- [ ] Établir la politique de classification des données (Confidentiel, Interne, Public)
- [ ] Définir les règles de traitement des informations personnelles
- [ ] Définir les périodes de rétention des données
- [ ] Préparer les conditions d'utilisation et la politique de confidentialité
- [ ] Traiter les réglementations spécifiques au secteur (Santé : HIPAA, Finance : FISC, Public : ISMAP)

### 8. Tests

- [ ] Exécuter les tests de matrice de permissions (voir [tests/permission-matrix/](../tests/permission-matrix/))
- [ ] Tests de charge (2x les utilisateurs simultanés attendus)
- [ ] Tests de sécurité (tests de pénétration)
- [ ] Tests DR (basculement / retour)
- [ ] Tests de propagation des changements de permissions (changement ACL → reflet dans les résultats de recherche)

---

## Vérification finale avant le déploiement en production

```bash
# 1. Vérifier les changements avec CDK diff
npx cdk diff --all

# 2. Analyse de sécurité
npx cdk synth --quiet | cfn-nag

# 3. Exécuter les tests
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. Déployer (avec approbation)
npx cdk deploy --all --require-approval broadening
```

---

## Documents associés

| Document | Description |
|----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Modèle de cohérence des changements de permissions |
| [governance-and-audit.md](governance-and-audit.md) | Conception de la gouvernance et de l'audit |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Modèles de déploiement multi-locataires |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guide d'expérimentation sécurisée |
| [evaluation.md](evaluation.md) | Métriques d'évaluation RAG / Agent |
