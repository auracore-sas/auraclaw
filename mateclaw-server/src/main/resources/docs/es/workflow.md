# Workflow

::: tip Nuevo en 1.3.0
La orquestación de workflows está disponible desde v1.3.0. Los releases anteriores (v1.2.0 y menores) no traen esta capacidad.
:::

**Qué es workflow**: una forma de componer múltiples empleados digitales más acciones de sistema (aprobación / despacho a canal / escritura de memoria) en un proceso de negocio de pasos lineales. Cada paso puede estar condicionado por la salida del paso anterior, abrirse en abanico en paralelo, esperar aprobación humana, o persistir resultados en el `MEMORY.md` de un empleado.

**Qué no es workflow**:
- No un reemplazo de ReAct / Plan-and-Execute — el razonamiento multi-turno de un solo agente sigue viviendo en esos motores
- No un constructor low-code de arrastrar-y-soltar con if/else — v0 es **JSON-primero** (el canvas llega en v1)
- No un orquestador de 30 nodos estilo Dify — los workflows de AuraClaw se mantienen deliberadamente mínimos: **un arreglo lineal de pasos con un campo `mode` expresando el flujo de control**

::: warning Alcance de v1.3.0
v0 = alpha interno. **7 modos de paso + 6 tipos de patrón de trigger**. `loop` e `invoke_skill` están diferidos. Córrelo en una cuenta insignia / workspace interno antes de desplegarlo ampliamente.
:::

---

## Panorama en un minuto

```json
{
  "schemaVersion": "1.0",
  "inputs": [
    { "name": "customer", "type": "json" }
  ],
  "steps": [
    {
      "name": "enrich",
      "agentName": "data-analyst",
      "promptTemplate": "Enrich and return strict JSON: {{ inputs.customer | toJson }}",
      "mode": { "type": "sequential" },
      "outputVar": "enriched",
      "outputContentType": "json"
    },
    {
      "name": "vip-route",
      "agentName": "enterprise-sales",
      "promptTemplate": "VIP onboarding for {{ outputs.enriched.name }}",
      "mode": {
        "type": "conditional",
        "expression": "{{ outputs.enriched.tier == 'enterprise' }}"
      }
    },
    {
      "name": "notify-feishu",
      "agentName": "ops-bot",
      "promptTemplate": "Notify feishu: {{ outputs.enriched }}",
      "mode": { "type": "fan_out" }
    },
    {
      "name": "notify-email",
      "agentName": "ops-bot",
      "promptTemplate": "Notify email: {{ outputs.enriched }}",
      "mode": { "type": "fan_out" }
    },
    {
      "name": "wait-acks",
      "mode": { "type": "collect" }
    },
    {
      "name": "record",
      "promptTemplate": "Onboarded {{ inputs.customer.name }}",
      "mode": {
        "type": "write_memory",
        "employeeId": "{{ outputs.enriched.assignedEmployeeId }}",
        "file": "MEMORY.md",
        "mergeStrategy": "append"
      }
    }
  ]
}
```

Cómo se lee:
1. `enrich` le pide al analista de datos estructurar la info del cliente como JSON
2. Si `tier == enterprise`, enruta al empleado de ventas empresariales para onboarding VIP
3. En paralelo (fan_out), notifica a Feishu y notifica por correo
4. `collect` espera ambas notificaciones
5. Anexa el resultado al `MEMORY.md` del empleado

---

## Conceptos centrales

### Siete modos de paso (v1.3.0)

