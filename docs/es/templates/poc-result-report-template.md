# Plantilla de informe de resultados de PoC

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | [English](../../en/templates/poc-result-report-template.md) | [한국어](../../ko/templates/poc-result-report-template.md) | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | [繁體中文](../../zh-TW/templates/poc-result-report-template.md) | [Français](../../fr/templates/poc-result-report-template.md) | [Deutsch](../../de/templates/poc-result-report-template.md) | **Español**

**Propósito**: formato para que un partner o integrador informe al cliente de los resultados de un PoC.

---

## 1. Resumen ejecutivo

| Elemento | Contenido |
|---|---|
| Cliente | _____ |
| Periodo | YYYY/MM/DD — YYYY/MM/DD |
| Proceso de negocio objetivo | _____ |
| Documentos incluidos | _____ |
| Usuarios incluidos | _____ |
| Valoración global | ☐ Se recomienda pasar a producción / ☐ Se requiere validación adicional / ☐ No continuar |

---

## 2. Resultados cuantitativos

### 2.1 Calidad del RAG

| Métrica | Objetivo | Medido | Veredicto |
|---|---|---|---|
| Fidelidad (Faithfulness) | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Relevancia de la respuesta | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Precisión del contexto | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| Violaciones de permisos | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 Rendimiento

| Métrica | Objetivo | Medido | Veredicto |
|---|---|---|---|
| Tiempo de respuesta (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| Tiempo de respuesta (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Tasa de acierto de la caché de prompts | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 Impacto en el negocio

| Métrica | Antes del PoC | Después del PoC | Mejora |
|---|---|---|---|
| Tiempo de búsqueda (por consulta) | _____ min | _____ s | _____ % |
| Tasa de resolución en primera respuesta | _____ % | _____ % | _____ pt |
| Acceso a información fuera de permisos | _____ casos | 0 casos | 100% |

---

## 3. Verificación del control de permisos

| Escenario de prueba | Resultado | Notas |
|---|---|---|
| Administrador → acceso a todos los documentos | ☐ Pass / ☐ Fail | |
| Usuario normal → solo documentos públicos | ☐ Pass / ☐ Fail | |
| Permiso de grupo → solo documentos de su departamento | ☐ Pass / ☐ Fail | |
| Cambio de permiso → reflejado | ☐ Pass / ☐ Fail | Retardo máximo: _____ min |
| Documento sin permiso → excluido de los resultados | ☐ Pass / ☐ Fail | |

---

## 4. Costes reales

| Elemento | Estimación mensual | Notas |
|---|---|---|
| FSx for ONTAP | $_____ | |
| Bedrock (inferencia) | $_____ | tras aplicar Smart Routing |
| Bedrock (embedding) | $_____ | inicial + incremental |
| Almacén de vectores | $_____ | S3 Vectors / OpenSearch |
| Otros (Lambda, DynamoDB, CloudFront) | $_____ | |
| **Total** | **$_____** | |

---

## 5. Problemas detectados y recomendaciones

| # | Problema | Impacto | Acción recomendada | Momento |
|---|---|---|---|---|
| 1 | | ☐ Alto / ☐ Medio / ☐ Bajo | | |
| 2 | | ☐ Alto / ☐ Medio / ☐ Bajo | | |
| 3 | | ☐ Alto / ☐ Medio / ☐ Bajo | | |

---

## 6. Siguientes pasos hacia producción

| # | Acción | Responsable | Fecha límite |
|---|---|---|---|
| 1 | Evaluación de seguridad (IAM de mínimo privilegio, cifrado) | | |
| 2 | Prueba de carga (el doble de los usuarios previstos) | | |
| 3 | Diseño de DR (Multi-AZ, copias de seguridad) | | |
| 4 | Diseño operativo (runbook, alertas) | | |
| 5 | Reunión de decisión Go/No-Go | | |

---

## 7. Anexos

- [ ] Capturas del panel de CloudWatch
- [ ] Resultados de la evaluación RAGAS (JSON)
- [ ] Resultados de las pruebas de la matriz de permisos
- [ ] Desglose de costes (AWS Cost Explorer)
- [ ] Resultados de la encuesta a usuarios (si se realizó)
