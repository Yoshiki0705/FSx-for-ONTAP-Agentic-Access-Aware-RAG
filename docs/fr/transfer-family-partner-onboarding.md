# Guide d'intégration des partenaires Transfer Family

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | [한국어](../ko/transfer-family-partner-onboarding.md) | [简体中文](../zh-CN/transfer-family-partner-onboarding.md) | [繁體中文](../zh-TW/transfer-family-partner-onboarding.md) | **Français** | [Deutsch](../de/transfer-family-partner-onboarding.md) | [Español](../es/transfer-family-partner-onboarding.md)

**Dernière mise à jour** : 2026-05-23  
**Public visé** : configuration de l'accès SFTP pour les partenaires externes (cabinets d'avocats, sociétés d'audit, organismes de réglementation, etc.)

---

## Aperçu

Ce guide explique les étapes de configuration permettant aux partenaires externes de téléverser des documents via SFTP à l'aide d'AWS Transfer Family, avec une ingestion automatique dans la Permission-aware RAG Knowledge Base.

### Architecture

```
Partenaire (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

Les partenaires n'ont besoin que d'un client SFTP. Aucun accès à l'interface web ou à la console AWS n'est requis.

---

## 1. Prérequis

### Côté administrateur système

- [x] CDK déployé avec `enableTransferFamily=true`
- [x] S3 Access Point attaché au volume FSx for ONTAP
- [x] Configuration des autorisations du partenaire enregistrée dans la table de mappage des autorisations DynamoDB

### Côté partenaire

- [x] Client SFTP (FileZilla, WinSCP, OpenSSH, etc.)
- [x] Paire de clés SSH (RSA 4096 bits ou Ed25519)

---

## 2. Préparation de la clé SSH

### Lorsque le partenaire génère la clé

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

Envoyez la **clé publique** générée (`~/.ssh/transfer-family-key.pub`) à l'administrateur système.

> **Remarque de sécurité** : ne partagez jamais la clé privée (`~/.ssh/transfer-family-key`).

### Lorsque l'administrateur système enregistre la clé

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. Paramètres de connexion SFTP

Fournissez les informations de connexion suivantes au partenaire :

| Paramètre | Valeur |
|-----------|-----|
| Hôte | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| Port | `22` |
| Protocole | SFTP |
| Nom d'utilisateur | `partner-a` (attribué par l'administrateur) |
| Méthode d'authentification | Authentification par clé publique SSH |
| Répertoire d'accueil | `/uploads/partner-a/` |

### Commande de connexion (OpenSSH)

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### Configuration de FileZilla

1. **Gestionnaire de sites** → Nouveau site
2. Protocole : **SFTP**
3. Hôte : `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. Type d'authentification : **Fichier de clé**
5. Utilisateur : `partner-a`
6. Fichier de clé : indiquez le chemin de la clé privée

### Configuration de WinSCP

1. **Nouvelle session**
2. Protocole de fichier : **SFTP**
3. Nom d'hôte : point de terminaison Transfer Family
4. Nom d'utilisateur : `partner-a`
5. **Paramètres avancés** → SSH → Authentification → indiquez le fichier de clé privée

---

## 4. Procédure de téléversement de fichiers

### Structure des répertoires

Le répertoire d'accueil du partenaire est limité à `/uploads/partner-a/`.

```
/uploads/partner-a/
├── contracts/          ← Contrats
├── reports/            ← Rapports
├── correspondence/     ← Correspondance
└── misc/               ← Divers
```

### Opérations de téléversement

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### Conventions de nommage des fichiers

| Règle | Description |
|--------|------|
| Extension | `.pdf`, `.docx`, `.txt`, `.md`, `.html` recommandés |
| Nom de fichier | Utiliser des caractères alphanumériques, traits d'union et traits de soulignement |
| Limite de taille | 5 Go (limitation de S3 Access Point) |
| Opérations interdites | Le renommage (rename) et l'ajout (append) de fichiers ne sont pas pris en charge |

### Restrictions

- **La création, la modification et la suppression des fichiers `.metadata.json` sont interdites** (IAM Deny)
- Les métadonnées d'autorisation sont générées automatiquement par le système
- Les opérations rename/append sur les fichiers ne sont pas prises en charge en raison des limitations de S3 Access Point

---

## 5. Vérification de l'ingestion

Après le téléversement, les documents sont traités selon la chronologie suivante :

| Étape | Durée | Description |
|---------|---------|------|
| Détection du fichier | Jusqu'à 5 min | Interrogation par EventBridge Scheduler |
| Génération des métadonnées | Quelques secondes | `.metadata.json` généré automatiquement |
| Ingestion dans la KB | 1 à 5 min | Indexation dans Bedrock Knowledge Base |
| Recherche RAG disponible | Immédiat | Une fois l'ingestion terminée |

### Méthode de vérification (pour l'administrateur système)

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. Dépannage

### Impossible de se connecter

| Symptôme | Cause | Résolution |
|------|------|------|
| `Permission denied (publickey)` | Clé SSH non enregistrée ou non concordante | Demander à l'administrateur de réenregistrer la clé publique |
| `Connection timed out` | Restriction réseau (liste d'autorisation d'IP) | Demander à l'administrateur d'ajouter votre adresse IP |
| `no matching host key type found` | Non-concordance de HostKeyAlgorithms | Ajouter `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` |

### Impossible de téléverser

| Symptôme | Cause | Résolution |
|------|------|------|
| `Permission denied` sur `put` | Accès en dehors du répertoire d'accueil | Téléverser uniquement sous `/uploads/partner-a/` |
| `Permission denied` sur `.metadata.json` | Politique IAM Deny | Les opérations sur les fichiers de métadonnées sont interdites (comportement attendu) |
| `File too large` | Dépassement de la limite de 5 Go | Diviser le fichier avant le téléversement |

### Le fichier n'apparaît pas dans le RAG

| Symptôme | Cause | Résolution |
|------|------|------|
| Pas de prise en compte après plus de 5 min | Attente de l'intervalle d'interrogation ou erreur Lambda | Demander à l'administrateur de vérifier CloudWatch Logs |
| Tâche d'ingestion en état FAILED | Format de fichier non pris en charge | Vérifier les formats pris en charge (PDF, DOCX, TXT, MD, HTML) |

---

## 7. Modèle de sécurité

### Périmètre d'accès du partenaire

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### Génération automatique des métadonnées d'autorisation

Lorsqu'un partenaire téléverse un fichier, le système génère automatiquement `.metadata.json` :

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

Ces informations d'autorisation sont dérivées de la table de configuration gérée par l'administrateur dans DynamoDB. Les partenaires ne peuvent pas spécifier directement les autorisations.

---

## 8. Pour l'administrateur : procédure d'ajout d'un partenaire

### Ajout d'un nouveau partenaire

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### Désactivation d'un partenaire

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## Documentation associée

- [Rapport de vérification E2E Transfer Family](transfer-family-e2e-verification.md)
- [Prérequis réseau Transfer Family](transfer-family-networking-prerequisites.md)
- [Documentation AWS Transfer Family + FSx for ONTAP S3 AP](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
