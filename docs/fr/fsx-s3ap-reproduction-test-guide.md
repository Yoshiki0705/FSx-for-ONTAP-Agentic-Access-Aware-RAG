# Guide de test de reproduction FSx ONTAP S3 Access Point

**🌐 Language:** [日本語](../fsx-s3ap-reproduction-test-guide.md) | [English](../en/fsx-s3ap-reproduction-test-guide.md) | [한국어](../ko/fsx-s3ap-reproduction-test-guide.md) | [简体中文](../zh-CN/fsx-s3ap-reproduction-test-guide.md) | [繁體中文](../zh-TW/fsx-s3ap-reproduction-test-guide.md) | **Français** | [Deutsch](../de/fsx-s3ap-reproduction-test-guide.md) | [Español](../es/fsx-s3ap-reproduction-test-guide.md)

**Objectif** : Isoler si le problème AccessDenied de FSx ONTAP S3 AP est spécifique aux SCP de l'Organisation ou une limitation inhérente de FSx ONTAP S3 AP

---

## Prérequis

- Un compte AWS sans restrictions SCP d'Organisation (ou un compte avec des restrictions confirmées)
- Région ap-northeast-1 (Tokyo)
- AWS CLI v2, CDK v2

## Étapes de reproduction

### Étape 1 : Déploiement FSx ONTAP + Managed AD

```bash
# CDK bootstrap (utiliser --method=direct pour contourner le Hook CloudFormation si présent)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk bootstrap --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors

# Déployer tous les stacks (Networking + Security + Storage + AI + WebApp)
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val \
  -c vectorStoreType=s3vectors -c enableAgent=true \
  -c imageTag=latest --require-approval never --method=direct
```

### Étape 2 : Jonction SVM à l'AD

```bash
# Obtenir les IP DNS de l'AD
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)
echo "AD DNS IPs: $AD_DNS_IPS"

# Obtenir l'ID de la SVM
SVM_ID=$(aws fsx describe-storage-virtual-machines --region ap-northeast-1 \
  --query 'StorageVirtualMachines[0].StorageVirtualMachineId' --output text)
echo "SVM ID: $SVM_ID"

# Joindre la SVM à l'AD (la spécification de l'OU est requise)
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1

# Attendre la fin de la jonction AD (2-3 minutes)
watch -n 10 "aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].{Lifecycle:Lifecycle,AD:ActiveDirectoryConfiguration.SelfManagedActiveDirectoryConfiguration.DomainName}'"
# Succès quand Lifecycle: CREATED, AD: DEMO.LOCAL
```

> **Remarque** : Sans spécification de l'OU, le statut devient MISCONFIGURED. Les ports AD (636, 135, 464, 3268-3269, 1024-65535) sont requis dans le SG FSx (déjà reflété dans le code CDK).

### Étape 3 : Configuration du mot de passe admin FSx ONTAP + Création du partage CIFS

```bash
# Définir le mot de passe admin FSx
FS_ID=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].FileSystemId' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword": "FsxAdmin123!"}' --region ap-northeast-1

# Obtenir l'IP de gestion ONTAP
MGMT_IP=$(aws fsx describe-file-systems --region ap-northeast-1 \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# Créer le partage CIFS depuis une instance EC2 dans le VPC (API REST ONTAP)
# Le nom de la SVM est généré à partir du projectName+environment CDK (ex. : s3aptestval + svm)
curl -sk -u 'fsxadmin:FsxAdmin123!' "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H 'Content-Type: application/json' \
  -d '{"svm": {"name": "<SVM_NAME>"}, "name": "data", "path": "/data"}'
```

### Étape 4 : Placer les fichiers via SMB

```bash
SVM_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --region ap-northeast-1 --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

# Placer les fichiers via SMB depuis une instance EC2 dans le VPC
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "mkdir public; mkdir confidential"

# Créer et uploader les documents de test
echo "Test document content" > /tmp/test.txt
echo '{"metadataAttributes":{"allowed_group_sids":"[\"S-1-1-0\"]"}}' > /tmp/test.txt.metadata.json

smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' \
  -c "cd public; put /tmp/test.txt; put /tmp/test.txt.metadata.json"

# Vérifier les fichiers
smbclient //$SVM_IP/data -U 'demo.local\Admin%<AD_PASSWORD>' -c "cd public; ls"
```

### Étape 5 : Créer le S3 Access Point

```bash
VOL_ID=$(aws fsx describe-volumes --region ap-northeast-1 \
  --query 'Volumes[?OntapConfiguration.JunctionPath==`/data`].VolumeId' --output text)

# Créer le S3 AP WINDOWS
aws fsx create-and-attach-s3-access-point \
  --name s3ap-test-ap \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "'$VOL_ID'",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "demo.local\\Admin"}
    }
  }' --region ap-northeast-1

# Attendre le statut AVAILABLE (environ 1 minute)
watch -n 10 "aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[*].{Name:Name,Status:Lifecycle}'"
```

