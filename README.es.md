# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | **Español**

> Implementación de referencia que proporciona RAG Permission-aware + IA Agéntica sobre datos empresariales en FSx for ONTAP, con aplicación automática de ACL NTFS / permisos UNIX en tiempo de consulta. Despliegue AWS CDK con un solo comando. Desde PoC hasta evaluación de producción.

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
- **RAG Permission-aware** — ACL NTFS / permisos UNIX aplicados automáticamente en consulta (Fail-Closed)
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
