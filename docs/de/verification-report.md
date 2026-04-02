# Verifizierungsleitfaden

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | [한국어](../ko/verification-report.md) | [简体中文](../zh-CN/verification-report.md) | [繁體中文](../zh-TW/verification-report.md) | [Français](../fr/verification-report.md) | **Deutsch** | [Español](../es/verification-report.md)

Dieses Dokument beschreibt die Verfahren zur Überprüfung, ob das System nach dem CDK-Deployment korrekt funktioniert.

---

## 1. Überprüfung der CDK-Deployment-Ergebnisse

Bestätigen Sie, dass alle 6 Stacks den Status `CREATE_COMPLETE` oder `UPDATE_COMPLETE` haben.

```bash
# projectNameに合わせてプレフィックスを変更（例: perm-rag-demo）
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| Stack | Region | Wichtige Ressourcen |
|-------|--------|---------------------|
| WafStack | us-east-1 | WebACL (6 Regeln), IP Set |
| NetworkingStack | ap-northeast-1 | VPC, Subnetze, Security Groups |
| SecurityStack | ap-northeast-1 | Cognito User Pool, Client |
| StorageStack | ap-northeast-1 | FSx ONTAP, S3, DynamoDB×2, AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (ausgewählt über `vectorStoreType`), Bedrock Agent (optional) |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter), CloudFront |

---

## 2. Abrufen von Ressourcen-IDs

Nach dem Deployment rufen Sie die Ressourcen-IDs aus den CloudFormation-Outputs ab, um sie in den nachfolgenden Verifizierungsschritten zu verwenden.

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

## 3. HTTP-Verifizierung der Webanwendung

```bash
# サインインページが200を返すことを確認
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront経由
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

Erwartetes Ergebnis: `HTTP 200` mit einer Content-Length ungleich Null.

---

## 4. Authentifizierungsverifizierung

```bash
# サインイン（admin）
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# セッション確認
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

Erwartetes Ergebnis: Die Antwort enthält `role: "administrator"`.

---

## 5. SID-Filterung-Verifizierung

Vier Testfälle zur Bestätigung, dass die SID-Filterung korrekt funktioniert.

### Test 1: Administrator → Vertrauliches Dokument (ALLOW)

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

Erwartet: `financial-report.md` ist ALLOW.

### Test 2: Allgemeiner Benutzer → Vertrauliches Dokument (DENY)

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

Erwartet: `financial-report.md` ist DENY.

### Test 3: Allgemeiner Benutzer → Öffentliches Dokument (ALLOW)

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

Erwartet: `product-catalog.md` ist ALLOW.

### Test 4: Administrator → Öffentliches Dokument (ALLOW)

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

Erwartet: `product-catalog.md` ist ALLOW.

---

## 6. Status der Spezifikationsimplementierung

| # | Spezifikation | Status | Hinweise |
|---|---------------|--------|----------|
| 1 | Next.js RAG Chatbot auf Lambda | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF (IP/Geo-Schutz) | ✅ | 6 Regeln + Geo-Einschränkung |
| 3 | API IAM-Authentifizierung | ⚠️ | CDK-Code verwendet IAM Auth + OAC-Konfiguration. SigV4-Signaturproblem bei POST-Anfragen (siehe unten) |
| 4 | Vektordatenbank | ✅ | S3 Vectors (Standard) / OpenSearch Serverless (ausgewählt über `vectorStoreType`) |
| 5 | Embedding (über Bedrock KB) | ✅ | Titan Embeddings v2 |
| 6 | SID-basierte Berechtigungsfilterung | ✅ | DynamoDB + Metadaten-SID-Abgleich |

### Bekannte Einschränkungen der IAM-Authentifizierung

Bei der Kombination von CloudFront OAC + Lambda Function URL IAM-Authentifizierung gibt es ein Problem, bei dem SigV4-Signaturen für POST-Anfragen nicht korrekt berechnet werden (CloudFront berechnet nicht automatisch den SHA256-Hash des POST-Bodys).

- Die IAM Auth-Konfiguration wird im CDK-Code beibehalten
- In Verifizierungsumgebungen ist es möglich, Function URL AuthType=NONE zu setzen und mit WAF + Geo-Einschränkung zu schützen
- In Produktionsumgebungen muss die Client-Seite den `x-Amz-Content-Sha256`-Header einschließen

---

## 7. WebApp-Container-Aktualisierungsverfahren

Verfahren zur Aktualisierung des Lambda-Container-Images nach Frontend-Code-Änderungen.

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

## 8. KB Retrieve API Modellkompatibilität

Die Bedrock KB `RetrieveAndGenerate` API unterstützt nur Anthropic-Modelle. Die KB Retrieve API (`route.ts`) führt die folgenden automatischen Konvertierungen der vom Frontend gesendeten Modell-IDs durch.

| Gesendetes Modell | Konvertiert zu | Grund |
|-------------------|---------------|-------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova-Modelle werden von der KB API nicht unterstützt |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Entfernt Inferenzprofil-Präfix |
| `anthropic.claude-3-haiku-20240307-v1:0` | Unverändert | Keine Konvertierung erforderlich |

Implementierung: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Bedrock Agent-Verifizierung (enableAgent=true)

### Überprüfung der Agent-Erstellung

```bash
# Agent IDとAlias IDを取得
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### Verifizierung der Permission-aware Action Group

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

### Erwartete Ergebnisse

| Benutzer | Action Group SID-Filter | Agent-Antwort |
|----------|------------------------|---------------|
| admin@example.com | 6/6 erlaubt (SIDs: 3) | Detaillierte Antwort mit Finanzzahlen |
| user@example.com | 2/6 erlaubt (SIDs: 2) | "Kann keine Details offenlegen" usw. |

### Überprüfung der Action Group Lambda-Logs

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

Erwartete Logs:
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3 SIDs
[PermSearch] Allowed: 6 / 6       # admin: Alle Dokumente erlaubt

[PermSearch] KB: 6 SIDs: 2        # user: 2 SIDs
[PermSearch] Allowed: 2 / 6       # user: Nur öffentliche Dokumente
```

### UI-Verifizierung

1. Greifen Sie über den Browser auf die CloudFront-URL zu
2. Melden Sie sich als admin@example.com an
3. Klicken Sie auf die Schaltfläche "🤖 Agent" im Header → Wechseln Sie in den Agent-Modus
4. Wählen Sie einen Agent in der Seitenleiste
5. Klicken Sie auf den Workflow "📊 Finanzberichtanalyse" → Prompt wird automatisch ausgefüllt
6. Absenden → Bestätigen Sie, dass die Agent-Antwort Finanzdaten enthält
7. Abmelden → Als user@example.com anmelden
8. Stellen Sie die gleiche Frage → Bestätigen Sie, dass vertrauliche Daten nicht enthalten sind
