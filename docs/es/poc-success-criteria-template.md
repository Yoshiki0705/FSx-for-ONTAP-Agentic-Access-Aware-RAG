# Plantilla de criterios de éxito de PoC

**🌐 Language:** [日本語](../poc-success-criteria-template.md) | [English](../en/poc-success-criteria-template.md) | [한국어](../ko/poc-success-criteria-template.md) | [简体中文](../zh-CN/poc-success-criteria-template.md) | [繁體中文](../zh-TW/poc-success-criteria-template.md) | [Français](../fr/poc-success-criteria-template.md) | [Deutsch](../de/poc-success-criteria-template.md) | **Español**

**Fecha de creación**: 2026-05-24  
**Objeto**: Plantilla para definir los criterios de éxito que se acordarán con clientes y socios antes de iniciar un PoC

---

## Puntos a acordar antes del PoC

### 1. Partes interesadas

| Rol | Nombre | Organización | Ámbito de responsabilidad |
|-----|--------|--------------|----------------------------|
| **Patrocinador de negocio** | __________ | __________ | Decisión final Go/No-Go, aprobación del presupuesto |
| **Propietario de los datos** | __________ | __________ | Clasificación/aprobación de los datos cargados, verificación del diseño de permisos |
| **Líder técnico** | __________ | __________ | Implementación, configuración, validación técnica |
| **Evaluador** | __________ | __________ | Evaluación de la calidad de las respuestas, medición de KPI |
| **Responsable de seguridad** | __________ | __________ | Revisión del diseño de permisos, verificación de los registros de auditoría |
| **Responsable de operaciones** | __________ | __________ | Diseño operativo en la migración a producción, definición de SLO |

---

### 2. Objetivos y alcance del PoC

| Elemento | Detalles |
|----------|----------|
| **Problema de negocio a resolver** | (p. ej., la búsqueda de documentos de diseño tarda una media de 15 minutos, lo que provoca retrasos en el proyecto) |
| **Departamentos objetivo** | (p. ej., departamento de diseño + departamento de gestión de calidad, 30 personas en total) |
| **Datos objetivo** | (p. ej., 500 PDF de planos de diseño, 200 especificaciones técnicas, 100 informes de calidad) |
| **Duración del PoC** | (p. ej., 4 semanas — del 2026/06/01 al 2026/06/28) |
| **Límite de presupuesto** | (p. ej., costes de AWS dentro de $2,000/mes) |

---

### 3. Métricas de éxito (criterios Go/No-Go)

#### Métricas obligatorias (Go si se cumplen todas)

| # | Métrica | Objetivo | Método de medición | ¿Cumplido? |
|---|---------|----------|--------------------|------------|
| 1 | Número de violaciones de permisos | **0 incidencias** | Prueba de matriz de permisos + verificación manual | ☐ |
| 2 | Precisión de las respuestas (puntuación de relevancia) | **3.5/5.0 o superior** | Evaluación cualitativa de 10 o más preguntas por el evaluador | ☐ |
| 3 | Tiempo de respuesta (P95) | **10 segundos como máximo** | Métricas de CloudWatch | ☐ |
| 4 | Disponibilidad | **99% o superior** (durante el periodo del PoC) | Alarmas de CloudWatch | ☐ |

#### Métricas deseables (suman puntos si se cumplen)

| # | Métrica | Objetivo | Método de medición | ¿Cumplido? |
|---|---------|----------|--------------------|------------|
| 5 | Tasa de reducción del tiempo de búsqueda | 50% o más | Encuesta de usuarios (Before/After) | ☐ |
| 6 | Tasa de resolución en la primera respuesta | 60% o más | Comentarios de usuarios (👍/👎) | ☐ |
| 7 | Satisfacción de los usuarios | 4.0/5.0 o superior | Encuesta al finalizar el PoC | ☐ |
| 8 | Tasa de respuestas con Citation | 90% o más | Agregación automática | ☐ |

