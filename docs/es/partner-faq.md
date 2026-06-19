# FAQ para partners (Preguntas frecuentes)

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | [한국어](../ko/partner-faq.md) | [简体中文](../zh-CN/partner-faq.md) | [繁體中文](../zh-TW/partner-faq.md) | [Français](../fr/partner-faq.md) | [Deutsch](../de/partner-faq.md) | **Español**

**Fecha de creación**: 2026-05-24  
**Público objetivo**: Empresas partner, integradores de sistemas (SI) y firmas de consultoría

---

## Preguntas frecuentes durante las propuestas a clientes

### Q1. ¿Es posible migrar desde un servidor de archivos existente (Windows Server)?

**A**: Sí. FSx for ONTAP admite el mismo protocolo SMB/CIFS que los servidores de archivos Windows Server y conserva las NTFS ACL tal cual. Al unirlo a su dominio de Active Directory existente, la experiencia del usuario permanece sin cambios. Para la migración se pueden usar AWS DataSync o robocopy.

**Documento relacionado**: [Diseño de dimensionamiento y rendimiento de FSx for ONTAP](fsxn-sizing-and-performance.md)

---

### Q2. ¿Quién configura los permisos? ¿Se requiere configuración adicional?

**A**: Las NTFS ACL / permisos UNIX existentes se reflejan directamente en la búsqueda RAG. No se necesita configuración de permisos adicional. Cuando los administradores del servidor de archivos establecen los permisos de carpeta como de costumbre, estos se aplican automáticamente a los resultados de la búsqueda RAG.

**Cómo funciona**: La información de permisos (SID/UID/GID) se registra en el `.metadata.json` de cada archivo y, en el momento de la búsqueda, los resultados se filtran comparándolos con los permisos del usuario.

---

### Q3. ¿Cuántos archivos puede gestionar el sistema?

**A**: Recomendamos las siguientes configuraciones según la escala:

| Escala | Número de archivos | Configuración de FSx | Estimación mensual |
|------|-----------|---------|---------|
| Pequeña (PoC) | Hasta 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| Mediana | Hasta 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| Grande | Hasta 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**Documento relacionado**: [Hoja de cálculo de estimación de costos](cost-estimation-worksheet.md)

---

### Q4. ¿Puede integrarse con los proveedores de identidad existentes (Active Directory / Okta / Auth0)?

**A**: Sí. Se admiten los siguientes métodos de autenticación:

| Método de autenticación | IdP compatibles | Obtención de SID/permisos |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger obtiene el SID de AD automáticamente |
| OIDC | Auth0, Okta, Keycloak, Entra ID | Reclamaciones de grupo OIDC + consulta LDAP |
| LDAP | OpenLDAP, FreeIPA | Obtención directa de UID/GID |
| Correo electrónico/Contraseña | Cognito | Registro manual en DynamoDB |

**Documento relacionado**: [Guía de autenticación y gestión de usuarios](auth-and-user-management.md)

---

### Q5. ¿Cuánto dura un PoC y cuánto cuesta?

**A**: 

| Fase | Duración | Costo de AWS | Actividades |
|---------|------|-----------|---------|
| Despliegue | 1 día | — | Despliegue de CDK + ingesta de datos de prueba |
| Validación básica | 1 semana | ~$100 | Verificación de funcionamiento con datos de demostración |
| PoC con datos del cliente | 2-4 semanas | ~$430/mes | Ingesta de datos reales + evaluación |

También está disponible un **taller práctico de 90 minutos** → [Guía del taller de PoC](poc-workshop-guide.md)

---

### Q6. ¿Se puede proponer a clientes con requisitos de seguridad estrictos (finanzas, salud, sector público)?

**A**: Sí. El sistema incluye las siguientes funciones de seguridad:

- Defensa de 6 capas (restricción Geo → WAF → OAC → IAM Auth → Cognito → filtrado SID)
- Cifrado KMS (S3, DynamoDB, FSx)
- Endpoints de VPC (sin tránsito por Internet)
- Registros de auditoría (CloudTrail + tabla de auditoría de DynamoDB)
- Diseño Fail-Closed (acceso denegado cuando los permisos son desconocidos)
- Bedrock Guardrails (filtrado de contenido, detección de PII)

**Sin embargo**: Las funciones de seguridad técnicas de este sistema no satisfacen automáticamente los requisitos legales o de cumplimiento. Para las cargas de trabajo reguladas, se requieren evaluaciones legales y de cumplimiento específicas del cliente.

