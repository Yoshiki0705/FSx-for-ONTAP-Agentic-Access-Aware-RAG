# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | **Español**

> Implementación de referencia que proporciona RAG Permission-aware + IA Agéntica sobre datos empresariales en FSx for ONTAP, que contrasta los metadatos de permisos de cada documento con el SID / UID-GID del solicitante en tiempo de consulta (Fail-Closed). Despliegue AWS CDK con un solo comando. Desde PoC hasta evaluación de producción.

---

## Comenzar

| Quiero... | Guía | Tiempo |
|-----------|------|--------|
| Probar rápidamente | [Guía de taller PoC](docs/es/poc-workshop-guide.md) | 90 min |
| Desplegar en mi cuenta | [Guía de despliegue](docs/deployment-guide.md) | 30-40 min |
| Validar con datos reales | [Guía de experimentación segura](docs/es/safe-experimentation-guide.md) | 2-4 sem. |
| Evaluar precisión y costo | [Framework de evaluación RAG/Agent](docs/es/evaluation.md) | 1 sem. |
| Evaluar madurez para producción | [Checklist de producción](docs/es/production-readiness-checklist.md) | — |
| Estimar costos | [Hoja de estimación de costos](docs/es/cost-estimation-worksheet.md) | — |

## Qué decidir antes de llegar aquí / Qué no cubre este repositorio

Este repositorio contiene la **implementación y las mediciones**. Las **decisiones** — si FSx for ONTAP encaja, si exponer los datos mediante un S3 Access Point, qué capa sostiene los permisos — están en el [FSx for ONTAP Adoption Playbook](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook).

| Decidir primero | Dónde está la base |
|-----------------|--------------------|
| Si FSx for ONTAP encaja con el problema (incluidos los casos en que no) | [Árboles de decisión](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/reference/decision-trees) |
| Requisitos previos y restricciones de exponer datos vía S3 Access Point (misma cuenta, misma región y la propiedad de que toda solicitud se autoriza con una única identidad) | [dominio data-utilization](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) |
| En qué capa se establece la autorización y qué conserva el registro de auditoría | [dominio security-governance](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/security-governance) |
| Coexistencia NFS / SMB y diseño de identidades de Active Directory | [dominio multiprotocol-identity](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/multiprotocol-identity) |

**No cubierto aquí**: selección de almacenamiento, método de migración, almacenamiento en bloque, diseño de rendimiento y coste. Todo eso está en el lado del Playbook.

**Cubierto aquí**: una implementación RAG que mantiene los metadatos de permisos por documento en un índice y los contrasta con el SID / UID-GID del solicitante en tiempo de consulta (Amazon Bedrock + AWS CDK), los procedimientos de despliegue y operación, y las mediciones de esta arquitectura. **Las ACL originales por archivo no se trasladan a la autorización del usuario final en las rutas que pasan por un S3 Access Point, por lo que los permisos se mantienen como un índice aparte** ([Modelo de consistencia de metadatos de permisos](docs/es/permission-consistency.md)).

<details><summary>📂 Todas las funcionalidades y guías de diseño</summary>

| Categoría | Guía | Contenido |
|-----------|------|-----------|
| Arquitectura | [Vista general de implementación (22 aspectos)](docs/es/implementation-overview.md) | Detalles técnicos de todos los componentes |
| Arquitectura | [Architecture Decision Records](docs/es/architecture-decision-records.md) | Justificación de 6 decisiones clave |
| Permisos | [Arquitectura de filtrado SID](docs/es/SID-Filtering-Architecture.md) | Mecanismo de coincidencia de permisos |
| Auth | [Auth y gestión de usuarios](docs/es/auth-and-user-management.md) | Integración OIDC / SAML / LDAP |
| Seguridad | [Modelo de amenazas](docs/es/threat-model.md) | 10 categorías de amenazas, rutas de ataque |
| Seguridad | [Gobernanza y auditoría](docs/es/governance-and-audit.md) | Logs de auditoría, IA responsable, Guardrails |
| Demo | [Datos demo por industria (7)](demo-data/industry-packs/) | Administración, salud, legal, manufactura, construcción, educación, seguros |
| Todos los docs | [Índice de documentación](docs/es/DOCUMENTATION_INDEX.md) | Lista completa con orden de lectura recomendado |

</details>

---

## Arquitectura

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (Auth: OIDC/SAML/Email)    (Búsqueda RAG + Embedding)   (Datos SID/perm)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**Flujo**: Autenticación → obtener SID de DynamoDB → búsqueda vectorial Bedrock KB → filtrado por coincidencia SID → generar respuesta solo con documentos autorizados

Características principales:
- **RAG Permission-aware** — metadatos de permisos del documento contrastados con el SID / UID-GID del solicitante en consulta (Fail-Closed)
- **IA Agéntica** — Alternar entre modo KB (búsqueda documental) y modo Agent (razonamiento multi-paso)
- **Smart Routing** — Selección automática de Haiku / Sonnet / Opus según complejidad (reducción 40-60% en costos)
- **Bajo costo** — S3 Vectors (pocos dólares/mes) por defecto
- **22 capacidades integradas** — Chat de voz, Guardrails, Graph RAG, Web Search, etc. ([detalles](docs/es/implementation-overview.md))

<details><summary>⚠️ Prerrequisitos y restricciones</summary>

| Elemento | Detalles |
|----------|----------|
| Prerrequisitos | Node.js 22+, Docker, AWS CLI configurado, permisos AdministratorAccess |
| Regiones | ap-northeast-1 (modificable) + us-east-1 (WAF/Web Search, fijo) |
| Versión ONTAP | 9.17.1+ (requisito de S3 Access Points) |
| Restricciones S3 AP | Sin escrituras condicionales, sin Event Notifications, alta latencia ListObjectsV2 |
| Almacén vectorial | S3 Vectors (defecto, límite 2KB filterable) / OpenSearch Serverless (alto rendimiento) |
| IA responsable | Las salidas de IA son señales de asistencia. La decisión final es humana. [Detalles](docs/es/governance-and-audit.md) |

</details>

<details><summary>📚 Repositorios relacionados</summary>

| Repositorio | Uso | Descripción |
|------------|-----|-------------|
| **[Este repo]** | AI / RAG | RAG con filtrado de permisos + IA Agéntica |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless | 17 patrones serverless por industria |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Integración Athena / Glue / EMR / SageMaker |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observabilidad | Entrega de logs de auditoría a Datadog / Splunk / Grafana sin EC2 |
| [FSx-for-ONTAP-Adoption-Playbook — data-utilization](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) | Decisiones de adopción | Hub del dominio data-utilization: comportamiento de autorización del S3 AP, restricciones y opciones de diseño |

</details>

<details><summary>🔧 Desarrolladores</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

Estructura del proyecto y convenciones: [CONTRIBUTING.md](CONTRIBUTING.md). Registro de cambios: [CHANGELOG.md](CHANGELOG.md).

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
