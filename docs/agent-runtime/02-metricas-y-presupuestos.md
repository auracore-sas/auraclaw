# 02 · Métricas y presupuestos por turno

> La capa que faltaba. El arreglo de fondo: que un turno anómalo se detecte **por medición**, no
> porque un usuario se queje.
>
> Hallazgo principal: **la materia prima ya está persistida en la BD.** No hay que instrumentar nada
> nuevo; hay que agregar y poner presupuesto.

---

## 1. El vacío

El repositorio tiene **732 archivos de test** (~5.000 tests) y **ninguno mide un presupuesto**. Los
tests verifican unidades y contratos; ninguno dice:

> *"Una pregunta simple debe cerrar en ≤5 iteraciones, ≤60 K tokens de entrada y ≤20 s."*

Por eso el fallo de [`01`](./01-diagnostico-bucle-agente.md) pasó 5.000 tests y lo encontró el uso
real. Y por eso, al diagnosticarlo, **todo se extrajo a mano de `docker logs`**: no existe ninguna
superficie —ni UI, ni endpoint, ni reporte— donde esos números vivan.

> Esto conecta con la lección ya registrada en `AGENTS.md` §5.2: *"el merge no marca los archivos
> nuevos que asumen firmas viejas"* y *"el bug #334 pasó ~5.000 tests y lo encontró el uso real"*.
> Es el mismo patrón: **CI verde no es lo mismo que producto medido.**

---

## 2. Hallazgo: la materia prima ya está en la BD (demostrado)

Tres fuentes **ya existentes** contienen casi todo lo necesario.

### 2.1 `mate_message.metadata.segments[]` — la traza completa del turno

Cada mensaje del asistente guarda un array de segmentos. Estructura real (recortada):

```json
{
  "id": "to-1", "seq": 1, "type": "tool_call", "status": "completed",
  "toolName": "web_search",
  "toolArgs": "{\"query\":\"world population by sex 2026 …\"}",
  "toolResult": "\"Search results (via searxng) …\"",
  "toolSuccess": true,
  "timestamp": "1790029037421", "endTimestamp": "1790029037421"
}
```

Y hay segmentos de narración (`kind: "pre_tool_narration"`, con `superseded*` para saber qué texto se
reemplazó). Claves presentes en el metadata: `segments`, `toolCalls`, `currentPhase`, `finishReason`.

### 2.2 `mate_message` — tokens por mensaje

`prompt_tokens`, `completion_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`,
`token_usage`, `status`, `runtime_model`, `runtime_provider`. **Ya están todos.**

### 2.3 `mate_usage_daily` — agregación diaria que ya existe

```sql
-- mate_usage_daily, única por (workspace_id, agent_id, stat_date)
conversation_count | message_count  | total_tokens | prompt_tokens | completion_tokens
tool_call_count    | error_count    | cache_read_tokens | cache_write_tokens
```

Es decir: **ya existe un agregado con `tool_call_count`**. Lo que le falta es latencia, iteraciones y
señal de bucle.

### 2.4 La prueba: el diagnóstico se reconstruye **desde la BD sola**

Contando y midiendo los segmentos, sin tocar `docker logs`:

```sql
WITH seg AS (
  SELECT m.conversation_id AS conv,
         (s->>'timestamp')::bigint AS ts,
         s->>'type' AS type, s->>'toolName' AS tool,
         s->>'toolArgs' AS args, s->>'toolResult' AS res
  FROM mateclaw.mate_message m,
       jsonb_array_elements(m.metadata::jsonb->'segments') s
  WHERE m.role = 'assistant' AND s->>'type' = 'tool_call'
)
SELECT conv,
       count(*)                                        AS tool_calls,
       count(*) FILTER (WHERE res LIKE '%404%')        AS con_404,
       (max(ts) - min(ts)) / 1000.0                    AS reconstruido_s
FROM seg GROUP BY 1;
```