---

### 4. Criterios de decisión Go/No-Go

| Decisión | Condiciones |
|----------|-------------|
| **Go (avanzar a la siguiente fase)** | Todas las métricas obligatorias #1 a #4 cumplidas + 2 o más métricas deseables cumplidas |
| **Conditional Go (condicional)** | Todas las métricas obligatorias #1 a #4 cumplidas + 1 o menos métricas deseables → elaborar un plan de mejora y reevaluar |
| **No-Go (detener/reconsiderar)** | Alguna métrica obligatoria no cumplida → análisis de causa raíz → repetir PoC o cambiar de enfoque |

**Fecha de decisión**: dentro de los 5 días hábiles posteriores al fin del periodo del PoC  
**Responsable de la decisión**: patrocinador de negocio (la persona indicada en la tabla de partes interesadas anterior)

---

### 5. Condiciones para la siguiente fase

Tras una decisión Go, condiciones adicionales para avanzar a producción (L2→L3):

- [ ] Revisión de seguridad completada (sección L2→L3 de la [Lista de verificación de preparación para producción](production-readiness-checklist.md))
- [ ] Diseño operativo completado (definición de SLO, configuración de alarmas, creación del runbook)
- [ ] Estimación de costes aprobada ([Hoja de estimación de costes](cost-estimation-worksheet.md))
- [ ] Aprobación de la carga de datos de producción por parte del propietario de los datos
- [ ] Diseño de conservación de los registros de auditoría aprobado

---

### 6. Riesgos y supuestos

| Riesgo | Impacto | Medida de mitigación |
|--------|---------|----------------------|
| Baja calidad de los datos (precisión del OCR, metadatos faltantes) | Menor precisión de las respuestas | Verificar la calidad con datos de muestra antes del PoC |
| Baja tasa de participación de los usuarios | Datos de evaluación insuficientes | Compartir los objetivos en el lanzamiento, seguimientos semanales |
| Diseño de permisos demasiado complejo | Mayor esfuerzo de configuración | Empezar con un número mínimo de grupos de permisos |
| Calidad de las respuestas del modelo por debajo de lo esperado | Fracaso del PoC | Abordar mediante ajuste de prompts y cambio de la estrategia de chunking |

| Supuesto | Estado |
|----------|--------|
| Cuenta de AWS disponible | ☐ Confirmado |
| Los datos objetivo pueden proporcionarse | ☐ Confirmado |
| Evaluador asignado | ☐ Confirmado |
| Requisitos de red (VPN, etc.) confirmados | ☐ Confirmado |

---

### 7. Plantilla de informe de finalización del PoC

Al finalizar el PoC, cree el siguiente informe y entréguelo al patrocinador de negocio:

```markdown
## Informe de finalización del PoC

### Resumen
- Periodo del PoC: YYYY/MM/DD – YYYY/MM/DD
- Número de usuarios participantes: XX
- Número total de consultas: XXX

### Estado de cumplimiento de las métricas de éxito
| Métrica | Objetivo | Real | Resultado |
|---------|----------|------|-----------|
| ... | ... | ... | ✅/❌ |

### Decisión Go/No-Go
- Decisión: Go / Conditional Go / No-Go
- Justificación: ...

### Recomendaciones para la siguiente fase
1. ...
2. ...

### Cuestiones pendientes
1. ...
```

---

## Documentos relacionados

- [Guía de experimentación segura](safe-experimentation-guide.md) — Definición de lo que se puede probar de forma segura durante el PoC
- [Marco de evaluación de RAG / Agent](evaluation.md) — Métricas de evaluación detalladas y métodos de medición
- [Lista de verificación de preparación para producción](production-readiness-checklist.md) — Lista de verificación completa para la migración L2→L3
- [Hoja de estimación de costes](cost-estimation-worksheet.md) — Estimaciones mensuales de costes por configuración
