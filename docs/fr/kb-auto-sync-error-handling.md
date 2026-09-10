# Conception de la gestion des erreurs KB Auto-Sync

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | [한국어](../ko/kb-auto-sync-error-handling.md) | [简体中文](../zh-CN/kb-auto-sync-error-handling.md) | [繁體中文](../zh-TW/kb-auto-sync-error-handling.md) | **Français** | [Deutsch](../de/kb-auto-sync-error-handling.md) | [Español](../es/kb-auto-sync-error-handling.md)

## Vue d'ensemble

Ce document définit le déroulement en cas d'erreur, la stratégie de reprise, les alertes et les procédures de restauration manuelle de KB Auto-Sync (`enableKbAutoSync=true`).

## Mécanismes de détection des erreurs

### CloudWatch Alarm (détection automatique)

```
EventBridge Scheduler (toutes les 5 min)
  → exécution de la Lambda
    → succès : métriques normales
    → échec : métrique Lambda Errors +1
      → 3 erreurs consécutives : déclenchement de l'alarme CloudWatch
        → notification SNS (si enableMonitoring=true)
```

**Configuration de l'alarme :**
- Nom : `${prefix}-kb-auto-sync-errors`
- Seuil : 1 erreur × 3 périodes consécutives
- Période : identique à l'intervalle d'interrogation (5 minutes par défaut)
- Données manquantes : NOT_BREACHING (pas d'alarme lorsque la Lambda ne s'exécute pas)

### Métriques EMF (supervision détaillée)

La Lambda KB Auto-Sync émet les métriques personnalisées suivantes :

| Métrique | Namespace | Signification |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | Nombre de fichiers analysés |
| `FilesChanged` | `KbAutoSync` | Nombre de fichiers détectés comme modifiés |
| `IngestionJobTriggered` | `KbAutoSync` | Nombre de tâches d'ingestion démarrées |
| `IngestionJobFailed` | `KbAutoSync` | Nombre de tâches d'ingestion en échec |
| `InventoryDiffErrors` | `KbAutoSync` | Nombre d'erreurs de calcul du différentiel d'inventaire |

## Schémas d'erreur et réponses

### Schéma 1 : erreur ListObjectsV2 sur l'Access Point S3

**Cause**: échec de connexion à FSx for ONTAP S3 AP, permissions IAM insuffisantes ou Access Point supprimé

**Comportement**:
- la Lambda journalise l'erreur puis lève une exception
- l'alarme CloudWatch se déclenche après trois échecs consécutifs
- l'inventaire DynamoDB reste inchangé, ce qui préserve l'atomicité

**Restauration manuelle**:
```bash
# 1. Vérifier que l'Access Point S3 existe
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Vérifier l'ARN de l'Access Point dans l'environnement de la Lambda
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. Tester par une invocation manuelle
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### Schéma 2 : échec de la tâche d'ingestion Bedrock KB

**Cause**: mauvaise configuration de la source de données KB, erreur de permission sur l'Access Point S3, ou erreur de découpage/analyse

**Comportement**:
- la Lambda suit l'état avec `StartIngestionJob` puis `GetIngestionJob`
- lorsque l'état est `FAILED` :
  - le fichier passe à `status: "failed"` dans l'inventaire DynamoDB
  - il n'est pas réingéré au prochain cycle, ce qui évite une boucle de reprise infinie
  - la métrique `IngestionJobFailed` est émise
- lorsque l'état est `IN_PROGRESS` :
  - aucune tâche en double n'est lancée (IN_PROGRESS sert d'exclusion mutuelle)

**Restauration manuelle**:
```bash
# 1. Examiner la tâche en échec
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. Retrouver les fichiers en échec dans l'inventaire
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. Réinitialiser l'entrée d'inventaire pour permettre une nouvelle ingestion
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. Démarrer l'ingestion manuellement
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### Schéma 3 : erreur sur la table d'inventaire DynamoDB

**Cause**: capacité DynamoDB épuisée, erreurs de permission, ou table supprimée

