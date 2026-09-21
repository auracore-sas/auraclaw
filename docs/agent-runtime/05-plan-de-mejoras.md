# 05 · Plan de mejoras

> Plan priorizado por **orden de ejecución**. Cada fase cierra con una medición antes/después y se
> registra en `docs/CUSTOMIZATIONS.md` + `docs/NEXT_SESSION.md`.
>
> Regla de oro: **nada se declara "arreglado" sin número.**

---

## Resumen de fases

| Fase | Qué | Tipo | Riesgo | Bloqueada por |
|---|---|---|---|---|
| **M0** | Victorias rápidas de configuración (SQL, sin código) | Config | **Muy bajo** | — |
| **M1** | Telemetría y presupuesto por turno ([`02`](./02-metricas-y-presupuestos.md)) | Código propio | Bajo | — |
| **M2** | Convergencia: puntos ciegos del guard + compactación ([`01`](./01-diagnostico-bucle-agente.md)) | Código upstream | Bajo | — |
| **M3** | Historial en el puente DSH + agente piloto ([`03`](./03-evaluacion-dsh.md)) | Código upstream | Medio | M0 |
| **M4** | Puente de tools MCP ([`04`](./04-comparativa-runtimes.md) §4) | Código propio | Medio | M3 |
| **M5** | Política de aprobación por clase de herramienta | Decisión + config | Bajo | M4 |
| **M6** | Conciencia de capacidades del canal ([`01`](./01-diagnostico-bucle-agente.md) §8.3) | Prompt | **Muy bajo** | — |

Secuencia: `M0 → M2 → M1 → M3 → M4 → M5`, con **M6** intercalable en cualquier momento.

> **Por qué M2 antes que M1:** M2 para la hemorragia con cambios pequeños y verificables; M1 es la
> inversión que evita que vuelva. Si el tiempo es corto, M0 + M2 dan la mejora visible hoy.

---

## M0 · Victorias rápidas de configuración

**Alcance:** sin tocar código. Tres ajustes de datos y configuración.

| # | Acción | Comando / sitio |
|---|---|---|
| 1 | Bajar `max_iterations` de los agentes de chat a **15** | `UPDATE mate_agent SET max_iterations=15 WHERE id IN (1000000001,1000000003,1000000640);` |
| 2 | Bajar herramientas de uso raro a `disclosure_tier='extension'` | `mate_tool`: dejar ~12 core; el resto a `extension` |
| 3 | Revisar el presupuesto de esquemas de tools | `MATECLAW_TOOL_SCHEMA_MAX_TOKENS` (hoy 40000) en `docker-compose.yml` — ver `CUSTOMIZATIONS.md` |

**Precaución:** el punto 1 depende de que exista el arreglo de convergencia (M2). Bajar el tope sin
M2 hace que los turnos **corten** en vez de converger — es un parche de seguridad, no una solución.

**Criterios de aceptación**

- [ ] `SELECT id,name,max_iterations FROM mate_agent;` → 15 en los tres agentes de chat.
- [ ] `Prefix accounting` en el log muestra `toolSchemas` **muy por debajo** de 33.222.
- [ ] Una pregunta simple ya no llega a 20 iteraciones (aunque sea por corte).

---

## M1 · Telemetría y presupuesto por turno

**Alcance:** lo descrito en [`02`](./02-metricas-y-presupuestos.md). Exponer lo que **ya está
persistido** y poner umbral.

| Ruta | Acción |
|---|---|
| `db/migration/**/V900+__*.sql` (**numeración propia**) | Añadir `wall_seconds`, `iterations`, `repeated_calls` a `mate_usage_daily` |
| `com/auracore/observability/**` (nuevo) | Cálculo de métricas desde `mate_message.metadata.segments` |
| `com/auracore/observability/*Controller.java` (nuevo) | Endpoint de solo lectura por conversación |
| `mateclaw-ui/src/components/chat/*` (propio) | Panel de salud del turno (patrón de `ConversationFilesPanel`) |
| `mateclaw-server/src/test/java/com/auracore/**` | Arnés de evaluación con las 8 tareas y aserción de presupuesto |

**Criterios de aceptación**

- [ ] Las 5 métricas de [`02`](./02-metricas-y-presupuestos.md) §4 salen **sin `docker logs`**.
- [ ] Un turno que excede presupuesto queda marcado (`metadata.budgetExceeded`) y logueado.
- [ ] El arnés falla en rojo si una tarea excede su presupuesto.
- [ ] Mensajes históricos sin `metadata.segments` **no rompen** el reporte.
- [ ] Backend y UI calculan `iterations`/`wall_seconds` con la **misma** fórmula.

**Riesgo:** doble fuente de verdad si la UI recalcula por su cuenta → por eso el endpoint es el único
que calcula.

---

## M2 · Convergencia: puntos ciegos del guard y compactación

