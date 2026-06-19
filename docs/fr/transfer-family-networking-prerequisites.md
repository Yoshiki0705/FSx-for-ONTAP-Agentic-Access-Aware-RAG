# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | [한국어](../ko/transfer-family-networking-prerequisites.md) | [简体中文](../zh-CN/transfer-family-networking-prerequisites.md) | [繁體中文](../zh-TW/transfer-family-networking-prerequisites.md) | **Français** | [Deutsch](../de/transfer-family-networking-prerequisites.md) | [Español](../es/transfer-family-networking-prerequisites.md)

**Date de création** : 2026-05  
**Portée** : Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## Guide de sélection du type de point de terminaison

Les serveurs Transfer Family prennent en charge deux types de points de terminaison.

| Élément | PUBLIC | VPC |
|------|--------|-----|
| Source d'accès | Via Internet | Au sein du VPC / VPN / Direct Connect |
| Restriction IP | Non prise en charge nativement (NLB requis) | Contrôlable via Security Group |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| Coût | Point de terminaison gratuit | VPC Endpoint facturé à l'heure |
| Cas d'usage recommandé | PoC, partenaires externes (lorsque la restriction IP n'est pas requise) | Production, secteurs réglementés, lorsque la restriction IP est requise |

### Paramètres CDK

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` spécifié : un CDK Warning est émis (un point de terminaison VPC est requis pour la restriction IP)
- `VPC` + `transferFamilyAllowedCidrs` spécifié : des Ingress Rules basées sur CIDR sont ajoutées au Security Group

---

## Configuration du point de terminaison VPC

Exigences lors de la sélection du type de point de terminaison VPC :

### Ressources requises
- VPC (`vpc` prop)
- Private Subnets (`privateSubnets` prop) — où le Transfer Family VPC Endpoint est placé
- Security Group — créé automatiquement par CDK (`TransferSg`)

### Règles de Security Group

| Protocole | Port | Utilisation |
|-----------|--------|------|
| SFTP | TCP 22 | Connexions SFTP |
| FTPS (optionnel) | TCP 21 | Contrôle FTPS |
| FTPS (optionnel) | TCP 8192-8200 | Données passives FTPS |

Lorsque `transferFamilyAllowedCidrs` est spécifié, les ports ci-dessus ne sont autorisés que depuis les CIDR spécifiés.
S'il n'est pas spécifié, l'accès est autorisé depuis `0.0.0.0/0`.

### Chemin d'accès des partenaires

```
外部パートナー
    │
    ▼ (インターネット)
┌─────────────────────┐
│ AWS VPN / Direct    │  ← パートナーVPN接続
│ Connect             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ VPC Endpoint        │  ← Transfer Family
│ (Private Subnet)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ FSx for ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## Configuration du point de terminaison PUBLIC

### Limitations
- Les points de terminaison PUBLIC de Transfer Family ne prennent pas en charge nativement la restriction d'accès basée sur l'adresse IP sans NLB
- Utilisez le type de point de terminaison VPC lorsque la restriction IP des partenaires est requise

### Chemin d'accès des partenaires

```
外部パートナー
    │
    ▼ (インターネット)
┌─────────────────────┐
│ Transfer Family     │
│ PUBLIC Endpoint     │
│ ({server-id}.server │
│  .transfer.{region} │
│  .amazonaws.com)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ FSx for ONTAP           │
│ S3 Access Point     │
└─────────────────────┘
```

---

## Exigences DNS

### S3 Access Point Alias
- Les HomeDirectoryMappings de Transfer Family utilisent l'**alias** S3 AP
- Format d'alias : `{ap-name}-{hash}-s3alias` (ex. : `my-ap-ext-s3alias`)
- La résolution DNS est gérée automatiquement au sein d'AWS (aucune configuration DNS personnalisée nécessaire)

### Point de terminaison Transfer Family
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: Private DNS du VPC Endpoint (via Route 53 Resolver)

---

## Chemin S3 Access Point