| Modo | Comportamiento | Campos requeridos | Semántica clave |
|---|---|---|---|
| `sequential` | Corre tras el paso anterior; la salida anterior → `{{input}}` | — | Modo por defecto |
| `fan_out` | Corre en paralelo con pasos `fan_out` consecutivos; todos reciben el mismo `{{input}}` | — | Límite detectado en compilación: desde este paso en adelante, el primer paso no-`fan_out` / no-`collect` termina el grupo |
| `collect` | Une las salidas del grupo `fan_out` más reciente con `\n\n---\n\n` en `{{input}}` | — | Deben precederlo al menos 2 pasos `fan_out` consecutivos; chequeo en compilación |
| `conditional` | Corre solo si la expresión Pebble es verdadera | `expression` | Cuando es falsa, se salta; `{{input}}` se preserva (arrastra el del paso anterior) |
| `await_approval` | Pausa la corrida; envía una aprobación | `approvalKind`, `approverChannels[]` | Reanuda al siguiente paso al aprobar; el timeout sigue la política del workspace |
| `dispatch_channel` | Entrega multi-canal de `{{input}}` | `channels[]` | El fallo por canal sigue `errorMode` |
| `write_memory` | Escribe el archivo de memoria del empleado | `employeeId`, `file`, `mergeStrategy` | Cuatro estrategias: `append` / `replace_section` / `upsert_kv` / `overwrite` |

> **No en v1.3.0**: `loop` (iterar N veces o por ítem sobre un arreglo) e `invoke_skill` (llamar a un skill sin pasar por un empleado). Vendrán según feedback de usuarios.

> **Notificaciones de canal de `await_approval` (realmente entregadas desde 1.7.0)**: cada elemento de `approverChannels[]` es
> - `"channelType"` (p. ej. `"web"`) — **no se empuja activamente**; resuélvelo desde el lado admin; o
> - `"channelType:targetId"` (p. ej. `"feishu:oc_xxx"`, `"wecom:xxx"`) — **empuja una notificación de aprobación** a ese destino (grupo de Feishu/WeCom).
>
> Una vez aprobado, el workflow **reanuda automáticamente desde el paso pausado** (el puente resolver → reanudar). En un grupo de Feishu/WeCom puedes **tocar el botón Aprobar/Denegar de la tarjeta** para resolverlo directamente. Ver [Aprobación y seguridad](./security).

### Expresiones: un subconjunto de Pebble

Workflow **no** usa un motor de plantillas completo — soporta el mismo subconjunto de Pebble que Kestra, lo justo para condicionar y referenciar variables, sin ejecución de código.

| Categoría | Sintaxis |
|---|---|
| Referencias a variables | `inputs.X` / `outputs.varname.field` / `vars.X` / `now` / `flow.id` |
| Operadores | `==` `!=` `<` `<=` `>` `>=` `and` `or` `not` `+` `-` |
| Filtros integrados | `length` / `lower` / `upper` / `default('x')` / `toJson` / `fromJson` / `date(formato)` |
| JSONPath | `\| jq('.field.subfield')` |
| Pruebas de strings | `\| contains('x')` / `\| startsWith('x')` / `\| matches('regex')` |

**No soportado** (rechazado en compilación):
- Funciones / macros definidas por el usuario
- `include` / `extends`
- I/O de archivos / I/O de red
- Cualquier operación con efectos secundarios

### Tipo de salida: text vs json

El `outputContentType` de cada paso decide cómo los pasos downstream pueden accederlo:

| outputContentType | Default | Reglas de acceso Pebble |
|---|---|---|
| `text` | ✅ | `outputs.X` es un string; `outputs.X.field` **falla en compilación**; `\| jq(...)` **falla en runtime** |
| `json` | — | `JSON.parse` en runtime; el fallo sigue `errorMode`; el acceso a campos / `jq(...)` son válidos |

**Los pasos de agente por defecto usan `outputContentType=text`** — la salida de lenguaje natural del LLM no es JSON estructurado. Para hacer condicionales o acceso a campos, debes:
1. **Solicitar explícitamente** JSON estricto en el `promptTemplate` ("return strict JSON: {...}")
2. Poner el `outputContentType` de ese paso en `json`

### Combinaciones ilegales en compilación (publicar rechaza)