**Alcance:** los tres puntos ciegos de [`01`](./01-diagnostico-bucle-agente.md) §4 y la compactación
destructiva.

| # | Cambio | Archivo | Detalle |
|---|---|---|---|
| 1 | Añadir `browser_use` a `IDEMPOTENT_TOOLS` | `ToolLoopGuard.java:67` | Hoy solo tiene 4 herramientas; el navegador es el que más loopea |
| 2 | Tratar 404 / página de error como fallo | `ToolLoopGuard.isFailure()` (`:181`) + salida de `BrowserUseTool` | `Opened: … (title=404 - Page not found)` hoy cuenta como **éxito** |
| 3 | Detector de no-progreso por **tool+args** (ignorando el resultado) | `ToolLoopGuard` | Cierra el hueco del hash: un snippet que cambia resetea el contador |
| 4 | `KEEP_RECENT_TOOL_RESPONSES` configurable (default más alto) | `ReasoningNode.java:140` | Hoy `3` hardcodeado |
| 5 | Usar un **gist truncado** en vez de "cleared" | `ConversationWindowManager.buildAgedPlaceholder()` (`:1128`) | `buildInformativeCleared()` (`:1152`) ya existe y **no se usa** |

**Evidencia que valida el cambio:** sobre los datos persistidos del caso real,
`browser_use` tuvo **59 llamadas con solo 52 argumentos distintos → 7 repeticiones exactas**
(ver [`02`](./02-metricas-y-presupuestos.md) §2.4). Con el cambio 3, esas 7 se habrían detectado.

**Criterios de aceptación**

- [ ] Test que reproduce el caso: 5 llamadas idénticas de `browser_use` → el guard **avisa** y luego **corta**.
- [ ] Test: un resultado con `title=404` cuenta como fallo.
- [ ] Test: dos llamadas iguales con resultados distintos **sí** acumulan (el hueco del hash).
- [ ] Un turno de investigación ya no recompacta 60 respuestas a 3.
- [ ] **Medición**: la misma pregunta baja de 62 iteraciones a un valor dentro del presupuesto.

**Riesgo:** estos archivos son del upstream (superficie de merge media). Los tests nuevos son
**nuestros** y deben conservarse. Registrar cada uno en `CUSTOMIZATIONS.md`.

---

## M3 · Historial en el puente DSH + agente piloto

**Alcance:** hacer que un empleado DSH tenga memoria, y poner un piloto medible.

| # | Acción | Detalle |
|---|---|---|
| 1 | Patch de composición | YAML con `@deepseek-ai/dsh-llm-deepseek` (ver [`03`](./03-evaluacion-dsh.md) §4.2) |
| 2 | Apuntar el runtime | `DSH_JSONRPC_AGENT="/usr/bin/node …/bin.js --profile sdk --patch …"` |
| 3 | **`sessionId` estable** por conversación | Hoy: `conversationId + "-" + UUID.randomUUID()` (`DshRuntimeService.java:245`) |
| 4 | **Enviar el historial** en `contentBlocks` | Hoy: solo el mensaje actual (`:296-298`) |
| 5 | Agente piloto | `UPDATE mate_agent SET runtime_type='dsh' WHERE id=…` (un agente, no los tres) |
| 6 | `DEEPSEEK_API_KEY` en el proveedor | Ya lo inyecta `childEnvironment()` |

**Criterios de aceptación**

- [ ] El piloto completa un turno con streaming y tools, visible en la UI.
- [ ] **Prueba de memoria:** "me llamo Alex" → "¿cómo me llamo?" en el mismo chat → responde Alex.
- [ ] Una conversación **nueva** no hereda ese dato.
- [ ] Cero procesos huérfanos tras la sesión (`ps` limpio).
- [ ] **Medición**: la misma pregunta del caso, en el piloto, dentro del presupuesto.
- [ ] Cancelación desde la UI funciona.

**Riesgos**

| Riesgo | Mitigación |
|---|---|
| DSH pre-1.0 con cambios rompientes | Fijar la versión construida; re-verificar los 3 desajustes de [`03`](./03-evaluacion-dsh.md) §3 antes de cada actualización |
| Editar código del upstream | Cambio mínimo y localizado; registrar en `CUSTOMIZATIONS.md` |
| Coste por turno | Medir con M1 desde el primer día |

---

## M4 · Puente de tools MCP

**Alcance:** opción A de [`04`](./04-comparativa-runtimes.md) §4. Exponer una **superficie mínima y
gobernada** de herramientas de AuraClaw a DSH y a Pi.

| Prioridad | Tool a exponer |
|---|---|
| 1 | `memory_search` / `memory_write` |
| 2 | `wiki_search` / `wiki_read` |
| 3 | `send_file` / artefactos |
| 4 | `telegram_send` (o el canal del usuario) |
| 5 | `query_datasource` (**solo lectura**) |

