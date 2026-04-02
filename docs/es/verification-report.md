# Guía de Verificación

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | [한국어](../ko/verification-report.md) | [简体中文](../zh-CN/verification-report.md) | [繁體中文](../zh-TW/verification-report.md) | [Français](../fr/verification-report.md) | [Deutsch](../de/verification-report.md) | **Español**

Este documento describe los procedimientos para verificar que el sistema funciona correctamente después del despliegue CDK.

---

## 1. Verificación de los resultados del despliegue CDK

Confirme que los 6 stacks están en estado `CREATE_COMPLETE` o `UPDATE_COMPLETE`.

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| Stack | Región | Recursos clave |
|-------|--------|----------------|
| WafStack | us-east-1 | WebACL (6 reglas), IP Set |
| NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups |
| SecurityStack | ap-northeast-1 | Cognito User Pool, Client |
| StorageStack | ap-northeast-1 | FSx ONTAP, S3, DynamoDB×2, AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (seleccionado mediante `vectorStoreType`), Bedrock Agent (opcional) |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter), CloudFront |

---

## 2. Obtención de IDs de recursos

Después del despliegue, obtenga los IDs de recursos de las salidas de CloudFormation para usarlos en los pasos de verificación posteriores.

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

## 3. Verificación HTTP de la aplicación web

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

Resultado esperado: `HTTP 200` con un Content-Length distinto de cero.

---

## 4. Verificación de autenticación

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

Resultado esperado: La respuesta contiene `role: "administrator"`.

---

## 5. Verificación del filtrado SID

Cuatro casos de prueba para confirmar que el filtrado SID funciona correctamente.

### Prueba 1: Administrador → Documento confidencial (ALLOW)

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

Esperado: `financial-report.md` es ALLOW.

### Prueba 2: Usuario general → Documento confidencial (DENY)

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

Esperado: `financial-report.md` es DENY.

### Prueba 3: Usuario general → Documento público (ALLOW)

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

Esperado: `product-catalog.md` es ALLOW.

### Prueba 4: Administrador → Documento público (ALLOW)

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

Esperado: `product-catalog.md` es ALLOW.

---

## 6. Estado de implementación de especificaciones

| # | Especificación | Estado | Notas |
|---|----------------|--------|-------|
| 1 | Next.js RAG Chatbot en Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF (Protección IP/Geo) | ✅ | 6 reglas + restricción geográfica |
| 3 | Autenticación IAM de API | ⚠️ | El código CDK usa IAM Auth + configuración OAC. Problema de firma SigV4 con solicitudes POST (ver abajo) |
| 4 | Base de datos vectorial | ✅ | S3 Vectors (predeterminado) / OpenSearch Serverless (seleccionado mediante `vectorStoreType`) |
| 5 | Embedding (a través de Bedrock KB) | ✅ | Titan Embeddings v2 |
| 6 | Filtrado de permisos basado en SID | ✅ | DynamoDB + coincidencia de SID en metadatos |

### Limitaciones conocidas de la autenticación IAM

Con la combinación de CloudFront OAC + autenticación IAM de Lambda Function URL, existe un problema donde las firmas SigV4 para solicitudes POST no se calculan correctamente (CloudFront no calcula automáticamente el hash SHA256 del cuerpo POST).

- La configuración de IAM Auth se mantiene en el código CDK
- En entornos de verificación, es posible cambiar Function URL AuthType=NONE y proteger con WAF + restricción geográfica
- En entornos de producción, el lado del cliente necesita incluir el encabezado `x-Amz-Content-Sha256`

---

## 7. Procedimiento de actualización del contenedor WebApp

Procedimiento para actualizar la imagen del contenedor Lambda después de cambios en el código frontend.

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

## 8. Compatibilidad de modelos de la API KB Retrieve

La API `RetrieveAndGenerate` de Bedrock KB solo admite modelos Anthropic. La API KB Retrieve (`route.ts`) realiza las siguientes conversiones automáticas en los IDs de modelo enviados desde el frontend.

| Modelo enviado | Convertido a | Razón |
|----------------|-------------|-------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Los modelos Nova no son compatibles con la API KB |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Elimina el prefijo de perfil de inferencia |
| `anthropic.claude-3-haiku-20240307-v1:0` | Sin cambios | No se necesita conversión |

Implementación: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Verificación de Bedrock Agent (enableAgent=true)

### Verificación de la creación del Agent

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Verificación de la Action Group con permisos

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

### Resultados esperados

| Usuario | Filtro SID de Action Group | Respuesta del Agent |
|---------|---------------------------|---------------------|
| admin@example.com | 6/6 permitidos (SIDs: 3) | Respuesta detallada con cifras financieras |
| user@example.com | 2/6 permitidos (SIDs: 2) | "No se pueden revelar detalles", etc. |

### Verificación de logs de Lambda de Action Group

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

Logs esperados:
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3 SIDs
[PermSearch] Allowed: 6 / 6       # admin: Todos los documentos permitidos

[PermSearch] KB: 6 SIDs: 2        # user: 2 SIDs
[PermSearch] Allowed: 2 / 6       # user: Solo documentos públicos
```

### Verificación de UI

1. Acceda a la URL de CloudFront en un navegador
2. Inicie sesión como admin@example.com
3. Haga clic en el botón "🤖 Agent" en el encabezado → Cambie al modo Agent
4. Seleccione un Agent en la barra lateral
5. Haga clic en el flujo de trabajo "📊 Análisis de informe financiero" → El prompt se completa automáticamente
6. Enviar → Confirme que la respuesta del Agent incluye datos financieros
7. Cerrar sesión → Iniciar sesión como user@example.com
8. Haga la misma pregunta → Confirme que los datos confidenciales no están incluidos