### Étape 6 : Configurer la politique S3 AP

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

aws s3control put-access-point-policy \
  --account-id $ACCOUNT_ID \
  --name s3ap-test-ap \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "AllowAccountAccess",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::'$ACCOUNT_ID':root"},
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap",
        "arn:aws:s3:ap-northeast-1:'$ACCOUNT_ID':accesspoint/s3ap-test-ap/object/*"
      ]
    }]
  }' --region ap-northeast-1
```

### Étape 7 : Test d'accès S3 AP (point de vérification de la reproduction)

```bash
# Obtenir l'alias S3 AP
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query 'S3AccessPointAttachments[0].S3AccessPoint.Alias' --output text)
echo "S3 AP Alias: $S3AP_ALIAS"

# Test 1 : ListObjectsV2
aws s3api list-objects-v2 --bucket "$S3AP_ALIAS" --region ap-northeast-1

# Test 2 : GetObject
aws s3api get-object --bucket "$S3AP_ALIAS" --key "public/test.txt" /tmp/output.txt --region ap-northeast-1

# Test 3 : s3 ls
aws s3 ls "s3://${S3AP_ALIAS}/" --region ap-northeast-1

# Test 4 : PutObject
echo "new file" | aws s3 cp - "s3://${S3AP_ALIAS}/public/new-file.txt" --region ap-northeast-1
```

## Résultats attendus

### Si le problème est lié aux SCP de l'Organisation (actuellement rencontré dans ce compte)
- Tous les tests de l'étape 7 retournent AccessDenied
- Réussit dans un compte différent (sans restrictions SCP)

### Si le problème est une limitation inhérente de FSx ONTAP S3 AP
- Le même AccessDenied se produit également dans un compte différent

## Paramètres vérifiés (confirmés comme n'étant pas la cause)

| Élément | Statut | Notes |
|---------|--------|-------|
| Version ONTAP | 9.17.1P4 | Répond à l'exigence S3 AP (9.17.1 ou ultérieur) |
| Protocole S3 | Activé | `allowed_protocols` inclut `s3` |
| Jonction SVM AD | CREATED | Réussie avec spécification de l'OU |
| Statut S3 AP | AVAILABLE | Créé avec la SVM jointe à l'AD |
| ACL NTFS | Everyone: Full Control | ACL racine du volume |
| Politique S3 AP | s3:* pour la racine du compte | Format ARN du point d'accès |
| Politique IAM | AdministratorAccess | Inclut s3:* |
| Réseau | Même VPC/sous-réseau | FSx et AD dans le même sous-réseau |
| Block Public Access | Non configuré (niveau compte) | FSx S3 AP impose par défaut |
| Mapping utilisateur UNIX | root (UID 0) enregistré | Résolvable via name-service |

## Nettoyage

```bash
# Supprimer le S3 AP
aws fsx detach-and-delete-s3-access-point --name s3ap-test-ap --region ap-northeast-1

# Supprimer tous les stacks
CDK_DEFAULT_ACCOUNT=<ACCOUNT_ID> CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" \
  -c projectName=s3ap-test -c environment=val -c vectorStoreType=s3vectors \
  --force
```


---

## Résultats d'isolation (31/03/2026)

### Résultats des tests

| Compte | Organisation | Accès S3 AP | Résultat |
|--------|-------------|-------------|----------|
| Ancien compte (personnel) | Aucune | ✅ Succès (réponse vide) | Pas d'AccessDenied |
| Nouveau compte (CDS) | Oui (restrictions SCP) | ❌ AccessDenied | Les SCP de l'Organisation bloquent |

### Conclusion

**Le problème AccessDenied de FSx ONTAP S3 AP est causé par les SCP de l'Organisation.**

Confirmé que le même pattern d'accès S3 AP fonctionne correctement dans l'ancien compte (ne faisant pas partie d'une Organisation). AccessDenied ne se produit que dans le nouveau compte (faisant partie d'une Organisation avec des restrictions SCP).

### Remédiation

Effectuez l'une des actions suivantes dans le compte de gestion de l'Organisation :
1. Ajouter une déclaration aux SCP qui autorise l'accès au FSx ONTAP S3 AP
2. Exclure le compte cible des restrictions SCP
3. Identifier les actions/patterns de ressources S3 bloqués par les SCP et exclure le pattern ARN FSx S3 AP (`arn:aws:s3:<region>:<account>:accesspoint/*`)