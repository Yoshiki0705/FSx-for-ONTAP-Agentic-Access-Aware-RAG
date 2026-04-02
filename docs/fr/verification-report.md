# Guide de vérification

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | [한국어](../ko/verification-report.md) | [简体中文](../zh-CN/verification-report.md) | [繁體中文](../zh-TW/verification-report.md) | **Français** | [Deutsch](../de/verification-report.md) | [Español](../es/verification-report.md)

Ce document décrit les procédures de vérification du bon fonctionnement du système après le déploiement CDK.

---

## 1. Vérification des résultats du déploiement CDK

Confirmez que les 6 stacks sont au statut `CREATE_COMPLETE` ou `UPDATE_COMPLETE`.

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| Stack | Région | Ressources clés |
|-------|--------|-----------------|
| WafStack | us-east-1 | WebACL (6 règles), IP Set |
| NetworkingStack | ap-northeast-1 | VPC, Sous-réseaux, Groupes de sécurité |
| SecurityStack | ap-northeast-1 | Cognito User Pool, Client |
| StorageStack | ap-northeast-1 | FSx ONTAP, S3, DynamoDB×2, AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (sélectionné via `vectorStoreType`), Bedrock Agent (optionnel) |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter), CloudFront |

---

## 2. Récupération des identifiants de ressources

Après le déploiement, récupérez les identifiants de ressources depuis les sorties CloudFormation pour les utiliser dans les étapes de vérification suivantes.

```bash
# スタックプレフィックス（cdk.context.jsonのprojectName-environmentに合わせる）
STACK_PREFIX="perm-rag-demo-demo"

# CloudFront URL
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)

# Lambda Function URL
LAMBDA_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)

# Cognito User Pool ID
COGNITO_POOL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPool`)].OutputValue' --output text)

# Knowledge Base ID
KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

echo "CloudFront: ${CF_URL}"
echo "Lambda URL: ${LAMBDA_URL}"
echo "Cognito:    ${COGNITO_POOL}"
echo "KB ID:      ${KB_ID}"
```

---

## 3. Vérification HTTP de l'application web

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

Résultat attendu : `HTTP 200` avec un Content-Length non nul.

---

## 4. Vérification de l'authentification

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

Résultat attendu : La réponse contient `role: "administrator"`.

---

## 5. Vérification du filtrage SID

Quatre cas de test pour confirmer que le filtrage SID fonctionne correctement.

### Test 1 : Administrateur → Document confidentiel (AUTORISER)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
print(f'フィルタ方式: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

Attendu : `financial-report.md` est ALLOW.

### Test 2 : Utilisateur général → Document confidentiel (REFUSER)

```bash
# 一般ユーザーでサインイン
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user@example.com","password":"DemoUser123!"}' \
  -c /tmp/cookies-user.txt > /dev/null

curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
print(f'フィルタ方式: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

Attendu : `financial-report.md` est DENY.

### Test 3 : Utilisateur général → Document public (AUTORISER)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"製品の概要を教えてください","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件, 拒否: {fl.get(\"deniedDocuments\",0)}件')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

Attendu : `product-catalog.md` est ALLOW.

### Test 4 : Administrateur → Document public (AUTORISER)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"製品の概要を教えてください","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'検索: {fl.get(\"totalDocuments\",0)}件, 許可: {fl.get(\"allowedDocuments\",0)}件')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

Attendu : `product-catalog.md` est ALLOW.

---

## 6. Statut d'implémentation des spécifications

| # | Spécification | Statut | Notes |
|---|---------------|--------|-------|
| 1 | Chatbot RAG Next.js sur Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF (protection IP/Geo) | ✅ | 6 règles + restriction géographique |
| 3 | Authentification IAM de l'API | ⚠️ | Le code CDK utilise IAM Auth + configuration OAC. Problème de signature SigV4 avec les requêtes POST (voir ci-dessous) |
| 4 | Base de données vectorielle | ✅ | S3 Vectors (par défaut) / OpenSearch Serverless (sélectionné via `vectorStoreType`) |
| 5 | Embedding (via Bedrock KB) | ✅ | Titan Embeddings v2 |
| 6 | Filtrage des permissions basé sur les SID | ✅ | DynamoDB + correspondance des SID dans les métadonnées |

### Limitations connues de l'authentification IAM

Avec la combinaison CloudFront OAC + authentification IAM de Lambda Function URL, il existe un problème où les signatures SigV4 pour les requêtes POST ne sont pas calculées correctement (CloudFront ne calcule pas automatiquement le hash SHA256 du corps POST).

- La configuration IAM Auth est maintenue dans le code CDK
- Dans les environnements de vérification, il est possible de changer le AuthType de Function URL à NONE et de protéger avec WAF + restriction géographique
- Dans les environnements de production, le côté client doit inclure l'en-tête `x-Amz-Content-Sha256`

---

## 7. Procédure de mise à jour du conteneur WebApp

Procédure de mise à jour de l'image de conteneur Lambda après des modifications du code frontend.

```bash
# 変数設定（環境に合わせて変更）
ACCOUNT_ID="<ACCOUNT_ID>"
FUNCTION_NAME="<LAMBDA_FUNCTION_NAME>"
DISTRIBUTION_ID="<CLOUDFRONT_DISTRIBUTION_ID>"
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"

# 1. ECR認証
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Dockerイメージビルド & プッシュ
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile docker/nextjs/

docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

docker push \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

# 3. Lambda関数のイメージ更新
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG} \
  --region ap-northeast-1

aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 4. コンテナリフレッシュ（古いコンテナキャッシュを強制更新）
aws lambda put-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1 \
  --reserved-concurrent-executions 0
sleep 15
aws lambda delete-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 5. CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```

---

## 8. Compatibilité des modèles avec l'API KB Retrieve

L'API `RetrieveAndGenerate` de Bedrock KB ne supporte que les modèles Anthropic. L'API KB Retrieve (`route.ts`) effectue les conversions automatiques suivantes sur les identifiants de modèle envoyés depuis le frontend.

| Modèle envoyé | Converti en | Raison |
|----------------|-------------|--------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Les modèles Nova ne sont pas supportés par l'API KB |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Supprime le préfixe du profil d'inférence |
| `anthropic.claude-3-haiku-20240307-v1:0` | Tel quel | Aucune conversion nécessaire |

Implémentation : `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Vérification de Bedrock Agent (enableAgent=true)

### Vérification de la création de l'Agent

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Vérification du Permission-aware Action Group

```bash
LAMBDA_URL="<Lambda Function URL>"

# 管理者テスト（全ドキュメントアクセス可能）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"admin@example.com","sessionId":"test-admin","action":"invoke"}'

# 一般ユーザーテスト（公開ドキュメントのみ）
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"user@example.com","sessionId":"test-user","action":"invoke"}'
```

### Résultats attendus

| Utilisateur | Filtre SID Action Group | Réponse de l'Agent |
|-------------|------------------------|-------------------|
| admin@example.com | 6/6 autorisés (SID : 3) | Réponse détaillée incluant les chiffres financiers |
| user@example.com | 2/6 autorisés (SID : 2) | "Impossible de divulguer les détails", etc. |

### Vérification des logs Lambda de l'Action Group

```bash
# 最新のログを確認
aws logs get-log-events \
  --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
    --order-by LastEventTime --descending --limit 1 \
    --region ap-northeast-1 --query 'logStreams[0].logStreamName' --output text) \
  --region ap-northeast-1 --query 'events[].message' --output text | grep "PermSearch"
```

Logs attendus :
```
[PermSearch] KB: 6 SIDs: 3        # admin : 3 SID
[PermSearch] Allowed: 6 / 6       # admin : Tous les documents autorisés

[PermSearch] KB: 6 SIDs: 2        # user : 2 SID
[PermSearch] Allowed: 2 / 6       # user : Documents publics uniquement
```

### Vérification via l'interface utilisateur

1. Accédez à l'URL CloudFront dans un navigateur
2. Connectez-vous en tant que admin@example.com
3. Cliquez sur le bouton "🤖 Agent" dans l'en-tête → Basculez en mode Agent
4. Sélectionnez un Agent dans la barre latérale
5. Cliquez sur le workflow "📊 Analyse de rapport financier" → Le prompt est pré-rempli
6. Soumettez → Confirmez que la réponse de l'Agent inclut des données financières
7. Déconnectez-vous → Connectez-vous en tant que user@example.com
8. Posez la même question → Confirmez que les données confidentielles ne sont pas incluses