# 01 · Diagnóstico del bucle de agentes

> El fallo medido: por qué una pregunta simple costó 242 s y 3 millones de tokens.
> Todo lo de este documento sale de logs reales de una sesión de prueba, no de inspección de código.

---

## 1. El síntoma reportado

> "Hola. Tu ayuda para investigar la cantidad de personas en el planeta tierra, y mostrar una gráfica
> tipo pastel que muestre cuántos hombres y cuántas mujeres existen."

Dos conversaciones, mismo agente (`agentId=1000000003`, "Analista de Razonamiento",
`agent_type=react`, `runtime_type=native`, `max_iterations=100`), distinto modelo elegido en la UI:

| | DeepSeek Flash | GPT-5-mini |
|---|---|---|
| `conversation_id` | `conv_1790029096976_tsdw26` | `conv_1790028986606_53abf0` |
| Ventana | 06:18:23,866 → 06:22:25,330 | 06:17:04,571 → 06:22:34,035 |
| **Turno completo** | **241,5 s** | **329,5 s** |

Referencia de contraste: la misma pregunta, al mismo modelo DeepSeek Flash, en un harness directo
(**Pi**) tomó **~9 s**. Esa comparación es la que descarta al modelo como causa.

---

## 2. Método de medición (reproducible)

Fuente: logs del contenedor `mateclaw-server`, con `ReActLifecycleListener` emitiendo duraciones por
nodo y `NodeStreamingChatHelper` emitiendo `perf_summary` por llamada al LLM.

```bash
docker logs mateclaw-server > /tmp/auraclaw-container.log 2>&1
sed -i -e 's/\x1b\[[0-9;]*m//g' /tmp/auraclaw-container.log

# líneas por nodo con duración, atribuidas por traceId
grep 'ReAct\]' /tmp/auraclaw-container.log \
  | sed -nE 's/^([0-9:,]+).*\[ReAct\] node=([a-z_]+) event=complete iteration=([0-9]+) durationMs=([0-9]+).*traceId=([0-9a-f]+).*$/\1|\2|\3|\4|\5/p' \
  > /tmp/react.tsv
```

Los `traceId` de la sesión son `490052fa` (GPT-5-mini) y `0520dfa1` (DeepSeek Flash).
Detalle completo de comandos en [`06-reproduccion-y-entorno.md`](./06-reproduccion-y-entorno.md).

> **Nota de proceso:** todo este diagnóstico se extrajo **a mano** de `docker logs`. Eso es
> exactamente la deuda que ataca el documento [`02`](./02-metricas-y-presupuestos.md): no hay
> ninguna superficie de producto donde estos números existan.

---

## 3. Desglose por nodo del grafo

Tiempo acumulado por tipo de nodo (ms reales de `durationMs`, no wall-clock):

| Nodo | DeepSeek Flash | GPT-5-mini |
|---|---|---|
| `reasoning` (llamada al LLM) | 63 × **142,3 s** | 30 × **293,1 s** |
| `action` (ejecución de tools) | 62 × **86,3 s** | 29 × 17,5 s |
| `summarizing` | 2 × 10,3 s | 1 × 17,3 s |
| `observation` | 62 × 2,2 s | 29 × 0,8 s |
| `final_answer_node` | 1 × 0,04 s | 1 × 0,03 s |

**Lectura clave:** son dos problemas diferentes con una raíz común.

- **DeepSeek Flash** es un modelo **rápido** (p50 **2.068 ms**) pero el sistema lo llamó **64 veces**,
  y encima gastó **86 s** automatizando un navegador. El cuello es el bucle y las herramientas.
- **GPT-5-mini** es un modelo **lento** (p50 **7.732 ms**, p90 17.291 ms, máx 35.728 ms) y el sistema
  lo llamó **31 veces**. El 89 % del tiempo es el modelo.

Ambos casos habrían cabido en **2–4 iteraciones**.

### Distribución de latencia del LLM

| | n | mín | p50 | p90 | máx | media |
|---|---|---|---|---|---|---|
| DeepSeek Flash | 65 | 1.560 ms | **2.068 ms** | 2.629 ms | 5.783 ms | 2.280 ms |
| GPT-5-mini | 31 | 1.622 ms | **7.732 ms** | 17.291 ms | 35.728 ms | 9.949 ms |

