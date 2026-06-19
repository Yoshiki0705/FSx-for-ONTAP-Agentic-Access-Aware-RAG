# Transfer Family Networking Prerequisites
**🌐 Language:** [日本語](../transfer-family-networking-prerequisites.md) | [English](../en/transfer-family-networking-prerequisites.md) | [한국어](../ko/transfer-family-networking-prerequisites.md) | [简体中文](../zh-CN/transfer-family-networking-prerequisites.md) | [繁體中文](../zh-TW/transfer-family-networking-prerequisites.md) | [Français](../fr/transfer-family-networking-prerequisites.md) | [Deutsch](../de/transfer-family-networking-prerequisites.md) | **Español**

**Fecha de creación**: 2026-05  
**Alcance**: Transfer Family FSx for ONTAP Ingestion (`enableTransferFamily=true`)

---

## Guía de selección del tipo de punto de enlace

Los servidores de Transfer Family admiten dos tipos de puntos de enlace.

| Elemento | PUBLIC | VPC |
|------|--------|-----|
| Origen de acceso | A través de Internet | Dentro del VPC / VPN / Direct Connect |
| Restricción de IP | No compatible de forma nativa (requiere NLB) | Controlable mediante Security Group |
| DNS | `{server-id}.server.transfer.{region}.amazonaws.com` | VPC Endpoint DNS |
| Costo | Punto de enlace gratuito | VPC Endpoint con facturación por hora |
| Caso de uso recomendado | PoC, socios externos (cuando no se requiere restricción de IP) | Producción, sectores regulados, cuando se requiere restricción de IP |

### Parámetros de CDK

```json
{
  "transferFamilyEndpointType": "PUBLIC",
  "transferFamilyAllowedCidrs": ["203.0.113.0/24", "198.51.100.0/24"]
}
```

- `PUBLIC` + `transferFamilyAllowedCidrs` especificado: se emite un CDK Warning (se requiere un punto de enlace VPC para la restricción de IP)
- `VPC` + `transferFamilyAllowedCidrs` especificado: se añaden Ingress Rules basadas en CIDR al Security Group

---

## Configuración del punto de enlace VPC

Requisitos al seleccionar el tipo de punto de enlace VPC:

### Recursos necesarios
- VPC (`vpc` prop)
- Private Subnets (`privateSubnets` prop) — donde se coloca el Transfer Family VPC Endpoint
- Security Group — creado automáticamente por CDK (`TransferSg`)

### Reglas de Security Group

| Protocolo | Puerto | Propósito |
|-----------|--------|------|
| SFTP | TCP 22 | Conexiones SFTP |
| FTPS (opcional) | TCP 21 | Control de FTPS |
| FTPS (opcional) | TCP 8192-8200 | Datos pasivos de FTPS |

Cuando se especifica `transferFamilyAllowedCidrs`, los puertos anteriores solo se permiten desde los CIDR especificados.
Si no se especifica, se permite el acceso desde `0.0.0.0/0`.

### Ruta de acceso del socio

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

## Configuración del punto de enlace PUBLIC

### Limitaciones
- Los puntos de enlace PUBLIC de Transfer Family no admiten de forma nativa la restricción de acceso basada en direcciones IP sin un NLB
- Use el tipo de punto de enlace VPC cuando se requiera la restricción de IP del socio

### Ruta de acceso del socio

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

## Requisitos de DNS

### S3 Access Point Alias
- Los HomeDirectoryMappings de Transfer Family usan el **alias** de S3 AP
- Formato de alias: `{ap-name}-{hash}-s3alias` (p. ej., `my-ap-ext-s3alias`)
- La resolución de DNS se gestiona automáticamente dentro de AWS (no se necesita configuración de DNS personalizada)

### Punto de enlace de Transfer Family
- PUBLIC: `{server-id}.server.transfer.{region}.amazonaws.com`
- VPC: Private DNS del VPC Endpoint (a través de Route 53 Resolver)

---

## Ruta de S3 Access Point

Comunicación entre Transfer Family y el S3 Access Point de FSx for ONTAP:
- Enrutada a través de la red interna de AWS (no atraviesa Internet)
- VPC Endpoint for S3 no requerido (Transfer Family accede directamente al S3 AP)
- Autenticación basada en roles de IAM (rol de usuario SFTP)

### Diagrama completo del flujo de datos

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

### Requisitos de comunicación Lambda → S3 AP

| Requisito | Configuración |
|------|------|
| Ubicación del VPC de Lambda | Subred privada en el mismo VPC que FSx for ONTAP |
| S3 Gateway VPC Endpoint | Asociado a la tabla de rutas de la subred de Lambda |
| Lambda Security Group | Todo el tráfico saliente permitido (S3 AP + DynamoDB + Bedrock) |
| FSx Security Group | Permitir tráfico entrante HTTPS (443) desde el Lambda SG |
| IAM | Rol de Lambda con `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` (S3 AP ARN) |

---

## Lista de verificación

### Entorno PoC / demostración
- [ ] Confirmar que el punto de enlace PUBLIC es suficiente
- [ ] Confirmar que el cliente SFTP del socio puede conectarse a `{server-id}.server.transfer.{region}.amazonaws.com`
- [ ] Preparar el par de claves SSH
- [ ] Confirmar que Lambda está desplegado en el mismo VPC que FSx for ONTAP
- [ ] Confirmar que el S3 Gateway VPC Endpoint está incluido en la tabla de rutas de la subred de Lambda

### Entorno de producción
- [ ] Seleccionar el tipo de punto de enlace VPC
- [ ] Confirmar los CIDR de IP del socio y configurar `transferFamilyAllowedCidrs`
- [ ] Minimizar las reglas entrantes del FSx Security Group
- [ ] Minimizar las reglas salientes del Lambda Security Group
- [ ] Confirmar la ruta de VPN / Direct Connect
- [ ] Revisar las reglas de Security Group
- [ ] Confirmar la resolución de DNS (lado del socio)
- [ ] Confirmar la apertura de puertos si se requiere FTPS