| Combinación | Razón |
|---|---|
| Múltiples `fan_out` consecutivos sin `collect` que los termine | El `{{input}}` del siguiente paso es ambiguo |
| `collect` sin `fan_out` precedente | No hay nada que recoger |
| `await_approval` mezclado dentro de un grupo `fan_out` | Múltiples aprobaciones concurrentes disparadas sin UX de agregación |
| `agentName` referencia un empleado inexistente / deshabilitado / de otro workspace | Fallo de ACL |
| La expresión Pebble referencia una variable no declarada | En compilación |
| `outputs.X.field` pero el paso X es `text` | Error de tipo en compilación |
| `dispatch_channel` referencia un canal que no está en la allowlist del workspace | ACL |
| `write_memory` referencia un employeeId fuera del workspace | ACL |
| Conteo de pasos > 200 (tope por defecto) | Guarda contra config desbocada |

Publicar corre `WorkflowCompiler.validate(graphJson) → List<CompileError>`. Cada error apunta a un nombre de paso + ruta de campo; el editor Monaco los resalta en línea.

---

## Usando workflow desde la UI

### Punto de entrada

`Workflows` (barra lateral) → lista → **+ Nuevo**.

::: tip
La lista de Workflows está vacía en una instalación fresca. Es intencional — v0 no trae plantillas integradas; las cuentas insignia las co-autoran.
:::

### Editor (v1.3.0 = solo JSON)

- **Editor Monaco**: validación de JSON-schema, autocompletado, chequeo estático de Pebble
- **Desplegable de plantillas**: esqueletos integrados traídos de `GET /api/v1/workflows/draft/templates`
- **Pre-compilar**: `POST /api/v1/workflows/{id}/compile` devuelve diagnósticos de compilación — **no escribe una revisión, no corre realmente**
- **Publicar**: compilar → validar ACL → escribir una fila nueva de `mate_workflow_revision` (revisión entera +1)

::: warning El canvas viene en v1
El canvas de `@vue-flow/core` tiene un shell de UI en v1.3.0, pero renderiza el arreglo de pasos como una cadena de nodos — **no** arrastrar-para-editar. Doble clic en un nodo abre su formulario de campos; el camino de edición principal sigue siendo JSON. La edición visual completa aterriza en v1.4+.
:::

### Lenguaje natural → borrador de workflow (v1.3.0)

`POST /api/v1/workflows/draft/generate` toma una descripción libre ("quiero un flujo de triage de tickets de cliente con entrada por Feishu, enrutado por nivel — enterprise / pro / standard — a distintos manejadores"), corre un agente interno para emitir el `graph_json` correspondiente, y **compila + devuelve inmediatamente** con los diagnósticos adjuntos.

Casos de uso:
- Autores que no conocen el DSL JSON obtienen un primer borrador publicable para refinar en Monaco
- Alimentar en masa documentos SOP viejos por el generador para obtener plantillas de workflow candidatas
- Durante la co-creación con clientes, convertir "cómo quiero que funcione esto" en algo visualizable rápido

Forma de la respuesta:
```json
{
  "graphJson": "...",          // puede ponerse directo en un borrador con PUT
  "compileErrors": [...],      // mismos diagnósticos que /compile
  "modelUsed": "qwen-plus",
  "tokenUsage": { ... }
}
```

::: tip No reemplaza la edición en Monaco
El generador **nunca publica directamente** — solo emite un borrador (vía `saveDraft`); un humano todavía tiene que revisar → compilar → publicar. El JSON generado puede llevar errores de compilación; el autor los limpia antes de publicar.
:::

### Historial de corridas

Cada corrida se persiste como `mate_workflow_run` + `mate_workflow_run_step`. La vista de detalle muestra:
- Entrada / salida por paso (referencias a payload URI)
- Duración por paso + uso de tokens
- Resaltado de la cadena de fallos entre pasos
- Para pasos `await_approval` pausados: quién está aprobando, cuánto lleva esperando

### Fuentes de disparo

Una corrida de workflow solo puede iniciarse a través de [Triggers](./triggers) o vía reanudación de `await_approval` — v0 no tiene endpoint de "dispara uno ahora". Ver la referencia de API arriba para detalles.