Communication entre Transfer Family et le S3 Access Point FSx for ONTAP :
- Acheminée via le réseau interne AWS (ne traverse pas Internet)
- VPC Endpoint for S3 non requis (Transfer Family accède directement au S3 AP)
- Authentification basée sur les rôles IAM (rôle utilisateur SFTP)

### Schéma complet du flux de données

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                                         │
│                                                                            │
│  ┌─────────────┐                                                          │
│  │ Partner     │ SFTP (Port 22)                                           │
│  │ (External)  │─────────────────┐                                        │
│  └─────────────┘                 │                                        │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Transfer Family Server (PUBLIC or VPC Endpoint)                    │    │
│  │ • SecurityPolicy-2024-01                                          │    │
│  │ • HomeDirectoryMappings: /{s3-ap-alias}/uploads/{user}            │    │
│  └──────────────────────────────┬───────────────────────────────────┘    │
│                                  │ S3 API (PutObject)                     │
│                                  │ IAM Role: sftp-{user}-role            │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ S3 Access Point (v4testkbsync-...-ext-s3alias)                    │    │
│  │ • S3 互換 API インターフェース                                      │    │
│  │ • データは FSx for ONTAP 上に存在（S3 にコピーされない）                 │    │
│  └──────────────────────────────┬───────────────────────────────────┘    │
│                                  │ FSx for ONTAP Data Plane                   │
│                                  ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ FSx for ONTAP (VPC: vpc-xxx)                                      │    │
│  │ ┌────────────────────────────────────────────────────────────┐   │    │
│  │ │ SVM: FSxN_OnPre                                             │   │    │
│  │ │ Volume: /s3ap_headobj_test (UNIX security style)            │   │    │
│  │ │ ENI: 10.0.4.209, 10.0.12.245 (SG: sg-xxx)                  │   │    │
│  │ └────────────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Lambda Functions (同一 VPC 内に配置)                               │    │
│  │                                                                    │    │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐      │    │
│  │  │ Ingestion Trigger   │    │ Metadata Generator          │      │    │
│  │  │ • ListObjectsV2     │    │ • PutObject (.metadata.json)│      │    │
│  │  │ • StartIngestionJob │    │ • DynamoDB GetItem           │      │    │
│  │  └──────────┬──────────┘    └─────────────────────────────┘      │    │
│  │             │                                                      │    │
│  │             │ S3 Gateway VPC Endpoint (vpce-xxx)                   │    │
│  │             ▼                                                      │    │
│  │  ┌─────────────────────┐                                          │    │
│  │  │ Bedrock KB          │                                          │    │
│  │  │ StartIngestionJob   │                                          │    │
│  │  └─────────────────────┘                                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Exigences de communication Lambda → S3 AP

| Exigence | Configuration |
|------|------|
| Placement du VPC Lambda | Sous-réseau privé dans le même VPC que FSx for ONTAP |
| S3 Gateway VPC Endpoint | Associé à la table de routage du sous-réseau Lambda |
| Lambda Security Group | Tout le trafic sortant autorisé (S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | Autoriser le trafic entrant HTTPS (443) depuis le Lambda SG |
| IAM | Rôle Lambda avec `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## Liste de contrôle

### Environnement PoC / démo
- [ ] Confirmer que le point de terminaison PUBLIC est suffisant
- [ ] Confirmer que le client SFTP du partenaire peut se connecter à `{server-id}.server.transfer.{region}.amazonaws.com`
- [ ] Préparer la paire de clés SSH
- [ ] Confirmer que Lambda est déployé dans le même VPC que FSx for ONTAP
- [ ] Confirmer que le S3 Gateway VPC Endpoint est inclus dans la table de routage du sous-réseau Lambda

### Environnement de production
- [ ] Sélectionner le type de point de terminaison VPC
- [ ] Confirmer les CIDR IP des partenaires et configurer `transferFamilyAllowedCidrs`
- [ ] Minimiser les règles entrantes du FSx Security Group
- [ ] Minimiser les règles sortantes du Lambda Security Group
- [ ] Confirmer le chemin VPN / Direct Connect
- [ ] Examiner les règles de Security Group
- [ ] Confirmer la résolution DNS (côté partenaire)
- [ ] Confirmer l'ouverture des ports si FTPS est requis
