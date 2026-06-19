# Rapport de vérification E2E de Transfer Family FSx for ONTAP

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | [한국어](../ko/transfer-family-e2e-verification.md) | [简体中文](../zh-CN/transfer-family-e2e-verification.md) | [繁體中文](../zh-TW/transfer-family-e2e-verification.md) | **Français** | [Deutsch](../de/transfer-family-e2e-verification.md) | [Español](../es/transfer-family-e2e-verification.md)

**Date de vérification**: 2026-05-13
**Région**: ap-northeast-1
**ID du serveur**: s-fb47244ef5ac43a28
**Point de terminaison**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## Résultats de la vérification du flux E2E

| Étape | Résultat | Détails |
|---------|------|------|
| 1. Génération de la clé SSH | ✅ | RSA 4096bit |
| 2. Enregistrement de la clé utilisateur Transfer Family | ✅ | API `import-ssh-public-key` |
| 3. Connexion SFTP | ✅ | Authentification réussie (publickey) |
| 4. Affichage de la liste des fichiers (ls) | ✅ | 2 fichiers affichés |
| 5. Téléversement de fichier (put) | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 1 modification de fichier détectée |
| 7. KB StartIngestionJob | ✅ | ID de tâche `JIGLRZMPEU` |
| 8. Ingestion terminée | ✅ | `COMPLETE`, 1 document nouvellement indexé |

---

## Configuration requise pour le fonctionnement

### 1. Paramètres de contexte CDK

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **Important**: `transferFamilyS3ApAlias` doit être obtenu après la création du S3 Access Point (inconnu au moment du CDK synth).

### 2. Comment obtenir l'alias du S3 Access Point

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. Format de la cible HomeDirectoryMappings

```
✅ Correct: /{s3-access-point-alias}/uploads/demo-user
❌ Incorrect: /{ap-name}/uploads/demo-user
❌ Incorrect: /{ap-arn}/uploads/demo-user
❌ Incorrect: /{alias}/uploads/demo-user/  (barre oblique finale)
```

### 4. Format de Resource de la politique IAM

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ Ne pas utiliser l'alias dans IAM Resource
```

### 5. Condition s3:prefix

```
✅ Correct: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ Incorrect: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
Aucune barre oblique en début n'est requise.

### 6. Actions IAM requises

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. Commande de connexion SFTP

```bash
# Connexion depuis macOS/Linux (spécification de HostKeyAlgorithms requise)
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ Remarque pour l'environnement de production**: Le `StrictHostKeyChecking=no` ci-dessus est destiné à la vérification initiale. En environnement de production, enregistrez la HostKey du serveur Transfer Family dans `~/.ssh/known_hosts` et utilisez `StrictHostKeyChecking=yes` (valeur par défaut). La HostKey peut être obtenue avec `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'`.

### 8. Permissions du système de fichiers FSx for ONTAP

Pour que les utilisateurs Transfer Family puissent lire et écrire des fichiers, l'utilisateur du système de fichiers du S3 Access Point (par exemple, `root`) sur le volume FSx for ONTAP doit disposer des permissions de lecture/écriture sur le répertoire de destination du téléversement.

---

## Problèmes découverts et solutions

### Problème 1: StructuredLogDestinations EarlyValidation

**Symptôme**: Erreur `AWS::EarlyValidation::PropertyValidation` lors de la création du ChangeSet
**Solution**: Supprimer la propriété `structuredLogDestinations`. Sortie de journal standard via `loggingRole` uniquement.

### Problème 2: Barre oblique finale dans HomeDirectoryMappings

**Symptôme**: `Target in mapping has a trailing '/'`
**Solution**: Définir la valeur par défaut de `homeDirectoryPrefix` sur `/uploads/${userName}` (sans barre oblique finale)

### Problème 3: Utilisation du nom de l'AP dans la cible HomeDirectoryMappings

**Symptôme**: `No such file or directory` sur `ls`
**Solution**: Utiliser l'**alias** du S3 AP au lieu du nom de l'AP. Format : `/{alias}/path`.

### Problème 4: Barre oblique en début dans IAM s3:prefix

**Symptôme**: `Permission denied` sur `ls`
**Solution**: Supprimer la barre oblique en début de la condition `s3:prefix`. `uploads/user/*` est correct.

### Problème 5: Incompatibilité de SSH HostKeyAlgorithms

**Symptôme**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**Solution**: Ajouter `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` à la commande SFTP.

### Problème 6: Clé SSH d'espace réservé

**Symptôme**: `Permission denied (publickey)` — l'ancienne clé d'espace réservé subsiste
**Solution**: Supprimer les anciennes clés avec `aws transfer delete-ssh-public-key`, en ne conservant que la clé réelle.

---

## Étapes de configuration manuelle après le déploiement

1. **Créer le S3 Access Point** (hors CDK)
2. **Obtenir l'alias du S3 AP** → le définir dans `cdk.context.json`
3. **Déploiement CDK** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **Générer la clé SSH** (`ssh-keygen -t rsa -b 4096`)
5. **Enregistrer la clé publique SSH** (`aws transfer import-ssh-public-key`)
6. **Supprimer la clé d'espace réservé** (`aws transfer delete-ssh-public-key`)
7. **Test de connexion SFTP**
8. **Exécution manuelle de l'Ingestion Trigger Lambda** pour confirmer la détection

---

## Captures d'écran de la console AWS

### Détails du serveur Transfer Family

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Surveillance de l'Ingestion Trigger Lambda

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Nom de la fonction Lambda : `v4-test-demo-ingestion-trigger`
- Succès d'exécution confirmé

### Ingestion Bedrock KB terminée

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
