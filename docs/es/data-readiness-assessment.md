# Plantilla de evaluación de preparación de datos

**🌐 Language:** [日本語](../data-readiness-assessment.md) | [English](../en/data-readiness-assessment.md) | [한국어](../ko/data-readiness-assessment.md) | [简体中文](../zh-CN/data-readiness-assessment.md) | [繁體中文](../zh-TW/data-readiness-assessment.md) | [Français](../fr/data-readiness-assessment.md) | [Deutsch](../de/data-readiness-assessment.md) | **Español**

**Fecha de creación**: 2026-05-24  
**Objetivo**: Una plantilla para evaluar la preparación de los datos antes de iniciar un PoC

---

## Resumen

Esta plantilla ayuda a evaluar la preparación de los datos que se van a ingerir en el sistema Permission-aware RAG, apoyando una ejecución de PoC segura y eficaz. Debe ser completada conjuntamente por el propietario de los datos y el responsable técnico.

---

## 1. Verificación de la ubicación de los datos

| # | Elemento | Respuesta |
|---|----------|-----------|
| 1.1 | ¿Dónde se almacenan físicamente los datos? | ☐ Servidor de archivos en las instalaciones ☐ En AWS (S3/EFS/FSx) ☐ SaaS ☐ Otro: ________ |
| 1.2 | Volumen de datos (número de archivos / tamaño total) | Número de archivos: ________, Tamaño total: ________ GB |
| 1.3 | Desglose de formatos de archivo | PDF: ___% / DOCX: ___% / TXT: ___% / Otro: ___% |
| 1.4 | Frecuencia de actualización de los datos | ☐ Diaria ☐ Semanal ☐ Mensual ☐ Ocasional ☐ Estática (sin actualizaciones) |
| 1.5 | Idioma de los datos | ☐ Japonés ☐ Inglés ☐ Mixto ☐ Otro: ________ |

---

## 2. Clasificación de los datos

| Nivel de confidencialidad | Definición | Número de archivos | Ejemplos |
|---------------------------|------------|--------------------|----------|
| **Público** | Puede compartirse externamente | ________ archivos | Catálogos de productos, comunicados de prensa |
| **Interno** | Accesible para todos los empleados | ________ archivos | Políticas internas, información sobre prestaciones |
| **Restringido por departamento** | Solo departamentos específicos | ________ archivos | Planes de proyecto, especificaciones técnicas |
| **Confidencial** | Solo roles específicos | ________ archivos | Informes financieros, información de RR. HH. |
| **Alto secreto** | Solo personas designadas | ________ archivos | Documentos de fusiones y adquisiciones, documentos de litigios legales |

---

## 3. Verificación de la estructura de permisos

| # | Elemento | Respuesta |
|---|----------|-----------|
| 3.1 | ¿Método actual de gestión de permisos? | ☐ NTFS ACL (Active Directory) ☐ Permisos UNIX ☐ Específico de la aplicación ☐ Ninguno (todos tienen acceso) |
| 3.2 | Número de grupos de permisos | ________ grupos |
| 3.3 | Estructura jerárquica de permisos | ☐ Plana ☐ 2 niveles ☐ 3 o más niveles ☐ Desconocida |
| 3.4 | Frecuencia de cambio de permisos | ☐ Diaria ☐ Semanal ☐ Mensual ☐ Trimestral ☐ Casi nunca |
| 3.5 | Confianza en la exactitud de los permisos | ☐ Alta ☐ Media ☐ Baja (se necesita auditoría) |

---

## 4. Verificación de la calidad de los datos

| # | Elemento | Respuesta | Impacto |
|---|----------|-----------|---------|
| 4.1 | ¿Hay PDF escaneados que requieran OCR? | ☐ Ninguno ☐ Algunos ☐ La mayoría | Afecta la precisión del RAG |
| 4.2 | ¿Los nombres de archivo reflejan el contenido? | ☐ Sí ☐ Parcialmente ☐ No | Afecta la precisión de la búsqueda |
| 4.3 | ¿La estructura de carpetas está organizada lógicamente? | ☐ Sí ☐ Parcialmente ☐ No | Afecta el diseño de permisos |
| 4.4 | ¿Hay archivos duplicados? | ☐ Ninguno ☐ Pocos ☐ Muchos | Afecta los costos de almacenamiento |
| 4.5 | ¿Hay archivos obsoletos/no válidos mezclados? | ☐ Ninguno ☐ Pocos ☐ Muchos | Afecta la precisión de las respuestas |

---

## 5. Verificación de cumplimiento y privacidad

| # | Elemento | Respuesta | Acción |
|---|----------|-----------|--------|
| 5.1 | ¿Contiene PII? | ☐ No ☐ Sí → Tipo: ________ | Enmascaramiento o detección de PII con Guardrails |
| 5.2 | ¿Son datos regulados? | ☐ No ☐ Sí → Regulación: ________ | Se requiere revisión legal |
| 5.3 | ¿Existen restricciones de exportación de datos? | ☐ No ☐ Sí | Afecta la selección de región |
| 5.4 | ¿Existen requisitos de retención de datos? | ☐ No ☐ Sí → Período: ________ | Afecta el diseño de las copias de seguridad |
| 5.5 | ¿Existen requisitos de retención de registros de auditoría? | ☐ No ☐ Sí | Se requiere `enableMonitoring=true` |

---

## 6. Aprobación del propietario de los datos

| Elemento de aprobación | Aprobador | Fecha | Firma |
|------------------------|-----------|-------|-------|
| Aprobar la ingesta de datos para el PoC | __________ | ____/____/____ | ________ |
| Confirmar la exactitud de la clasificación de datos | __________ | ____/____/____ | ________ |
| Confirmar la validez del diseño de permisos | __________ | ____/____/____ | ________ |
| Aceptar la eliminación de datos tras el PoC | __________ | ____/____/____ | ________ |

---

## 7. Evaluación de la preparación

Con base en las respuestas de todas las secciones, tome la siguiente decisión:

| Evaluación | Condiciones |
|------------|-------------|
| **Ready** | Todas las secciones 1-6 completadas, PII tratadas, aprobación del propietario de los datos obtenida |
| **Conditional** | Algunos elementos incompletos, pero se puede iniciar con datos de demostración → Preparar los datos en paralelo |
| **Not Ready** | Ubicación de los datos desconocida, estructura de permisos desconocida, PII sin confirmar → Se necesita primero una fase de preparación de datos |

**Resultado de la evaluación**: ☐ Ready ☐ Conditional ☐ Not Ready

**Fecha de la evaluación**: ____/____/____  
**Evaluador**: __________

---

## Documentos relacionados

- [Guía de experimentación segura](safe-experimentation-guide.md) — Qué se puede probar de forma segura y qué está prohibido
- [Plantilla de criterios de éxito del PoC](poc-success-criteria-template.md) — Criterios de decisión Go/No-Go
- [Lista de verificación de preparación para producción](production-readiness-checklist.md) — Lista de verificación de migración L2→L3
- [Diseño de gobernanza y auditoría](governance-and-audit.md) — Esquema de registros de auditoría y requisitos de retención
