# Guide d'expérimentation sécurisée

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | [한국어](../ko/safe-experimentation-guide.md) | [简体中文](../zh-CN/safe-experimentation-guide.md) | [繁體中文](../zh-TW/safe-experimentation-guide.md) | **Français** | [Deutsch](../de/safe-experimentation-guide.md) | [Español](../es/safe-experimentation-guide.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Utilisateurs PoC, développeurs, évaluateurs

---

## Aperçu

Ce document fournit les définitions de périmètre, les actions interdites et les procédures de retour arrière pour expérimenter en toute sécurité avec le système RAG sensible aux permissions. Il clarifie « un environnement où vous pouvez procéder par essais et erreurs dans les limites des politiques d'IA responsable et de sécurité. »

---

## Périmètre d'expérimentation sécurisée

### ✅ Recommandé : Expérimenter uniquement avec les données de démonstration

| Opération | Risque | Notes |
|-----------|--------|-------|
| Tests de recherche avec les données de démo | Aucun | Vérifier le fonctionnement avec les données d'exemple fournies |
| Vérification des permissions via changement d'utilisateur | Aucun | Confirmer les différences de résultats de recherche entre admin / utilisateur |
| Expérimentation du mode Agent | Aucun | Création et test d'agents dans l'Agent Directory |
| Personnalisation de l'interface | Aucun | Modifications du code source Next.js |
| Changements de paramètres CDK | Faible | Modifications de `cdk.context.json` → redéploiement |
| Ajout de nouveaux documents | Faible | Ajout au dossier de données de démo |
| Ajustements de politique Guardrails | Faible | Modifications de `guardrailsConfig` |
| Smart Routing ON/OFF | Aucun | Bascule dans la barre latérale |
| Changements de sélection de modèle | Faible | Variation de coût possible |
| Expérimentation du chat vocal | Faible | Activer avec `enableVoiceChat=true` |

### ⚠️ Attention : Liste de vérification avant l'ingestion de données réelles

Vérifiez les éléments suivants avant d'ingérer des données métier réelles :

- [ ] **Classification des données terminée** : Le niveau de confidentialité des données à ingérer a été classifié
- [ ] **Vérification PII** : Si des informations personnelles sont incluses, le masquage ou l'approbation est terminé
- [ ] **Vérification de la conception des permissions** : `allowed_group_sids` dans `.metadata.json` est correctement configuré
- [ ] **Journalisation d'audit activée** : CloudWatch Logs / CloudTrail sont activés
- [ ] **Restrictions d'accès vérifiées** : WAF / Restrictions géographiques / Restrictions IP sont correctement configurées
- [ ] **Vérification des sauvegardes** : La sauvegarde automatique FSx est activée
- [ ] **Notification des utilisateurs** : Les participants au PoC ont été informés des règles de traitement des données
- [ ] **Procédure de suppression des données confirmée** : La procédure de suppression des données après la fin du PoC a été confirmée

### ❌ Actions interdites

| Action interdite | Raison | Alternative |
|-----------------|--------|-------------|
| Connexion directe à l'AD de production (étape PoC) | Risque d'impact sur l'environnement de production | Utiliser un AD de test / authentification par e-mail Cognito |
| Ingestion de données non classifiées PII | Risque de fuite d'informations personnelles | Ingérer après un scan PII |
| Utilisation de données confidentielles sans journalisation d'audit | Violation de conformité | Ingérer après activation des journaux d'audit |
| Stockage de données confidentielles sans chiffrement | Risque de fuite de données | Définir `enableKmsEncryption=true` |
| Autoriser l'accès depuis l'internet public | Risque d'accès non autorisé | Utiliser des restrictions IP / VPN |
| Exécuter le PoC dans le compte de production | Impact sur l'environnement de production | Utiliser un compte sandbox |
| Utilisation de données confidentielles avec Guardrails désactivé | Risque de génération de réponses inappropriées | Définir `enableGuardrails=true` |

---

## Procédure d'expérimentation avec les données de démo uniquement

### Étape 1 : Déployer avec une configuration minimale

```bash
# cdk.context.json minimal
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# Déployer
npx cdk deploy --all --require-approval never

# Données de test + création d'utilisateurs
bash demo-data/scripts/post-deploy-setup.sh
```

### Étape 2 : Vérifier le fonctionnement

```bash
# Obtenir l'URL CloudFront
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "URL d'accès : $URL"
```

### Étape 3 : Vérifier le filtrage des permissions

1. Se connecter en tant que `admin@example.com` → Tous les documents sont recherchables
2. Se connecter en tant que `user@example.com` → Seuls les documents publics sont recherchables
3. Confirmer que des réponses différentes sont retournées pour la même question

### Étape 4 : Évaluation

Mener l'évaluation PoC en utilisant le modèle d'évaluation dans [evaluation.md](evaluation.md).

---

## Procédure d'ingestion de données réelles (après complétion de la liste de vérification)

### Étape 1 : Préparation des données

```bash
# 1. Classifier les documents
# Créer .metadata.json pour chaque document
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. Scan PII (recommandé)
# Détecter les PII avec Amazon Comprehend
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### Étape 2 : Ingestion des données

```bash
# Placer les fichiers sur le volume FSx (via SMB)
# Ou utiliser le chemin de secours S3 bucket
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### Étape 3 : Synchronisation KB

```bash
# Exécuter la synchronisation KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# Attendre la fin de la synchronisation
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### Étape 4 : Tests de permissions

```bash
# Exécuter les tests de matrice de permissions
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## Procédure de retour arrière / suppression de l'environnement

### Retour arrière partiel (suppression des données uniquement)

```bash
# 1. Effacer la synchronisation de la source de données KB
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. Supprimer les données du bucket S3
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. Supprimer les données utilisateur DynamoDB
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### Suppression complète (toutes les ressources)

```bash
# 1. Vider le bucket S3 (si le versionnement est activé)
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy (supprimer toutes les stacks)
npx cdk destroy --all --force

# 3. Supprimer les ressources CDK Bootstrap (si nécessaire)
# ⚠️ Ne pas supprimer si d'autres projets CDK existent
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### Vérification du nettoyage des coûts

```bash
# Vérifier les ressources restantes
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# Vérifier les systèmes de fichiers FSx (la suppression prend du temps)
aws fsx describe-file-systems --region ap-northeast-1

# Vérifier les collections OpenSearch Serverless
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## Dépannage

### Problèmes courants et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| Le déploiement prend plus de 40 minutes | La création de FSx for ONTAP prend du temps | Normal. La création FSx prend 20–30 min |
| La recherche retourne 0 résultat | Sync KB incomplète ou source de données non configurée | Vérifier l'exécution de `StartIngestionJob` |
| Mêmes résultats pour tous les utilisateurs | Données SID non enregistrées | Vérifier la table DynamoDB `user-access` |
| Fail-Closed refuse tout | Erreur de connexion DynamoDB ou absence d'enregistrement SID | Vérifier les journaux Lambda |
| L'Agent ne fonctionne pas | Agent non créé ou pas en état PREPARED | Vérifier le statut de l'Agent dans la console Bedrock |
| Coût plus élevé que prévu | OCU OpenSearch Serverless | Passer à `vectorStoreType=s3vectors` |

### Ressources de support

| Ressource | URL |
|----------|-----|
| GitHub Issues | Onglet Issues du dépôt |
| Documentation AWS (Bedrock) | https://docs.aws.amazon.com/bedrock/ |
| Documentation AWS (FSx ONTAP) | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## Documents associés

| Document | Description |
|----------|-------------|
| [evaluation.md](evaluation.md) | Métriques d'évaluation RAG / Agent |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de vérification pour la mise en production |
| [governance-and-audit.md](governance-and-audit.md) | Conception de la gouvernance et de l'audit |
| [permission-consistency.md](permission-consistency.md) | Modèle de cohérence des changements de permissions |