::: tip 1.4.0: los triggers ahora viven en el Scheduler
Desde v1.4.0, **Trabajos Programados** y **Triggers** se fusionan en una sola página **Scheduler** (`Ajustes → Scheduler`, ruta `/settings/scheduler`) con tres pestañas: **Trabajos Programados / Triggers de Eventos / Historial de Corridas**. Para ligar un trigger a un workflow, crea una regla `target_type=workflow` en la pestaña **Triggers de Eventos** del Scheduler. Ver [Triggers](./triggers).
:::

---

## Referencia de API

Todos los endpoints viven bajo `/api/v1/workflows/`. Las solicitudes deben llevar el encabezado `X-Workspace-Id`.

### CRUD

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/workflows` | Lista todos los workflows del workspace actual |
| `POST` | `/api/v1/workflows` | Crear un workflow nuevo (el borrador empieza vacío) |
| `GET` | `/api/v1/workflows/{id}` | Traer metadatos del workflow + borrador en línea |
| `PUT` | `/api/v1/workflows/{id}` | Actualizar metadatos del workflow (nombre / descripción / habilitado) |
| `PUT` | `/api/v1/workflows/{id}/draft` | Guardar el graph_json del borrador en línea (no compila) |
| `DELETE` | `/api/v1/workflows/{id}` | Borrado suave |

### Compilar / Publicar

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/v1/workflows/{id}/compile` | Compilar el borrador actual y devolver diagnósticos — **no persiste una revisión** |
| `POST` | `/api/v1/workflows/{id}/publish` | Compilar + persistir una revisión nueva; actualiza `latest_revision_id` |

### Generador de borradores (integrado en v1.3.0)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/workflows/draft/templates` | Lista plantillas de borrador integradas |
| `POST` | `/api/v1/workflows/draft/preview-compile` | Compilar un graph_json arbitrario — muestra diagnósticos reales antes de que exista una fila de workflow |
| `POST` | `/api/v1/workflows/draft/generate` | **Lenguaje natural → borrador de workflow** — describe el flujo, un agente emite graph_json + diagnósticos de compilación |

### Inspección de corridas / reanudación

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/workflows/{id}/runs?limit=...` | Corridas recientes de un workflow (default 50) |
| `GET` | `/api/v1/workflows/runs/paused?limit=...` | Todas las corridas pausadas del workspace (punto de entrada del operador) |
| `GET` | `/api/v1/workflows/runs/{runId}` | Detalle de una corrida + todas las filas de paso (entrada / salida / duración) |
| `POST` | `/api/v1/workflows/runs/{runId}/resume` | Reanudar desde una pausa `await_approval` (llamado automáticamente cuando llega una aprobación; no para uso manual) |

::: warning v0 no tiene endpoint independiente de "iniciar corrida"
Solo hay dos caminos para iniciar realmente una corrida de workflow:

1. **Vía un trigger** — configura un trigger en [Triggers](./triggers) apuntando a este workflow (`target_type=workflow`); cuando llega un evento el motor inicia la corrida
2. **Vía reanudación de `await_approval`** — el endpoint de reanudar empuja una corrida pausada hacia adelante

**No hay** endpoint `POST /api/v1/workflows/{id}/runs` de "dispara uno ahora" en v0. Para una corrida seca, usa `/draft/preview-compile` para obtener la salida de compilación (**solo compilación — sin persistir, sin corrida real**), o liga un trigger webhook temporal. Un endpoint de inicio manual de corrida está en el RFC pero aterriza en un release posterior.
:::

---

## Modelo de seguridad

### ACL de tres capas

| Rol | Capacidades |
|---|---|
| `workflow:author` | Editar borradores, leer sus propias corridas |
| `workflow:publisher` | Publicar revisiones; los chequeos de ACL estáticos se disparan aquí |
| `workflow:operator` | Iniciar/detener triggers, cancelar corridas, ver corridas de otros |

### Identidad de ejecución por paso

Cada paso lleva en su ExecutionContext:
- `workspaceId`: debe ser igual al workspace del workflow
- `actingAgentId`: para `sequential` y los tres modos de AuraClaw → el agente de ese paso; para otros modos → el publisher como fallback
- `triggeredBy` / `workflowId` / `revisionId` / `runId`: para trazabilidad de auditoría

### Aislamiento entre workspaces

Al publicar, `WorkflowAclValidator.checkAll(graphJson)` corre:
- las referencias `agentName` deben apuntar a un empleado del workspace actual
- los canales de `dispatch_channel` deben estar en la allowlist del workspace
- los employeeIds de `write_memory` deben estar dentro del workspace actual

Cualquier fallo → publicar falla, la transacción revierte, **sin fila de revisión escrita, sin actualización de `latest_revision_id`**.

### Relación con la [ligadura de herramientas MCP por agente](./mcp)

Workflow **no puede** otorgar herramientas adicionales a los empleados. Cuando un paso de agente llama a una herramienta, pasa por la misma ACL de `AgentBindingService.getEffectiveToolNames(agentId)` — lo que un empleado puede hacer dentro de un workflow es exactamente lo que puede hacer en el chat normal.

---

## URI de almacenamiento interno para payloads

Las entradas / salidas / artefactos intermedios de workflow por encima del umbral por defecto de 4KB se derraman automáticamente a la tabla `mate_workflow_payload` (v1.3.0: almacenamiento en la misma BD) o al fallback de filesystem local, y se reemplazan en línea con una URI `payload://`. Esto evita que los contextos grandes revienten la columna de mensajes — ver el commit `9c81dba0 feat(workflow): payload fs fallback for medium-size payloads`.