### Coste real medido

De `mate_message` (tokens persistidos por el servidor):

| Modelo | `prompt_tokens` | `completion_tokens` | `reasoning_tokens` | `cache_read_tokens` |
|---|---|---|---|---|
| DeepSeek Flash | **3.007.919** | 11.351 | 0 | 703.872 |
| GPT-5-mini | **1.030.302** | 25.534 | 16.192 | 621.696 |

**~4 millones de tokens de entrada por una pregunta** que en un harness directo consume ~15–20 K.
Es una **amplificación de ~150–200×**.

---

## 4. Las 5 causas raíz

### Causa 1 — El bucle no converge: el agente adivina URLs y nadie lo detiene

De 29 navegaciones con `browser_use open`, **10 devolvieron 404**:

| Veces | URL | Resultado |
|---|---|---|
| **5** | `worldometers.info/world-population/` | ok (re-abierta) |
| 2 | `.../world-population-sex-ratio/` | 404 |
| 2 | `.../demographics/world-demographics/` | 404 |
| 1 c/u | `world-population-by-sex/`, `population-by-gender/`, `sex-ratio/`, `world-population-pyramid/`, `world-population-demographics/`, `world-population-by-country/`, `ourworldindata.org/grapher/population-by-sex` | 404 |

De 28 `eval` ejecutados, **2 devolvieron 2 caracteres** (sin información útil).
El agente no estaba investigando: estaba **probando rutas a ciegas** y reintentando.

### Causa 2 — `ToolLoopGuard` tiene tres puntos ciegos (y no emitió ni un aviso)

`ToolLoopGuard` existe, es correcto en su diseño y **tiene tests propios**. Aun así, durante las dos
corridas completas emitió **cero warnings**:

```bash
grep -cE '循环警告|循环提示|陷入循环' /tmp/auraclaw-container.log   # → 0
```

Los tres agujeros:

| Problema | Evidencia |
|---|---|
| **`browser_use` no está en `IDEMPOTENT_TOOLS`** | `ToolLoopGuard.java:67` lista solo `read_file`, `web_search`, `extract_document_text`, `extract_pdf_text`. Abrir la misma URL 5 veces **no dispara nada**. |
| **Un 404 no se considera fallo** | `ToolLoopGuard.isFailure()` (`:181`) busca `tool execution failed`, `[安全拦截]`, `error:`, `错误：` o JSON con `"error"`. `browser_use` devuelve `Opened: … (title=404 - Page not found)` → pasa como **éxito**. |
| **El no-progreso exige hash idéntico y consecutivo** | El contador se resetea si el resultado cambia en un byte (`resetNoProgress`). Un buscador que devuelve un snippet distinto cada vez **nunca acumula**: por eso los 22 `web_search` de GPT-5-mini tampoco se detectaron. |

### Causa 3 — La compactación le borra al agente su propia evidencia

`ReasoningNode.java:140`:

```java
private static final int KEEP_RECENT_TOOL_RESPONSES = 3;
```

Y se aplica antes de **cada** petición al modelo (`ReasoningNode.java:942-943`). Los logs lo
confirman hasta el extremo:

```
[ConversationWindow] Aged-compacted 60 tool response entries (keepRecent=3) before model request
```

Todo resultado de herramienta anterior a los **3 últimos** se sustituye por el texto de
`ConversationWindowManager.buildAgedPlaceholder()` (`:1128`):

> `[Old tool output cleared — 'browser_use' can be called again if its result is needed.]`

Es decir: el sistema **borra el dato y le sugiere al modelo volver a llamar la herramienta**. Eso
explica directamente las **5 aperturas de la misma página**.

Detalle revelador: en la misma clase ya existe `buildInformativeCleared()` (`:1152`), que **sí**
construye un resumen con tamaño y primeras líneas del resultado original. **No se usa** en este camino.

> En el mismo turno se observa `Injected stale-ledger reminder at iter 57` (`ReasoningNode.java:886`):
> el sistema detecta que el ledger se abandonó y le recuerda al modelo mantenerlo. O sea, el diseño
> *sabe* que la compactación pierde información y trata de compensarla con un ledger — que el modelo
> ignoró durante 57 iteraciones.