| `conversation_id` | Segmentos | Tool calls | Con "404" | **Reconstruido** | Real (logs) | Desvío |
|---|---|---|---|---|---|---|
| `conv_1790028986606_53abf0` (GPT-5-mini) | 36 | 29 | 0 | **318,2 s** | 329,5 s | −3,4 % |
| `conv_1790029096976_tsdw26` (DeepSeek) | 110 | **70** | **14** | **239,0 s** | 241,5 s | −1,0 % |

Y los duplicados, que son el núcleo del detector de bucles:

```sql
SELECT tool, count(*) AS veces, count(DISTINCT args) AS args_distintos
FROM seg WHERE conv = 'conv_1790029096976_tsdw26' GROUP BY 1 ORDER BY veces DESC;
```

| Herramienta | Veces | Args distintos | **Repeticiones exactas** |
|---|---|---|---|
| `browser_use` | 59 | 52 | **7** ← el bucle, visible en la BD |
| `web_search` | 7 | 7 | 0 |
| `progress_update` | 3 | 3 | 0 |
| `render_html_image` | 1 | 1 | 0 |

**Conclusión:** el desvío es de 1–3 % (el tiempo previo al primer segmento) y la señal de bucle
aparece con una consulta de 5 líneas. **No hay que instrumentar: hay que agregar, mostrar y poner
umbral.**

---

## 3. Lo que falta (lista corta y concreta)

| # | Falta | Tamaño |
|---|---|---|
| 1 | **Duración del turno** en `mate_usage_daily` (derivable de segmentos; conviene materializarla) | Columna + cálculo |
| 2 | **Iteraciones / pasos** del turno (hoy derivable: nº de `tool_call` + narraciones) | Campo |
| 3 | **Señal de bucle**: `tool+args` repetidos por encima de un umbral | Cálculo |
| 4 | **Granularidad por conversación** (hoy el agregado es `workspace+agente+día` → no se ve *este* chat) | Vista o endpoint |
| 5 | **El presupuesto y el aviso**: nada compara contra un umbral ni lo reporta | Regla |

Nada de eso requiere un motor de observabilidad, ni Prometheus, ni trazas distribuidas. Son **una
vista, un cálculo y una regla**.

---

## 4. Métricas propuestas por turno

| Métrica | Fuente | Para qué |
|---|---|---|
| `iterations` | nº de ciclos reasoning→action | **El indicador #1 de deriva** |
| `llm_calls` | `perf_summary` / segmentos de narración | Coste de ida y vuelta |
| `tool_calls` | segmentos `tool_call` | Volumen |
| `distinct_tools` | `count(DISTINCT toolName)` | Señal de "probando a ciegas" |
| `repeated_calls` | `tool+args` duplicados | **Señal de bucle** |
| `tool_error_rate` | `toolSuccess=false` **+ 404/5xx en `toolResult`** | Calidad de la navegación |
| `wall_seconds` | `max(ts) − min(ts)` de segmentos | Latencia percibida |
| `prompt_tokens` | `mate_message` | **Amplificación** (ya existe) |
| `cache_hit_ratio` | `cache_read / prompt_tokens` | Coste real |
| `finish_reason` | metadata | Si terminó por presupuesto o por respuesta |

---

## 5. Presupuestos propuestos

Umbral por **tipo de tarea**, no globlal. Si se excede → el turno se marca y se registra el motivo.

| Tipo | Iteraciones | Tokens de entrada | Segundos | Repeticiones |
|---|---|---|---|---|
| Pregunta simple / factual | ≤ 4 | ≤ 80 K | ≤ 20 s | 0 |
| Investigación web (1 fuente) | ≤ 8 | ≤ 250 K | ≤ 60 s | ≤ 1 |
| Investigación + artefacto (gráfica, documento) | ≤ 15 | ≤ 500 K | ≤ 120 s | ≤ 2 |
| Trabajo pesado (informe, multi-paso) | ≤ 40 | ≤ 2 M | ≤ 600 s | ≤ 3 |

Referencia de calibración: la misma pregunta del caso real resolvió en **9 iteraciones / 15 tool
calls / 37–58 s** con DSH, y en **2–4 iteraciones / 9 s** en un harness directo
(ver [`03`](./03-evaluacion-dsh.md)). Los presupuestos de arriba están por encima de esos valores
para dejar margen, y muy por debajo de los **62 iteraciones / 3 M tokens** observados.

