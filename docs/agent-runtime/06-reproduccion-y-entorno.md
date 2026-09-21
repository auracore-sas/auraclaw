# 06 · Reproducción y entorno

> Comandos exactos, rutas, versiones y trampas. Para que la sesión de pruebas sea reproducible y las
> mediciones comparables.

---

## 1. Entorno observado (2026-09-21)

### Host

| Dato | Valor |
|---|---|
| SO | Ubuntu 24.04.4 LTS |
| Núcleos | 8 |
| Node (nvm) | v26.2.0 · pnpm 11.24.0 (spike usó 11.7.0 vía corepack) |
| Disco libre en `/` | ~50 GB (89 % usado — vigilar durante builds de DSH) |
| Zona horaria del host | **UTC−5** |
| JDK (para el server) | 21 — obligatorio (Lombok no soporta 25) |

### Contenedores

| Nombre | Imagen | Puertos |
|---|---|---|
| `mateclaw-server` | `mateclaw-mateclaw-server` | `18080 → 18088`, `1455` |
| `mateclaw-postgres` | `postgres:16` | `127.0.0.1:5435 → 5432` |
| `mateclaw-searxng` | `mateclaw-searxng` | `127.0.0.1:8088 → 8080` |

Recursos durante la prueba: el contenedor del server a **12 % CPU** y ~2 GB de 15 GB → **no había
falta de recursos**; no es una causa del problema.

### ⚠️ Trampa de zona horaria

El contenedor corre con `-Duser.timezone=Asia/Shanghai`:

| | Zona | Hora del caso |
|---|---|---|
| Logs del contenedor / BD | Asia/Shanghai (UTC+8) | `06:18:23` (2026-09-22) |
| Host | UTC−5 | `17:18:23` (2026-09-21) |

**Desfase: +13 h (y cambio de día).** Al correlacionar logs con la UI o con `date`, tenerlo presente.
Las conversaciones de prueba ocurrieron el **2026-09-21 por la tarde** hora local.

---

## 2. Medir un turno nativo (desde logs)

```bash
docker logs mateclaw-server > /tmp/auraclaw-container.log 2>&1
sed -i -e 's/\x1b\[[0-9;]*m//g' /tmp/auraclaw-container.log

# 1) Tiempo total por nodo, atribuido por traceId
grep 'ReAct\]' /tmp/auraclaw-container.log \
  | sed -nE 's/^([0-9:,]+).*\[ReAct\] node=([a-z_]+) event=complete iteration=([0-9]+) durationMs=([0-9]+).*traceId=([0-9a-f]+).*$/\1|\2|\3|\4|\5/p' \
  > /tmp/react.tsv
awk -F'|' '{k=$5"|"$2; s[k]+=$4; n[k]++} END{for(i in s){split(i,a,"|");
  printf "trace=%-10s nodo=%-14s n=%-4d total=%.1fs\n",a[1],a[2],n[i],s[i]/1000}}' /tmp/react.tsv | sort

# 2) Llamadas al LLM y su latencia
grep -c 'perf_summary' /tmp/auraclaw-container.log
grep 'perf_summary' /tmp/auraclaw-container.log | sed -E 's/.*total_ms=([0-9]+).*/\1/' \
  | sort -n | awk '{a[NR]=$1; s+=$1} END{printf "n=%d min=%d p50=%d p90=%d max=%d media=%.0f\n",
      NR,a[1],a[int(NR*0.5)],a[int(NR*0.9)],a[NR],s/NR}'

# 3) Herramientas ejecutadas
grep 'Executing tool' /tmp/auraclaw-container.log \
  | sed -E 's/.*Executing tool: ([a-z_]+).*/\1/' | sort | uniq -c | sort -rn

# 4) ¿Avisó el guard de algún bucle?  (0 = no lo vio)
grep -cE '循环警告|循环提示|陷入循环' /tmp/auraclaw-container.log

# 5) Presupuesto de prompts por conversación
grep 'Prefix accounting' /tmp/auraclaw-container.log

# 6) Compactación agresiva
grep 'Aged-compacted' /tmp/auraclaw-container.log | sort | uniq -c | sort -rn | head
```