### Causa 4 — 117 herramientas en cada llamada: 33.222 tokens de esquemas

```
Built StateGraph ReAct agent: Analista de Razonamiento (maxIterations=100, tools=117, protocol=openai-compatible)
Prefix accounting conv=…: window=1000000 tokens, prefix=10376, toolSchemas=33222, history=45
```

El *progressive disclosure* existe (`ToolDisclosureService`, `mate_tool.disclosure_tier`) pero en la
práctica es **un no-op**:

```sql
SELECT disclosure_tier, count(*) FROM mateclaw.mate_tool GROUP BY 1;
--  core | 38        ← las 38 filas, todas core
```

Y por diseño del propio upstream, las herramientas que no puede clasificar (canales, skills,
plugins) **también caen a `core`**. Resultado: el impuesto de 33 K tokens se paga en **cada una de
las 31–64 iteraciones**, y el espacio de búsqueda del modelo para elegir herramienta es enorme.

### Causa 5 — `max_iterations = 100` no es un tope, es una invitación

```
id         | name                     | agent_type   | max_iterations
1000000001 | Asistente General        | react        | 100
1000000002 | Planificador de Tareas   | plan_execute | 100
1000000003 | Analista de Razonamiento | react        | 100
1000000640 | Content Studio           | react        | 100
```

Tres migraciones fueron **subiendo** el mismo número: `V47` (25 → 100), `V48` (amplía la condición),
`V124` (100 → 150). Y `AgentGraphBuilder.java:421` usa 100 como fallback si la fila viene nula.
No fue el limitante en esta corrida (62 < 100), pero no hay ninguna red de seguridad por debajo.

> Contexto adicional: el prompt del `ReasoningNode` lleva un bloque `TOOL_USE_ENFORCEMENT` que
> **obliga** a llamar herramientas y a registrar ≥3 subobjetivos con `progress_update`. Para una
> petición de "busca y hazme una gráfica" eso la convierte en un proyecto con ledger. Es un
> multiplicador de iteraciones, no una causa por sí sola.

---

## 5. Las herramientas que se ejecutaron

| Herramienta | DeepSeek Flash | GPT-5-mini |
|---|---|---|
| `browser_use` | **58** (29 `open` + 28 `eval`) | 1 |
| `web_search` | 6 | **22** |
| `execute_code` | 0 | 5 |
| `progress_update` | 3 | 3 |
| `render_html_image` | 1 | 0 |
| **Total** | **68** | **31** |

Comparación honesta: **DSH resolvió la misma pregunta con 15 tool calls y 9 iteraciones**
(ver [`03-evaluacion-dsh.md`](./03-evaluacion-dsh.md)).

Las respuestas finales sí fueron buenas —el texto de DeepSeek cita la fuente, da 4,18 MM hombres /
4,14 MM mujeres y advierte discrepancias metodológicas—. **El modelo trabajó bien; el bucle gastó el
presupuesto.**

---

## 6. Qué NO es la causa (descartado con evidencia)

| Hipótesis | Por qué se descarta |
|---|---|
| "El modelo es lento / no está bien entrenado" | DeepSeek Flash: p50 **2,07 s** por llamada. El problema fue llamarlo 64 veces. |
| "Falta hardware" | Contenedor a **12 % CPU** y 2 GB de 15 GB. 8 cores disponibles. |
| "Se pierde la conversación en BD" | `mate_message` guarda solo el turno; no hay fuga ni crecimiento anómalo. |
| "El proveedor estaba caído / había failover" | `retry_count=0 failover_count=0` en todos los `perf_summary`. |
| "Las herramientas son lentas de por sí" | `observe` + `action` de una navegación = ~4 s. 29 navegaciones = 86 s. Es el **volumen**, no la unidad. |

---

## 7. Conclusión

El fallo no es de arquitectura ni de modelo: es **ausencia de control de convergencia y de
presupuesto**. Cinco defectos localizados, todos arreglables:

| Causa | Arreglo | Coste |
|---|---|---|
| 1 · No converge | Detector de no-progreso por `tool+args` (ignorando el resultado) | Bajo |
| 2 · Puntos ciegos | Añadir `browser_use` a `IDEMPOTENT_TOOLS`; tratar 404 como fallo | **Muy bajo** |
| 3 · Compactación | Subir/configurar `KEEP_RECENT_TOOL_RESPONSES`; usar un gist truncado en vez de "cleared" | Bajo |
| 4 · 33 K de esquemas | Bajar herramientas útiles a `extension`; activar el presupuesto de disclosure | Bajo (config) |
| 5 · `max_iterations` | 15–20 para agentes de chat | **Muy bajo** (SQL) |

→ Plan detallado, con archivos y criterios de aceptación: [`05-plan-de-mejoras.md`](./05-plan-de-mejoras.md).
→ La capa que evita que esto vuelva a pasar sin depender de una queja de usuario:
[`02-metricas-y-presupuestos.md`](./02-metricas-y-presupuestos.md).

---

## 8. Hallazgos colaterales de la misma sesión

Durante el análisis, la misma conversación `conv_1790029096976_tsdw26` recibió tres turnos más
(06:46, 06:47 y 07:02 del reloj del contenedor). Salen tres datos que **matizan y amplían** el
diagnóstico.

### 8.1 El coste patológico está en el primer turno de investigación

| Turno | Petición del usuario | Turno completo | tool calls |
|---|---|---|---|
| 1º (06:18) | investigación + gráfica (desde cero) | **241,5 s** | **70** |
| 2º (06:46) | "con esos mismos datos crea una gráfica de barras" | **18,2 s** | 3 |
| 3º (06:47) | pregunta sobre la interfaz | **6,9 s** | 0 |
| 4º (07:02) | "con los mismos datos crea una gráfica de líneas" | **23,8 s** | 3 |

Con los datos ya en la conversación, los turnos cuestan **7–24 s**. Es decir: el problema no es
"el agente es lento siempre", es que **el turno de investigación no tiene techo ni convergencia**.
Esto refuerza el enfoque de presupuesto de [`02`](./02-metricas-y-presupuestos.md): no hace falta
optimizar el caso normal, hace falta **acotar el caso anómalo**.

### 8.2 ⚠️ Regresión de idioma: el agente respondió en chino

El cuarto turno (07:02:09) devolvió la respuesta **íntegramente en chino** en un producto es-ES:

> 我注意到一个重要细节：工具返回的 URL 与我之前回复中写的不一致。正确的链接是本次工具返回的那个，我在此更正：

Para un despliegue cuyo requisito nº 10 es "Español de extremo a extremo"
(ver `docs/pi-integration/01-contexto-y-decision.md` §1), esto es un **fallo de producto**, no un
matiz de estilo. Es consistente con el hecho de que los prompts base y los comentarios del upstream
están en chino: el modelo deriva al idioma del *prompt del sistema* cuando la instrucción de idioma
no tiene suficiente peso en ese punto del contexto.

**No confundir con los marcadores de protocolo**: eso es el parsing bilingüe de `CUSTOMIZATIONS.md`
(que debe conservarse). Esto es texto de cara al usuario en el idioma equivocado.

### 8.3 El agente desconoce sus propias capacidades de plataforma

En el turno 3º el usuario pregunta si la imagen puede mostrarse dentro del chat, y el agente responde
que no puede y ofrece una explicación de la limitación. Sin embargo la plataforma **sí** renderiza
imágenes inline (visores de archivos generados; y el commit `79e7081f` de esta misma línea de trabajo
arregla justamente que las imágenes markdown fueran invisibles).

Hipótesis a verificar: el prompt del agente no declara qué sabe hacer la UI, así que el modelo
**niega capacidades reales**. Es el reverso del problema de las 117 herramientas: el agente recibe un
catálogo enorme de *acciones* y ninguna descripción de los *resultados* que el canal sabe presentar.

→ Acción propuesta: verificar en la sesión de pruebas y, si se confirma, añadir al prompt un bloque
corto de "qué sabe mostrar este canal" (imagen inline, tablas, archivos descargables). Ver
[`05`](./05-plan-de-mejoras.md) §M6.