**Comportement**:
- la Lambda lève une exception et s'arrête immédiatement
- sécurité intégrée : aucune mise à jour de l'inventaire, donc le cycle suivant réanalyse tout
- l'alarme CloudWatch se déclenche après trois échecs consécutifs

**Restauration manuelle**:
```bash
# Vérifier que la table d'inventaire existe
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# Si la table est absente, redéployer avec CDK
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### Schéma 4 : expiration du délai de la Lambda (au-delà de 5 minutes)

**Cause**: analyse d'un grand nombre de fichiers (>10 000) ou latence élevée de ListObjectsV2

**Comportement**:
- la Lambda expire à 5 minutes et la métrique Errors s'incrémente
- les fichiers partiellement analysés ne sont pas enregistrés dans l'inventaire, ce qui préserve l'atomicité

**Mesures**:
- allonger `kbAutoSyncIntervalMinutes` (par exemple 15 minutes)
- pour un très grand nombre de fichiers, envisager de découper l'Access Point S3 par préfixe

## Stratégie de reprise

| Schéma d'erreur | Reprise automatique | Intervalle | Nombre maximal |
|---|---|---|---|
| Erreur de connexion à l'Access Point S3 | ✅ (cycle suivant) | intervalle d'interrogation (5 min) | illimité (détecté par l'alarme) |
| Échec d'ingestion KB | ❌ (réinitialisation manuelle requise) | — | — |
| Erreur DynamoDB | ✅ (cycle suivant) | intervalle d'interrogation (5 min) | illimité (détecté par l'alarme) |
| Expiration de la Lambda | ✅ (cycle suivant) | intervalle d'interrogation (5 min) | illimité (détecté par l'alarme) |

**Décision de conception** : il n'y a pas de Dead Letter Queue. Dans un schéma d'interrogation périodique piloté par EventBridge Scheduler, une exécution en échec est reprise automatiquement au cycle suivant, donc une DLQ n'apporte rien. L'exception est la tâche d'ingestion KB en échec, qui n'est *pas* reprise automatiquement, car elle peut signaler un problème de qualité des données qu'un humain doit examiner.

## Comportement fail-closed en cas d'échec d'ingestion

Un échec de KB Auto-Sync n'affaiblit pas la frontière de permissions du pipeline RAG :

1. **Un inventaire non mis à jour laisse l'index existant en place.** Les nouveaux fichiers ne deviennent simplement pas interrogeables ; le contrôle des permissions sur les fichiers existants n'est pas touché.
2. **Les fichiers en échec sont marqués `status: "failed"`.** Ils ne sont pas réingérés automatiquement ; l'entrée est réinitialisée après examen humain.
3. **Les tâches IN_PROGRESS s'excluent mutuellement**, ce qui évite l'incohérence qu'une double ingestion provoquerait.
4. **Les fichiers sans métadonnées de permission (`.metadata.json`)** sont écartés par le filtre fail-closed au moment de la recherche, même s'ils atteignent le KB. La règle fail-closed s'applique toujours.

## Tableau de bord de supervision

Lorsque `enableMonitoring=true`, le tableau de bord CloudWatch reçoit ces widgets :

- **KB Auto-Sync Errors** : métrique Lambda Errors (périodes de 5 minutes)
- **Ingestion Job Status** : nombre de tâches réussies, en échec et en cours
- **Files Changed** : fichiers détectés comme modifiés par cycle
- **Scan Duration** : durée d'exécution de la Lambda (P50/P90/P99)

## Documents associés

- [Modèle de cohérence des métadonnées de permission](permission-consistency.md) — comment les mises à jour de permissions se rapportent aux mises à jour de l'index KB, et pourquoi les changements d'ACL ne sont pas répercutés automatiquement
- [Guide du tableau de bord CloudWatch](cloudwatch-dashboard-guide.md) — comment lire les métriques de supervision
- [Liste de contrôle avant production](production-readiness-checklist.md) — exigences avant d'exécuter KB Auto-Sync en production