> **El valor de negocio**: hoy el techo de gasto de un turno no existe. Con esto, un turno
> desbocado se corta y se registra — en vez de facturarse en silencio.

---

## 6. Cómo implementarlo (sin infraestructura nueva)

| Pieza | Dónde | Nota |
|---|---|---|
| Campos de duración + iteraciones en el agregado | `mate_usage_daily` (migración **V900+**, nuestra) | Nunca `V<900` — colisionan con upstream |
| Endpoint de solo lectura por conversación | `com.auracore.*` (controlador propio) | Zona aislada, sin conflicto de merge |
| Vista de "salud del turno" en la consola | `mateclaw-ui` (panel propio) | Reutilizar el patrón del `ConversationFilesPanel` |
| **Aviso al superar presupuesto** | Log + `metadata.budgetExceeded` en el mensaje | Barato y sin bloqueo |
| Arnés de evaluación | `mateclaw-server/src/test` (nuestro) | 10 tareas de oficina, con aserción de presupuesto |

**Regla de diseño:** primero **medir**, después **avisar**, y solo al final **actuar** (cortar el
turno). Empezar cortando sin datos produce cortes en falsos positivos.

---

## 7. El arnés de evaluación (lo que convierte "prueba y error" en medición)

Un set pequeño de tareas reales, ejecutado en CI o a demanda, que **falla en rojo** si se excede el
presupuesto. Candidatas (al menos una por clase):

| # | Tarea | Presupuesto |
|---|---|---|
| 1 | "¿Cuántas personas hay en el mundo? ¿Hombres y mujeres? Muéstralo en una gráfica de pastel" | investigado + artefacto |
| 2 | "Resume este PDF adjunto y dame 5 puntos clave" | investigación 1 fuente |
| 3 | "¿Qué dice la wiki sobre `<tema>`?" | pregunta simple |
| 4 | "Con los mismos datos, hazme la gráfica de barras" | artefacto (follow-up) |
| 5 | "Busca en la web las 3 noticias más recientes de `<tema>`" | investigación web |
| 6 | "Envía por Telegram el resumen anterior" | acción de canal |
| 7 | "Genera un XLSX con estas 20 filas y renómbralo" | herramienta puntual |
| 8 | "¿Cuál es la capital de Australia?" (control) | pregunta simple — **debe ser 1 iteración** |

La tarea 8 es deliberadamente trivial: si el agente usa herramientas para responderla, el sistema está
mal calibrado. Es el **canario**.

---

## 8. Criterios de aceptación

- [ ] Toda conversación expone `iterations`, `tool_calls`, `wall_seconds`, `prompt_tokens` y
      `repeated_calls` sin tocar `docker logs`.
- [ ] Un turno que supera su presupuesto queda **marcado** en el mensaje y **registrado** en el log.
- [ ] El arnés de evaluación corre las 8 tareas y **falla** si alguna excede su presupuesto.
- [ ] Antes/después documentado para cada mejora de [`05`](./05-plan-de-mejoras.md): iteraciones,
      tokens de entrada y segundos.
- [ ] El cálculo sobrevive a datos históricos (mensajes sin `metadata.segments` no rompen el reporte).

---

## 9. Qué NO hacer

- ❌ **No introducir un stack de observabilidad** (Prometheus/Grafana/OTel) para esto: la traza ya
  está en una tabla relacional y se consulta con `jsonb_array_elements`.
- ❌ **No añadir una columna por métrica** en `mate_message` si se puede derivar de `segments`.
- ❌ **No cortar turnos antes de medir**: primero el dato, después el umbral.
- ❌ **No tocar el grafo** (`AgentGraphBuilder`/`*Node`) para esto. El registro de la traza ya ocurre.
- ❌ **No reutilizar los números en la UI sin la misma definición**: la consola y el backend deben
  calcular `iterations` y `wall_seconds` con la **misma** fórmula, o divergirán.

---

→ Siguiente: [`03-evaluacion-dsh.md`](./03-evaluacion-dsh.md) — el motor alternativo, medido.