**Explícitamente fuera del puerto inicial:** `shell`, `execute_code`, escritura en BD y cualquier
acción mutadora sin aprobación.

**Criterios de aceptación**

- [ ] El empleado DSH responde "¿qué dice la wiki sobre X?" usando `wiki_search` real.
- [ ] El empleado DSH escribe en memoria y **otra** conversación lo recupera.
- [ ] Toda llamada a través del puente pasa por **audit**.
- [ ] Una acción sensible (mutadora) cae en **approval gate** y se puede denegar.
- [ ] Con el puente caído, el empleado **degrada con claridad** (no falla en silencio).

---

## M5 · Política de aprobación por clase de herramienta

**Alcance:** decisión de producto sobre [`04`](./04-comparativa-runtimes.md) §3.

Responder por escrito: **¿qué acciones exigen aprobación humana?** Propuesta de partida:

| Clase | Política |
|---|---|
| Lectura (wiki, memoria, BD solo-lectura) | ALLOW |
| Escritura en memoria/wiki | ALLOW (reversible, con audit) |
| Entrega a un canal (Telegram, correo) | **APPROVAL** la primera vez por usuario |
| Escritura en BD / ERP-CRM | **APPROVAL** siempre |
| `shell` / `execute_code` | DENY en el puente; solo dentro del sandbox del motor |

**Criterios de aceptación**

- [ ] La política está escrita, versionada y aplicada por el puente (no solo documentada).
- [ ] Existe un test por clase.
- [ ] La UI muestra la solicitud de aprobación y permite denegar.

---

## M6 · Conciencia de capacidades del canal

**Alcance:** el hallazgo [`01`](./01-diagnostico-bucle-agente.md) §8.3. El agente **niega capacidades
reales** de la plataforma (dijo que no podía mostrar una imagen inline cuando la UI sí lo hace).

**Acción propuesta:** un bloque corto en el prompt del agente con lo que el canal **sabe presentar**:

- imágenes inline, tablas markdown, archivos descargables, gráficas nativas en Telegram.

**Criterios de aceptación**

- [ ] Preguntado "¿puedes mostrar la imagen en el chat?", el agente responde que **sí**.
- [ ] El bloque es corto (no inflar el prompt con las 117 herramientas otra vez).
- [ ] Verificado en al menos 2 canales (web + Telegram).

---

## Orden de ejecución sugerido para la próxima sesión

```
1. M0  (config, minutos)         → medir antes/después con los chats de prueba
2. M2  (guard + compactación)    → medir la misma pregunta
3. M1  (telemetría)              → a partir de aquí, todo se mide solo
4. M3  (piloto DSH)              → medir contra el nativo, mismo modelo
5. M4  (puente MCP)              → cuando el piloto demuestre valor
```

Antes de empezar, **congelar la línea base**: guardar los números actuales de las conversaciones de
prueba (`conv_1790029096976_tsdw26`, `conv_1790028986606_53abf0`) como referencia inmutable, porque
los chats son la única prueba A/B honesta que tenemos.

---

## Qué NO hacer

- ❌ **No tocar `AgentGraphBuilder` / `*Node` / `*Dispatcher`** salvo en M2, y ahí lo mínimo. Es la
  superficie caliente de merge (`docs/CODE_MAP.md`, Módulo 1).
- ❌ **No reconstruir la plataforma.** Ver el análisis en [`README` §Las 5 causas](./README.md) y las
  medidas del cuerpo en `docs/pi-integration/01-contexto-y-decision.md` §3.
- ❌ **No migrar los tres agentes a DSH a la vez.** Un piloto primero.
- ❌ **No introducir un stack de observabilidad** para M1 (ver [`02`](./02-metricas-y-presupuestos.md) §9).
- ❌ **No construir el puente MCP antes del piloto**: primero demostrar que el motor aporta valor.
- ❌ **No poner secretos** en el prompt, en `runtimeConfig` ni en argumentos de línea de comandos.
- ❌ **No crear tags `vX.Y.Z` sin sufijo** (colisionan con el upstream). Si hay release: `v2.2.0-mc.2`.

---

## Registro de avance

| Fecha | Fase | Nota | Commit |
|---|---|---|---|
| 2026-09-21 | D0 | Diagnóstico medido del bucle nativo | — |
| 2026-09-21 | D1 | Spike de DSH end-to-end verificado | — |
| — | M0 | — | — |
| — | M1 | — | — |
| — | M2 | — | — |
| — | M3 | — | — |
| — | M4 | — | — |
| — | M5 | — | — |
| — | M6 | — | — |

> Al cerrar cada fase: actualizar esta tabla, [`README.md`](./README.md), `docs/CUSTOMIZATIONS.md` y
> `docs/NEXT_SESSION.md`.

---

→ Siguiente: [`06-reproduccion-y-entorno.md`](./06-reproduccion-y-entorno.md).