### Identificadores del caso

| `traceId` | `conversation_id` | Modelo |
|---|---|---|
| `490052fa` | `conv_1790028986606_53abf0` | `gpt-5-mini` |
| `0520dfa1` | `conv_1790029096976_tsdw26` | `deepseek-v4-flash` |

---

## 3. Medir un turno **desde la BD** (preferido tras M1)

No requiere `docker logs`. Ver la explicación y las consultas completas en
[`02` §2.4](./02-metricas-y-presupuestos.md#24-la-prueba-el-diagnóstico-se-reconstruye-desde-la-bd-sola).

```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c "
WITH seg AS (
  SELECT m.conversation_id AS conv, (s->>'timestamp')::bigint AS ts,
         s->>'type' AS type, s->>'toolName' AS tool,
         s->>'toolArgs' AS args, s->>'toolResult' AS res
  FROM mateclaw.mate_message m,
       jsonb_array_elements(m.metadata::jsonb->'segments') s
  WHERE m.role='assistant' AND s->>'type'='tool_call'
)
SELECT conv, count(*) AS tool_calls,
       count(*) FILTER (WHERE res LIKE '%404%') AS con_404,
       (max(ts)-min(ts))/1000.0 AS reconstruido_s
FROM seg GROUP BY 1;"
```

Tokens y coste por mensaje:

```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c "
select conversation_id, runtime_model, prompt_tokens, completion_tokens,
       reasoning_tokens, cache_read_tokens, status
from mateclaw.mate_message where role='assistant' order by create_time desc limit 10;"
```

> **Cuidado:** el agregado `mate_usage_daily` es por `(workspace_id, agent_id, stat_date)` — **no** por
> conversación. Para el caso individual hay que leer `mate_message`.

---

## 4. Reproducir el spike de DSH

```bash
# 1) Construir (una vez) — ~5,5 min, 1,4 GB de node_modules
cd /tmp
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git dsh-spike
cd dsh-spike
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm run build

# 2) El patch de composición (monta el adaptador de LLM)
cat > /tmp/dsh-llm.patch.yml <<'EOF'
- insert:
    - id: llm-deepseek
      name: '@deepseek-ai/dsh-llm-deepseek'
EOF

# 3) Comprobar el servidor JSON-RPC (perfil sdk)
node apps/cli/lib/bin.js --profile sdk --help
#   → "Serve DeepSeek Harness SDK clients over stdio JSON-RPC."

# 4) Handshake
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"cwd":"/tmp/dsh-spike","provider":"deepseek-official","model":"deepseek-v4-flash","maxTokens":4096}}'; sleep 12; } \
  | DEEPSEEK_API_KEY="$(pi auth print-api-key --provider deepseek)" \
    node apps/cli/lib/bin.js --profile sdk --patch /tmp/dsh-llm.patch.yml
#   → {"result":{"serverInfo":{"name":"deepseek-harness-sdk-runtime","version":"0.0.1"}}}
```

### Apuntar AuraClaw a esta build

```bash
DSH_JSONRPC_AGENT="/usr/bin/node /tmp/dsh-spike/apps/cli/lib/bin.js --profile sdk --patch /tmp/dsh-llm.patch.yml"
DSH_CWD=/ruta/al/workspace
DEEPSEEK_API_KEY=…                          # lo inyecta el proveedor; no hace falta exportarlo
```

`DSH_CORDIS_CONFIG` puede quedarse vacío: **el DSH real no lo lee** (ver
[`03`](./03-evaluacion-dsh.md) §3.2).

### Verificar que el build es del commit correcto

```bash
cd /tmp/dsh-spike && git rev-parse --short HEAD && git log -1 --format='%ci %s'
```

### Rutas y artefactos de esta sesión

| Ruta | Qué es |
|---|---|
| `/tmp/dsh-spike/` | Checkout + build de DSH (1,4 GB node_modules) |
| `/tmp/dsh-llm.patch.yml` | Patch que monta `@deepseek-ai/dsh-llm-deepseek` |
| `/tmp/dsh-e2e2.py` | Driver del test end-to-end con métricas |
| `/tmp/auraclaw-container.log` | Log limpio del contenedor al momento del diagnóstico |
| `/tmp/react.tsv` | Duraciones por nodo y traceId |

⚠️ Todo eso está en `/tmp`: **se pierde al reiniciar**. Si va a repetirse, mover el patch y el driver
a un sitio versionado.

---

## 5. Protocolo de medición A/B (obligatorio en cada mejora)

1. **Congelar la línea base.** Guardar los números actuales de
   `conv_1790029096976_tsdw26` y `conv_1790028986606_53abf0` como referencia inmutable.
2. **Usar la misma pregunta** y, si se puede, **el mismo modelo**. Cambiar dos variables a la vez
   invalida la comparación.
3. **Crear una conversación nueva** por medición (el historial contamina el turno).
4. **Registrar antes/después** de: iteraciones, tokens de entrada, segundos, tool calls, repeticiones.
5. **Anotar lo inesperado.** Los hallazgos colaterales de [`01`](./01-diagnostico-bucle-agente.md) §8
   (la regresión al chino, la negación de capacidades) salieron de mirar datos que no buscábamos.

---

## 6. Trampas conocidas

| Trampa | Detalle |
|---|---|
| **Zona horaria** | Contenedor en Asia/Shanghai, host en UTC−5 → +13 h. Ver §1. |
| **`docker logs` sin `--tail`** | El log es pequeño hoy, pero crece. Acotar por tiempo al comparar turnos. |
| **Conteo de tool calls** | `Executing tool:` en el log y `metadata.toolCalls` en BD pueden diferir en 1–2 (llamadas agrupadas). Usar **la BD** como fuente canónica tras M1. |
| **`endTimestamp` de segmentos `tool_call`** | Viene **igual** que `timestamp` → la duración de la herramienta se deriva del **siguiente** segmento, no de la resta directa. |
| **Compilación de UI dentro del JAR** | La SPA se sirve desde el JAR: tras cambios de UI hay que **reconstruir la imagen Docker**. |
| **Dos procesos contra la misma BD H2** | Solo aplica al perfil `dev` (H2 compartido en `mateclaw-server/data/`). El stack Docker usa PostgreSQL y no se ve afectado. Ver `AGENTS.md` §4ter. |
| **`pkill -f "patrón"`** | Se mata a sí mismo si el patrón coincide con su propia línea de comandos (`AGENTS.md` §4ter). |
| **Versiones de DSH** | v0.1.x con cambios rompientes: **re-verificar los 3 desajustes** de [`03`](./03-evaluacion-dsh.md) §3 antes de cada actualización. |

---

## 7. Referencias cruzadas

| Tema | Documento |
|---|---|
| El fallo medido | [`01-diagnostico-bucle-agente.md`](./01-diagnostico-bucle-agente.md) |
| Métricas y presupuestos | [`02-metricas-y-presupuestos.md`](./02-metricas-y-presupuestos.md) |
| Spike de DSH | [`03-evaluacion-dsh.md`](./03-evaluacion-dsh.md) |
| Comparativa y puente | [`04-comparativa-runtimes.md`](./04-comparativa-runtimes.md) |
| Plan por fases | [`05-plan-de-mejoras.md`](./05-plan-de-mejoras.md) |
| Decisión original de Pi | [`docs/pi-integration/01-contexto-y-decision.md`](../pi-integration/01-contexto-y-decision.md) |
| Superficie del upstream (qué no tocar) | [`docs/CODE_MAP.md`](../CODE_MAP.md) |
| Reglas de fork y merge | [`AGENTS.md`](../../AGENTS.md) · [`docs/CUSTOMIZATIONS.md`](../CUSTOMIZATIONS.md) |