**Documentos relacionados**: [Lista de verificación de preparación para producción](production-readiness-checklist.md), [Modelo de amenazas](threat-model.md)

---

### Q7. ¿Es posible la multitenencia (despliegue para varios clientes)?

**A**: Sí. Hay tres patrones de despliegue disponibles:

| Patrón | Nivel de aislamiento | Condiciones aplicables |
|---------|-----------|---------|
| A: Aislamiento por cuenta | Más alto | Requisitos estrictos de aislamiento de datos (finanzas, salud) |
| B: Aislamiento por SVM | Alto | Aislar los datos del cliente dentro de la misma cuenta |
| C: Aislamiento por prefijo | Medio | Enfocado en costos, clientes de pequeña escala |

**Documento relacionado**: [Patrones de despliegue para partners](partner-deployment-patterns.md)

---

### Q8. ¿Cómo se reciben los documentos de partners externos (bufetes de abogados, firmas de auditoría)?

**A**: Se admite la ingesta SFTP a través de AWS Transfer Family. Los partners simplemente cargan archivos mediante un cliente SFTP, y los metadatos de permisos se asignan automáticamente antes de la ingesta en la RAG Knowledge Base.

- Los partners no necesitan acceso a la Web UI ni a la AWS Console
- La sobrescritura de `.metadata.json` se evita mediante IAM Deny (protección del límite de confianza)
- Disponible para búsqueda RAG en un plazo de 5 minutos

**Documento relacionado**: [Incorporación de partners de Transfer Family](transfer-family-partner-onboarding.md)

---

### Q9. ¿Se pueden hacer preguntas por voz?

**A**: Sí. Hay dos modos de chat de voz disponibles:

| Modo | Tecnología | Latencia | Estado |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | Media | GA, desplegable con CDK |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | Baja | Implementado, despliegue por CLI |

El filtrado de permisos se aplica en todo el flujo: entrada de voz → conversión a texto → búsqueda Permission-aware RAG → salida de voz.

---

### Q10. ¿Qué hay de la integración con otros servicios de AWS?

**A**: Los siguientes servicios ya están integrados:

| Servicio | Uso |
|---------|------|
| Amazon Bedrock (KB + Agent) | Búsqueda RAG + colaboración multiagente |
| Amazon Cognito | Autenticación y gestión de usuarios |
| Amazon CloudFront + WAF | CDN + seguridad |
| Amazon S3 Vectors | BD vectorial (bajo costo) |
| Amazon EventBridge | Programación de sincronización automática de KB |
| AWS Transfer Family | Ingesta SFTP |
| Amazon CloudWatch | Supervisión, alertas, paneles |
| AWS Step Functions | Automatización de operaciones de FSx for ONTAP |

---

## FAQ técnica

### Q11. ¿Cuál es la diferencia entre un S3 Access Point y un bucket de S3?

**A**: Un S3 Access Point es una interfaz de acceso compatible con S3 para los volúmenes de FSx for ONTAP. A diferencia de los buckets de S3:

- Los datos permanecen en FSx for ONTAP (no se copian a S3)
- Se puede acceder a los mismos datos tanto a través de NFS/SMB como de la API de S3
- Existe un límite de tamaño de carga de 5 GB
- Las operaciones rename / append no son compatibles

---

### Q12. ¿Qué hay del rollback si falla el despliegue?

**A**: Como CDK se basa en CloudFormation, los despliegues fallidos se revierten automáticamente. Si se necesita un rollback manual:

```bash
# Eliminar una pila específica
npx cdk destroy <stack-name>

# Eliminar todas las pilas
npx cdk destroy --all --force
```

**Documento relacionado**: [Solución de problemas de despliegue](deployment-troubleshooting.md)

---

## Recursos para propuestas y talleres

| Recurso | Uso | Enlace |
|---------|------|--------|
| Datos de demostración específicos del sector | Demos adaptadas al sector del cliente | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| Taller de 90 minutos | Experiencia práctica | [Guía del taller de PoC](poc-workshop-guide.md) |
| Estimación de costos | Adjunto a la propuesta | [Hoja de cálculo de estimación de costos](cost-estimation-worksheet.md) |
| Criterios de éxito del PoC | Acuerdo con el cliente | [Plantilla de criterios de éxito del PoC](poc-success-criteria-template.md) |
| Lista de verificación de preparación para producción | Planificación de la migración | [Lista de verificación de preparación para producción](production-readiness-checklist.md) |
| Diagrama de arquitectura | Adjunto a la propuesta | Sección Architecture en README.md |
