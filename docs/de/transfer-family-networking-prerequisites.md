# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | [한국어](../ko/transfer-family-networking-prerequisites.md) | [简体中文](../zh-CN/transfer-family-networking-prerequisites.md) | [繁體中文](../zh-TW/transfer-family-networking-prerequisites.md) | [Français](../fr/transfer-family-networking-prerequisites.md) | **Deutsch** | [Español](../es/transfer-family-networking-prerequisites.md)

**Erstellungsdatum**: 2026-05  
**Geltungsbereich**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## Leitfaden zur Auswahl des Endpunkttyps

Transfer Family-Server unterstützen zwei Endpunkttypen.

| Element | PUBLIC | VPC |
|------|--------|-----|
| Zugriffsquelle | Über das Internet | Innerhalb des VPC / VPN / Direct Connect |
| IP-Einschränkung | Nicht nativ unterstützt (NLB erforderlich) | Über Security Group steuerbar |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| Kosten | Endpunkt kostenlos | VPC Endpoint stündliche Abrechnung |
| Empfohlener Anwendungsfall | PoC, externe Partner (wenn keine IP-Einschränkung erforderlich) | Produktion, regulierte Branchen, wenn IP-Einschränkung erforderlich |

### CDK-Parameter

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` angegeben: Es wird ein CDK Warning ausgegeben (für die IP-Einschränkung ist ein VPC-Endpunkt erforderlich)
- `VPC` + `transferFamilyAllowedCidrs` angegeben: Dem Security Group werden CIDR-basierte Ingress Rules hinzugefügt

---

## VPC-Endpunkt-Konfiguration

Anforderungen bei Auswahl des VPC-Endpunkttyps:

### Erforderliche Ressourcen
- VPC (`vpc` prop)
- Private Subnets (`privateSubnets` prop) — wo der Transfer Family VPC Endpoint platziert wird
- Security Group — automatisch von CDK erstellt (`TransferSg`)

### Security-Group-Regeln

| Protokoll | Port | Zweck |
|-----------|--------|------|
| SFTP | TCP 22 | SFTP-Verbindungen |
| FTPS (optional) | TCP 21 | FTPS-Steuerung |
| FTPS (optional) | TCP 8192-8200 | FTPS-Passivdaten |

Wenn `transferFamilyAllowedCidrs` angegeben ist, sind die oben genannten Ports nur von den angegebenen CIDRs zugelassen.
Wenn nicht angegeben, ist der Zugriff von `0.0.0.0/0` zugelassen.

### Partner-Zugriffspfad

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

## PUBLIC-Endpunkt-Konfiguration

### Einschränkungen
- Transfer Family PUBLIC-Endpunkte unterstützen ohne NLB keine native IP-adressbasierte Zugriffsbeschränkung
- Verwenden Sie den VPC-Endpunkttyp, wenn eine Partner-IP-Einschränkung erforderlich ist

### Partner-Zugriffspfad

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

## DNS-Anforderungen

### S3 Access Point Alias
- Die HomeDirectoryMappings von Transfer Family verwenden den S3 AP-**Alias**
- Alias-Format: `{ap-name}-{hash}-s3alias` (z. B. `my-ap-ext-s3alias`)
- Die DNS-Auflösung erfolgt automatisch innerhalb von AWS (keine benutzerdefinierte DNS-Konfiguration erforderlich)

### Transfer Family-Endpunkt
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: Private DNS des VPC Endpoint (über Route 53 Resolver)

---

## S3 Access Point-Pfad

Kommunikation zwischen Transfer Family und dem FSx for ONTAP S3 Access Point:
- Über das interne AWS-Netzwerk geleitet (durchläuft nicht das Internet)
- VPC Endpoint for S3 nicht erforderlich (Transfer Family greift direkt auf S3 AP zu)
- IAM-rollenbasierte Authentifizierung (SFTP-Benutzerrolle)

### Vollständiges Datenflussdiagramm

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

### Lambda → S3 AP Kommunikationsanforderungen

| Anforderung | Konfiguration |
|------|------|
| Lambda-VPC-Platzierung | Privates Subnetz im selben VPC wie FSx for ONTAP |
| S3 Gateway VPC Endpoint | Der Routing-Tabelle des Lambda-Subnetzes zugeordnet |
| Lambda Security Group | Gesamter ausgehender Verkehr zugelassen (S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | Eingehenden HTTPS (443)-Verkehr vom Lambda SG zulassen |
| IAM | Lambda-Rolle mit `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## Checkliste

### PoC- / Demo-Umgebung
- [ ] Bestätigen, dass der PUBLIC-Endpunkt ausreichend ist
- [ ] Bestätigen, dass der SFTP-Client des Partners eine Verbindung zu `{server-id}.server.transfer.{region}.amazonaws.com` herstellen kann
- [ ] SSH-Schlüsselpaar vorbereiten
- [ ] Bestätigen, dass Lambda im selben VPC wie FSx for ONTAP bereitgestellt ist
- [ ] Bestätigen, dass der S3 Gateway VPC Endpoint in der Routing-Tabelle des Lambda-Subnetzes enthalten ist

### Produktionsumgebung
- [ ] VPC-Endpunkttyp auswählen
- [ ] Partner-IP-CIDRs bestätigen und `transferFamilyAllowedCidrs` konfigurieren
- [ ] Eingehende Regeln der FSx Security Group minimieren
- [ ] Ausgehende Regeln der Lambda Security Group minimieren
- [ ] VPN- / Direct Connect-Pfad bestätigen
- [ ] Security-Group-Regeln überprüfen
- [ ] DNS-Auflösung bestätigen (Partnerseite)
- [ ] Portöffnung bestätigen, falls FTPS erforderlich ist