```text
payload://run/abc123/step/enrich/output → resuelto por el backend al momento del acceso
```

La UI carga perezosamente a demanda.

---

## Modelo de datos

El subsistema de workflow toca 8 tablas:

| Tabla | Propósito |
|---|---|
| `mate_workflow` | Raíz del workflow (id / nombre / workspace) |
| `mate_workflow_revision` | Revisiones publicadas (revisión entera; snapshot completo del graph_json; inmutable) |
| `mate_workflow_run` | Una ejecución (runId / triggerSource / status / startedAt / endedAt) |
| `mate_workflow_run_step` | Entrada/salida/duración por paso dentro de una corrida |
| `mate_workflow_run_pause` | Estado de pausa `await_approval` persistente (sobrevive al reinicio) |
| `mate_workflow_payload` | Almacenamiento interno de payloads grandes (destino de la URI `payload://`) |
| `mate_trigger` | Configuraciones de trigger (con `pattern_version` de cron) |
| `mate_trigger_event` | Historial de dedup de eventos + rate-limit |

---

## Limitaciones conocidas (v1.3.0)

- **Sin canvas de arrastrar-para-editar** — el canvas es renderizado de cadena de solo lectura; el camino de edición principal es JSON
- **Sin paso `loop`** — no puede iterar por ítem ni reintentar N veces. Workaround: un número fijo de ramas `fan_out`, o programación de más alto nivel de múltiples corridas
- **Sin paso `invoke_skill`** — los skills deben adjuntarse a un agente e invocarse a través del agente
- **Sin compartir entre workspaces** — para reutilizar una plantilla de workflow entre workspaces, cópiala
- **Sin edición colaborativa en tiempo real** — ediciones concurrentes del mismo borrador: **el último en escribir gana**
- **Sin política de reintento por paso** — `errorMode.retry` es a nivel de paso; el reintento más fino está diferido

---

## Relacionado

- [Triggers](./triggers) — el punto de entrada de eventos del workflow
- [Aprobación y seguridad](./security) — en qué se enchufa `await_approval`
- [Agentes](./agents) — qué referencia `agentName`
- [Canales](./channels) — qué puede alcanzar `dispatch_channel`
- [Memoria](./memory) — a qué archivo escribe `write_memory`
