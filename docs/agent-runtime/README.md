# Rendimiento y motor del agente — AuraClaw

> Diagnóstico medido del bucle de agentes de AuraClaw (base v2.2.0), evaluación del runtime
> **DSH (DeepSeek Harness)** como motor alternativo, y plan de mejoras priorizado.
>
> Ámbito: `auracore-apps/auraclaw` · Zona de código propia: `com.auracore.*`
> Estado: 🔬 **Diagnóstico cerrado y verificado** · Spike de DSH ejecutado · Mejoras pendientes de implementar
> Fecha: 2026-09-21 (sesión 14ª) · Idioma: español neutro

---

## El problema en una línea

> Una pregunta simple (población mundial + gráfica de pastel) tardó **242 s y 3.007.919 tokens** en el
> runtime nativo con DeepSeek Flash. La misma pregunta al mismo modelo en **Pi tardó 9 s**.
>
> **El modelo no era el problema: el bucle del agente sí.** 62 iteraciones y 68 llamadas a
> herramientas donde deberían ser 2–4.

---

## Veredicto del spike (resumen)

| Pregunta | Respuesta |
|---|---|
| ¿DSH es real e instalable? | **Sí.** `deepseek-ai/deepseek-harness`, MIT, 232.285 ★, 60 paquetes. Compila en ~5,5 min. |
| ¿Está listo el provider en AuraClaw? | **Sí**, completo y con consola de gestión. No hay que escribir código Java. |
| ¿Funciona la instalación documentada? | **No.** El artefacto `dsh-jsonrpc-agent-pkg-<platform>` **no existe** en el repo público y los 18 releases tienen **0 assets**. |
| ¿Hay una vía que funcione? | **Sí, verificada end-to-end**: `DSH_JSONRPC_AGENT` apuntando a `node …/bin.js --profile sdk --patch …`. |
| ¿Cuánto tarda DSH? | **37–58 s** y **9 iteraciones** para la misma pregunta. 4–6× más rápido que el nativo. |
| ¿Sirve tal cual para un "empleado"? | **No todavía**: el puente en `main` envía **solo el mensaje actual** → sin memoria entre turnos. Arreglo pequeño y localizado. |

---

## Mapa de lectura

| # | Documento | Para qué sirve |
|---|---|---|
| 01 | [`01-diagnostico-bucle-agente.md`](./01-diagnostico-bucle-agente.md) | El fallo medido: metodología, números y las 5 causas raíz con `archivo:línea` |
| 02 | [`02-metricas-y-presupuestos.md`](./02-metricas-y-presupuestos.md) | La capa que faltaba: qué medir por turno y con qué presupuesto (el arreglo de fondo) |
| 03 | [`03-evaluacion-dsh.md`](./03-evaluacion-dsh.md) | Spike de DSH: build, los 3 desajustes doc↔realidad, la vía corta y el defecto de historial |
| 04 | [`04-comparativa-runtimes.md`](./04-comparativa-runtimes.md) | Nativo vs DSH vs Pi y el hallazgo que los unifica: **el puente de tools** |
| 05 | [`05-plan-de-mejoras.md`](./05-plan-de-mejoras.md) | Plan por fases, archivos a tocar, criterios de aceptación y riesgos |
| 06 | [`06-reproduccion-y-entorno.md`](./06-reproduccion-y-entorno.md) | Comandos exactos, rutas, versiones y cómo volver a medir |

Orden recomendado: **01 → 03 → 05**. Los demás son consulta.

---

## Diagnóstico en una tabla

Ambos chats son de la misma sesión de prueba (2026-09-21, `agentId=1000000003`
"Analista de Razonamiento", `runtime_type=native`, `max_iterations=100`).

| | DeepSeek Flash | GPT-5-mini |
|---|---|---|
| Turno completo | **241,5 s** | **329,5 s** |
| Iteraciones del bucle | **62** | **29** |
| Llamadas al LLM | 64 | 31 |
| Latencia p50 por llamada | 2.068 ms | **7.732 ms** (p90 17.291, máx 35.728) |
| Tiempo en el LLM | 142,3 s (59 %) | **293,1 s (89 %)** |
| Tiempo en herramientas | **86,3 s (36 %)** | 17,5 s (5 %) |
| Tokens de entrada | **3.007.919** | **1.030.302** |
| Herramientas ejecutadas | 68 (`browser_use` 58) | 31 (`web_search` 22) |

Los dos tienen causa dominante **distinta** (DeepSeek: el bucle y el navegador; GPT-5-mini: la
latencia del modelo), pero comparten el pecado estructural: **iteraciones de más**.

