# 04 · Comparativa de runtimes y el puente de tools

> Las tres opciones de motor (nativo, DSH, Pi), qué cuesta cada una, y el hallazgo que las unifica:
> **ninguna de las tres da acceso a la wiki, la memoria, la BD ni Telegram.** Eso lo resuelve una
> pieza que hoy no existe en ningún camino.

---

## 1. Las tres opciones

| | **Nativo (StateGraph)** | **DSH** | **Pi** |
|---|---|---|---|
| Qué es | El grafo ReAct del upstream | DeepSeek Harness por JSON-RPC | Harness `@earendil-works/pi-coding-agent` |
| Código Java a escribir | — (ya está) | **0** (provider listo) | ~6 clases (F3 de `docs/pi-integration/05`) |
| Motor a construir | — | `pnpm install && pnpm run build` (~5,5 min) | ya instalado / npm |
| Artefacto a empaquetar | — | **no necesario** con la vía corta de [`03`](./03-evaluacion-dsh.md) §4 | no |
| Madurez | la nuestra | **v0.1.x**, cambios rompientes anunciados | en uso diario |
| Modelos | los del router de AuraClaw (libre) | pi-ai (multi-proveedor), pero **el puente inyecta DeepSeek** | libre |
| Memoria entre turnos | sí (BD + ledger) | **no hoy** (ver `03` §7) | sí (sesión propia) |
| Gobernanza | Tool Guard + approval | `permission/preset`, `sandbox/mode`, `approval/policy` de fábrica | propia + Tool Guard si se enruta |
| Herramientas propias | 117 (nativas) | `shell`, `fs`, `sandbox`, `browser-use`, `mcp`, `skill`, `subagent`, `workflow`… | `bash`, `read`, `write`, `edit`, `grep`, `find`, `ls`, skills, MCP |
| Riesgo de deriva | merge del upstream | **alto** (pre-1.0 rápido) | lo fijamos nosotros |

### 1.1 Rendimiento medido (misma pregunta, mismo modelo)

| Métrica | Nativo | **DSH** | Pi |
|---|---|---|---|
| Turno | 241 s | **37–58 s** | ~9 s |
| Iteraciones | 62 | **9** | 2–3 |
| Tool calls | 70 | **15** | ~2 |

Los tres números salen de corridas reales. El nativo es el outlier por el fallo documentado en
[`01`](./01-diagnostico-bucle-agente.md), no por su arquitectura.

---

## 2. El hallazgo que unifica todo: el puente de tools

Esta es la conclusión más importante de la sesión.

### 2.1 Ni DSH ni Pi ven los datos de AuraClaw

En el test end-to-end, DSH resolvió la pregunta usando **sus propias** herramientas (`web_search`,
`web_fetch`, `web/deepseek-search-llm-request`). Nunca tocó las 117 de AuraClaw.

Evidencia de que el puente **no está activo**:

```
DshToolDispatcher        ┐
DshToolCatalog           ├─ referenciados SOLO por sí mismos
DshToolPolicyEvaluator   │  y por sus 3 archivos de test
DshToolPolicy            │  → cero llamadores en src/main
DshToolDecision          │  → código muerto: andamiaje
DshToolDispatchResult    │
DshToolDescriptor        ┘
```

```bash
grep -rn 'DshToolDispatcher\|DshToolCatalog\|DshToolPolicyEvaluator' \
  --include='*.java' mateclaw-server/src/main
# → solo definiciones propias. Ningún uso real.
```

Y del otro lado, **AuraClaw no tiene servidor MCP**:

```bash
ls mateclaw-server/src/main/java/vip/mate/mcp/     # → no existe
# solo hay skill/mcp y tool/mcp, ambos de CONSUMO (cliente MCP)
```

El doc del upstream lo dice sin ambigüedad:

> *"The recommended composition is: **DSH as the employee runtime, MCP as the tool layer**, and
> MateClaw as the governance and visualization layer."*

**"MCP as the tool layer" es un requisito, no una sugerencia** — porque es la única vía que el
upstream contempla para que el runtime externo use las capacidades de AuraClaw.

### 2.2 Consecuencia

El objetivo declarado —*"quiero usar la capa de AuraClaw para gestión, memoria, wikis, conexión a BD,
Telegram, pero como agente quiero algo rápido"*— **no lo entrega el cambio de motor**. Lo entrega el
puente. Cambiar de motor sin puente te da un agente rápido que **no sabe nada de tu empresa**.

Por eso en [`05`](./05-plan-de-mejoras.md) el puente (M4) está **al mismo nivel de prioridad** que el
cambio de motor (M3), no después.

---

## 3. Las dos clases de herramientas

Cualquier motor externo (DSH o Pi) tendrá dos clases, y hay que decidir dónde vive cada una:

| Clase | Quién ejecuta | Gobierno | Velocidad |
|---|---|---|---|
| **Locales del motor** | dentro del proceso del motor | sandbox + allow-list, **no** herramienta por herramienta | el origen de la velocidad |
| **De AuraClaw** (`wiki_*`, memoria, `telegram`, BD, `render_docx`…) | AuraClaw, vía el puente | ALLOW / DENY / APPROVAL + audit + RBAC | gobernado |

- Si apagas las locales (`pi --no-builtin-tools`, o un perfil DSH mínimo), ganas gobierno total y
  **pierdes la velocidad** con la que viniste.
- Si las dejas, aceptas que dentro del sandbox el motor actúa sin aprobación por acción.

**Decisión de producto pendiente** (no técnica): qué clase de acciones exigen aprobación humana. Ver
[`05`](./05-plan-de-mejoras.md) §M5.

---

## 4. Opciones para construir el puente

| Opción | Qué implica | Ventajas | Costes |
|---|---|---|---|
| **A · Servidor MCP en AuraClaw** | Exponer una selección de tools del `ToolRegistry` por MCP | Es **lo que el upstream recomienda**; sirve para DSH **y** Pi sin cambios; el más portable | Pieza nueva (AuraClaw es hoy solo cliente MCP); hay que decidir la superficie expuesta y su auth |
| **B · Extensión de Pi (TS)** | Una extensión que llama a la API REST de AuraClaw | Rápido de prototipar; sin tocar Java | Solo sirve para Pi; duplica la lógica de auth/permisos |
| **C · Activar `DshToolDispatcher`** | Cablear los `DshTool*` ya existentes | Ya escrito y testeado; encaja en el diseño del upstream | **Solo DSH**; hay que inyectar el catálogo y el resultado por el protocolo |

**Recomendación: opción A.** Es la única que sirve para los dos motores y la que el upstream
documenta como composición recomendada. Las opciones B y C son atajos de un solo motor.

### 4.1 Superficie mínima recomendada para el MCP

Empezar **pequeño y gobernado**. Candidatas por orden de valor:

| Prioridad | Tool | Por qué |
|---|---|---|
| 1 | `memory_search` / `memory_write` | Es la columna vertebral de "empleado con memoria" |
| 2 | `wiki_search` / `wiki_read` | El conocimiento de la empresa |
| 3 | `send_file` / artefactos | Entregar resultados por los canales existentes |
| 4 | `telegram_send` (o el canal del usuario) | Comunicación remota |
| 5 | `query_datasource` (solo lectura) | Datos de negocio |
| N | Todo lo demás | Solo cuando se demuestre necesario |

Deliberadamente **fuera** del puerto inicial: `shell`, `execute_code`, escritura en BD y cualquier
acción mutadora sin aprobación.

---

## 5. Cómo se combina con el plan de Pi

`docs/pi-integration` mantiene su vigencia, pero el orden que propone hay que **corregirlo**:

| Doc de `pi-integration` dice | Corrección |
|---|---|
| `05` §7: *"Pi como runtime para trabajo pesado; el nativo para conversación y conocimiento"* | La premisa ("el nativo basta para lo ordinario") queda **refutada** por [`01`](./01-diagnostico-bucle-agente.md): el nativo falló en una pregunta simple. |
| `08`: *"F3 no arranca hasta que F1/F2 demuestren valor"* | La regla se escribió con esa premisa. Con la evidencia actual, **F3 deja de ser "por completitud"** y pasa a ser la solución a un fallo medido. |
| `05` §1: *"El contrato no existe en nuestra base v2.1.0 … bloqueado por el merge de v2.2.0"* | **Desactualizado.** El contrato, el paquete `dsh/` y la migración `V186` **están en `main`**. F3 no está bloqueado. |
| `README` §"Decisión en una línea": Pi como *motor de trabajo pesado* | El usuario quiere un motor para la **operativa diaria de oficina**, no solo trabajo pesado. Decisión de producto a explicitar. |

Y el camino DSH **no sustituye** al de Pi: DSH cubre el **agente conversacional rápido**; Pi sigue
siendo el candidato para **trabajo pesado con bash arbitrario** (matplotlib, ffmpeg, Office). Pueden
coexistir: es exactamente lo que permite `mate_agent.runtime_type` por agente.

---

## 6. Recomendación

1. **Corto plazo:** no cambiar el motor todavía. Cerrar los 5 defectos de [`01`](./01-diagnostico-bucle-agente.md)
   y poner la medición de [`02`](./02-metricas-y-presupuestos.md). Eso recupera el nativo a un coste
   razonable y **te da la línea base numérica**.
2. **Paralelo:** arreglar el historial del puente DSH y montar un **agente piloto** con
   `runtime_type='dsh'` (M3). Riesgo cero para el resto: el flag ya existe por agente.
3. **En cuanto el piloto demuestre valor:** construir el **puente MCP** (opción A). Es la pieza que
   convierte "un motor rápido" en "un empleado con acceso a la empresa".
4. **Pi:** mantenerlo para trabajo pesado. No competir con DSH en conversación.

---

→ Siguiente: [`05-plan-de-mejoras.md`](./05-plan-de-mejoras.md).