Dato que descarta al modelo como culpable: DeepSeek Flash responde en **2,07 s** de mediana. Era
rápido; el sistema lo llamó **64 veces**.

---

## Las 5 causas raíz (detalle y evidencia en [01](./01-diagnostico-bucle-agente.md))

| # | Causa | Evidencia dura |
|---|---|---|
| 1 | **El bucle no converge** | 29 navegaciones, **10 con 404**; `worldometers.info/world-population/` abierta **5 veces** |
| 2 | **`ToolLoopGuard` no ve este loop** | **0 avisos** en toda la corrida; `browser_use` ausente de `IDEMPOTENT_TOOLS`; un 404 no cuenta como fallo |
| 3 | **La compactación borra la evidencia** | `KEEP_RECENT_TOOL_RESPONSES = 3` (hardcodeado); `Aged-compacted 60 tool response entries (keepRecent=3)` |
| 4 | **117 herramientas en cada llamada** | `toolSchemas=33222` tokens; las 38 filas de `mate_tool` están en `disclosure_tier='core'` → disclosure nulo |
| 5 | **`max_iterations = 100`** | Los 4 agentes en 100; tres migraciones (V47/V48/V124) subiendo el mismo número |

---

## Estado de implementación

| Fase | Qué | Estado |
|---|---|---|
| D0 | Diagnóstico medido del bucle nativo | ✅ Cerrado → [01](./01-diagnostico-bucle-agente.md) |
| D1 | Spike de DSH end-to-end | ✅ Ejecutado y verificado → [03](./03-evaluacion-dsh.md) |
| **M0** | Victorias rápidas de configuración (SQL) | 📐 Listo para aplicar → [05 §M0](./05-plan-de-mejoras.md) |
| **M1** | Telemetría y presupuesto por turno | 📐 Diseñado → [02](./02-metricas-y-presupuestos.md) |
| **M2** | Convergencia: puntos ciegos del guard + compactación | 📐 Diseñado → [05 §M2](./05-plan-de-mejoras.md) |
| **M3** | Historial en el puente DSH + agente piloto | 📐 Diseñado → [05 §M3](./05-plan-de-mejoras.md) |
| **M4** | Puente de tools MCP | 📐 Diseñado → [04 §4](./04-comparativa-runtimes.md) |
| **M5** | Política de aprobación por clase de herramienta | ⏳ Decisión pendiente |
| **M6** | Conciencia de capacidades del canal | 📐 Diseñado → [01 §8.3](./01-diagnostico-bucle-agente.md) |

Secuencia recomendada: `M0 → M2 → M1 → M3 → M4 → M5`, con **M6** intercalable.

> Al cerrar cada fase: actualizar esta tabla, [`docs/CUSTOMIZATIONS.md`](../CUSTOMIZATIONS.md) y
> [`docs/NEXT_SESSION.md`](../NEXT_SESSION.md).

---

## Reglas de esta línea de trabajo

1. **Nada se declara "arreglado" sin número.** Cada mejora de este documento se acepta con una
   medición antes/después (iteraciones, tokens de entrada, segundos).
2. **Código propio en `com.auracore.*`.** `AgentGraphBuilder` / `*Node` / `*Dispatcher` son
   superficie caliente de merge (ver `docs/CODE_MAP.md`, Módulo 1). Se toca lo mínimo y se registra.
3. **El puente DSH (`vip.mate.agent.runtime.dsh.*`) es del upstream.** Cualquier cambio ahí se
   registra en `CUSTOMIZATIONS.md` con su manejo de conflicto.
4. **Español de extremo a extremo**, respetando la regla de marcadores bilingüe.
5. **Documentar el desajuste, no solo el fix**: los 3 desajustes doc↔realidad de [03](./03-evaluacion-dsh.md)
   son la prueba de que este terreno cambia rápido; se re-verifican antes de cada fase.

---

## Próximo paso (sesión de pruebas)

Ver [`05-plan-de-mejoras.md` § orden de ejecución](./05-plan-de-mejoras.md). En corto:

1. **M0** — victorias rápidas de configuración (SQL, sin código). Medir antes/después.
2. **M2** — cerrar los puntos ciegos del guard y la compactación. Medir la misma pregunta.
3. **M1** — telemetría y presupuesto: a partir de aquí todo se mide solo.
4. **M3** — historial en el puente DSH + agente piloto con `runtime_type='dsh'`.
5. **M4** — puente MCP, cuando el piloto demuestre valor.

> Antes de empezar: **congelar la línea base** de `conv_1790029096976_tsdw26` y
> `conv_1790028986606_53abf0` (ver [`06`](./06-reproduccion-y-entorno.md) §5).
