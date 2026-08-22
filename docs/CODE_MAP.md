# CODE_MAP.md — Mapa guiado del núcleo de AuraClaw

> Documento vivo de inmersión en el código (P7). Complementa `architecture.md`
> (vista de 30.000 pies, en `mateclaw-server/src/main/resources/docs/es/`).
> Aquí el nivel es **operativo**: clases de entrada, flujo de una petición,
> datos que mueve y **dónde** tocar para personalizar.
>
> Rama: `main` (base v2.1.0) · Paquetes: `vip.mate.*` (núcleo) / `com.auracore.*` (zonas propias)
>
> Estado: ✅ Módulos 1–7 hechos

---

## Módulo 1 · Runtime de agentes (`vip.mate.agent` + `goal` + `planning`)

**El corazón.** Un "empleado digital" es un **StateGraph** (Spring AI Alibaba) construido en runtime
por `AgentGraphBuilder`. Todo lo demás (tools, memory, wiki, channels…) se engancha como
nodos/aristas/herramientas de este grafo.

### Piezas principales

```
vip.mate.agent
├── AgentGraphBuilder         ★ FACTORÍA del grafo (el ensamblador lo es TODO)
├── BaseAgent / AgentService  contrato del agente + orquestación de conversación
├── AgentState / AgentToolSet estado compartido del turno / set de tools del agente
├── graph/                    ★ los dos runtimes (grafo + nodos + aristas)
│   ├── StateGraphReActAgent       runtime ReAct clásico
│   └── plan/StateGraphPlanExecuteAgent  runtime Plan-and-Execute (con goals)
├── runtime/                  registry de conversaciones activas + "environment events"
├── delegation/               SubAgentRegistry, subagent runs, heartbeat, uso delegado
├── context/                  presupuesto de contexto (truncado, budget, estimador tokens)
├── progress/  event/         ProgressLedger (streaming de progreso) + GraphEventPublisher
├── controller/  service/     REST (AgentController) + AgentGenerationService, TemplateService
└── model/  vo/  repository/  entidades (AgentEntity) + VOs + repo
```

### Fluxo de una conversación

```
REST (AgentRuntimeController/AgentController, SSE)
  → AgentService / AgentGenerationService
    → AgentGraphBuilder (por conversación/agente)  ← grafo ya ensamblado y cacheado
      → BaseAgent.run(turno)  (ReactAgent / PlanExecuteAgent)
        → grafo StateGraph (Spring AI Alibaba) con nodos:
            ReAct:        Reasoning → Action → Observation → … → FinalAnswer
            Plan-Execute: PlanGeneration → StepExecution → DirectAnswer/PlanSummary → GoalEvaluation
        → nodos: ReasoningNode, ActionNode, ObservationNode, FinalAnswerNode
        → aristas: ReasoningDispatcher, ObservationDispatcher, GoalEvaluationDispatcher,
                   PlanGenerationDispatcher, StepProgressDispatcher
        → ejecutores: ToolExecutionExecutor, ToolResultStorage (+ retención programada)
        → ledgers: ActionExecutionLedger, SourceEvidenceLedger (citas «Fuentes:»)
```

### Decisiones clave dentro de `AgentGraphBuilder.build()` (★ zona de integración)

Concentra toda la política de ensamblado (si algo no lo ves aquí, pregunta antes de tocar):

1. **Resolución de modelo** con precedencia `pin de conversación > override del agente > default global`
   (`resolveRuntimeBaseModel`); degrada en silencio pins rotos.
2. **Elección del runtime**: `agentType == "plan_execute"` → Plan-and-Execute; cualquier otro → ReAct.
3. **Filtrado de tools** en build-time (qué tools el modelo *ve*) + **Tool Guard** en call-time
   (qué puede *llamar*) + `autoDemotedTools` (tools degradadas automáticamente).
4. **Presupuesto de contexto** (`prefixBudgetPlan`): si el prompt base supera la mitad del techo,
   se activan políticas de truncado (ver `context/`).
5. **Skills**: catálogo de skills renderizado en el prompt + meta-tool `load_skill` opcional
   (escape hatch `mateclaw.skill.disclosure.load-skill-tool.enabled`).
6. **Nuestra personalización ya aplicada aquí**: bloque `ABOUT_YOU_BLOCK` (agente se identifica
   como AuraClaw) y prompts de sistema en español.

### Claves de estado compartido

- `MateClawStateKeys` / `MateClawStateAccessor` — las claves que comparten los nodos del grafo
  (mensajes, tools, resultados, observaciones, plan…).
- `PlanStateKeys` (en `graph/plan/state`) — claves del runtime Plan-and-Execute.

### Dónde personalizar / gotchas

| Quiero… | Voy a… |
|---|---|
| Un agente/eje nuevo con otro comportamiento | Extender `BaseAgent` o añadir un nodo+arista nuevo en `graph/`, registrarlo en `AgentGraphBuilder` — **superficie caliente del upstream, minimizar ediciones** |
| Cambiar la política de planificación/goals | `vip.mate.planning` (PlanningService) + `vip.mate.goal` (GoalService/GoalEvaluation/GoalFollowup) |
| Añadir capacidad nueva al agente | Mejor un `@Tool` (Módulo 3) que tocar el grafo |
| Subagentes / delegación | `delegation/`: SubagentRegistry, SubagentController, heartbeat |

**Gotchas aprendidos en nuestro fork:**
- Los nodos `*Node` y aristas `*Dispatcher` son la superficie con MÁS conflictos en merges del
  upstream — no editar sin necesidad; si hay que tocar, cambios pequeños y localizados.
- `PlanGenerationNode.displayGoal` hace *scrubber bilingüe* de `[Instrucción de tarea]`/`[任务指令]` —
  si se cambia la emisión, cambiar **emisión + parsing juntos** (regla de marcadores, CUSTOMIZATIONS.md).
- El runtime es **síncrono sobre SSE**, no WebFlux: el streaming de progreso sale por
  `GraphEventPublisher` + `ProgressLedger` (no hay push asíncrono adicional).

---

## Módulo 2 · Memoria + workspace (`vip.mate.memory` + `vip.mate.workspace`)

**La persistencia mental del agente.** La memoria es **en capas** y multi-tenant (`owner_key`):
ficheros de texto en el workspace (PROFILE.md, MEMORY.md, notas diarias), entradas tipadas
(perfil, feedback) y un grafo de hechos (*facts*). El workspace es la unidad de
multi-tenencia (miembros, roles, archivos, sandbox).

### Piezas principales

```
vip.mate.memory
├── spi/MemoryProvider + MemoryManager  ★ SPI: proveedores de memoria + fachada
│   ├── provider/BuiltinMemoryProvider     ficheros del workspace (PROFILE.md, MEMORY.md…)
│   ├── provider/StructuredMemoryProvider  entradas tipadas de bajo volumen (perfil, feedback)
│   └── fact/provider/FactMemoryProvider   grafo de hechos (entities + facts + contradicciones)
├── identity/      MemoryScope (TEAM/GLOBAL/PERSONAL) + MemoryOwnerResolver (owner_key)
├── lifecycle/     MemoryLifecycleMediator  ★ gancho por turno (prefetch + sync)
├── service/       recall, summarization (gate), emergence, SOUL summarizer, morning card,
│                  consolidation estructurada, sueños (DreamMode/DreamReport)
├── scheduler/     DreamingScheduler (sueños) + StructuredMemoryMaintenanceScheduler (fondo)
├── fact/          extracción (LLM + patrones), detección de contradicciones,
│                  proyección, query + herramientas (FactQueryTool)
├── tool/          UniversalMemoryTool, StructuredMemoryTool  (tools expuestas al agente)
├── archive/ event/ nudge/ search/ listener/  soporte (archivo, eventos, nudges, búsqueda)
└── controller/ service/ repository/ model/    REST + servicios + persistencia

vip.mate.workspace
├── core/          WorkspaceService, miembros+roles (viewer/admin/owner), sandbox, upload,
│                  anotaciones @RequireGlobalAdmin / @RequireWorkspaceRole, RoleCapabilities
├── conversation/  ConversationService, mensajes (entidades + VOs + trazas)
└── document/      WorkspaceFileService (+ MEMORY files por owner), archivo de memoria
```

### Flujo: memoria dentro de un turno

```
ReasoningNode / PlanGenerationNode    ← llaman SOLO a MemoryLifecycleMediator
  ├─ beforeLlmCall(TurnContext)
  │    ├─ MemoryManager.prefetchAll(agent, userQuery, ownerKey)  → bloque de contexto
  │    └─ publica TurnStartedEvent
  └─ afterLlmCall(ctx, reply)
       ├─ MemoryManager.syncAll(...)   → NON-BLOCKING (dispara syncTurn de cada provider)
       └─ publica TurnCompletedEvent   → consolidación/emergencia en background
```

### Decisiones clave

1. **Scoping**: cada fila de memoria tiene `scope` (`TEAM`/`GLOBAL` compartido, `PERSONAL`
   ligado a `owner_key`) — se guarda como columna string, no enum de BD.
2. **Fecha vs owner**: las notas diarias y la memoria consolidada comparten nombre de fichero
   (`memory/YYYY-MM-DD.md`) → la clave de lookup es **owner_key + filename**, no solo el nombre.
3. **Prefetch por turno**: `beforeLlmCall` inyecta el bloque de contexto ANTES de cada llamada LLM,
   usando la query del turno actual como clave de recall.
4. **Hechos (facts)**: extracción compuesta (LLM + patrones) → entidades/relaciones → detección de
   contradicciones → proyección programada → consulta por herramienta (`FactQueryTool`).
5. **Fondo**: sueños (`DreamingScheduler`), consolidación estructurada, mantenimiento y nudges
   corren en schedulers, no bloquean el turno.

### Dónde personalizar / gotchas

| Quiero… | Voy a… |
|---|---|
| Un proveedor de memoria nuevo (p.ej. BD propia / API) | Implementar `MemoryProvider` (SPI) + registrarlo; la fachada `MemoryManager` lo descubre. **Zona ideal `com.auracore.*`** |
| Cambiar qué se inyecta al agente por turno | `MemoryLifecycleMediator` + `prefetchAll` (pero es superficie caliente: tocar poco) |
| Cambiar la plantilla/seed del perfil | Seeds en las migraciones (PROFILE.md) — **ya corregimos la sección `## Identidad`** (Módulo 5bis del historial) |
| Roles/permissions nuevos en workspace | `RoleCapabilities` (autoritativa) + checks en capa service. ⚠️ El código **no mantiene copia local** de la tabla de roles |

**Gotchas aprendidos en nuestro fork:**
- `MemoryManager.syncAll` es **no bloqueante**: no esperar que la escritura esté visible inmediatamente tras el turno.
- Los ficheros de memoria son **workspace files** con permisos de sandbox: leerlos directo del FS local puede
  fallar en Docker (viven en el volumen del workspace del tenant).
- `saveMemoryFile` habilita la fila PERSONAL del owner → sin ese paso el prefetch del siguiente turno no la recoge.
- Aquí vive el bug que corregimos (el agente escribía su **propio** nombre en PROFILE.md): la plantilla tenía
  `## Identidad` ambigua; hoy las seeds es/en/zh usan secciones neutras.

## Módulo 3 · Tools (`vip.mate.tool`)

**El catálogo de capacidades.** 238 clases: el registro de herramientas que el agente puede ver/llamar.
Las tools están **fuera del grafo** — se inyectan como `ToolCallback`s; el grafo solo las ejecuta.

```
vip.mate.tool
├── ToolRegistry                 ★ discovery de @Tool beans (única fuente de verdad) + registro de plugins
├── ConcurrencyUnsafe / ToolConcurrencyRegistry   tools con límite de concurrencia
├── builtin/    tools del núcleo: Browser, CodeExecute, DelegateAgent, edición de archivos,
│               doc/office (docx/pdf/pptx/officecli), imagen (generar/analizar/render), cron,
│               objetivo/goal, compliance scan, docs (MateClawDocTool), audio/video, 3D…
├── guard/      ★ Tool Guard (call-time): ToolGuardService + reglas/config/audit/seed
├── disclosure/ ToolDisclosureService (tiérs) + ToolUsageRecencyTracker → qué tools se anuncian
├── mcp/        servidores MCP (clientes, runtime, progreso)
├── image/ document/ video/ model3d/ browser/ search/ music/ local/  categorías de tools
└── service/ model/ repository/ controller/
```

### Decisiones clave

1. **Discovery**: `ToolRegistry.getBeansWithAnnotation` recorre beans Spring `@Tool` (una vez) y
   consulta **blacklist de DB** para disable explícito. Sin fila → habilitada por defecto
   (nueva tool = auto-disponible).
2. **Filtro en build-time** (qué tools el modelo **ve**): tiérs de `DisclosureTier` + tracker de
   recencia de uso (`ToolUsageRecencyTracker`) — herramientas poco usadas se ocultan del prompt.
3. **Filtro en call-time** (qué tools el modelo **puede llamar**): `ToolGuardService` evalúa reglas
   (política, sensibilidad) y escribe audit. Es el “approval/prevent” de herramientas.
4. **MCP**: planea conectar skills/context sub
5. **Plugins**: un plugin puede registrar/des-registrar tools en caliente (`registerPluginTool`).
6. **i18n**: `LocaleAwareToolCallback` envuelve tools para descripción localizada.

### Dónde personalizar / gotchas

| Quiero… | Voy a… |
|---|---|
| **Añadir una capacidad nueva al agente** | Crear un bean `@Tool` (Spring) — se auto-descubre, sin tocar el grafo. **Esta es LA vía recomendada** |
| Controlar qué tools se ven/usan | Tiérs de disclosure + reglas de `Tool Guard` + blacklist de DB |
| Integrar una API/DB propia como tool | Bean `@Tool` en `com.auracore.*` que llame a la API; registrar una fila si quieres disable por defecto |

**Gotchas:** el nombre del bean ES el nombre de la tool en el prompt (cambiar el bean = renombrar la tool);
las tools con `ConcurrencyUnsafe` se limitan por `ToolConcurrencyRegistry` (no aumentar a la ligera).

---

## Módulo 4 · Wiki (`vip.mate.wiki`)

**La memoria documental.** Digiere documentos del workspace en **páginas wiki** con `[[wikilinks]]`,
citas, hot-cache y recuperación por fragmentos (snippets) para responder con fuentes.

```
vip.mate.wiki
├── pipeline/   ★ ingestión: WikiPipelineService + steps (WikiLlmStepExecutor, WikiSkillStepExecutor)
│               + trigger (WikiPipelineTriggerService/Listener) — la digestión va en pasos/estados
├── hotcache/   WikiHotCacheService/Updater + rebuild scheduler + eventos (caché caliente de context)
├── retrieval/  SnippetExtractor — de página a fragmento citable
├── service/    servicios principales (páginas, citas, reconciliación de [[links]])
├── job/        trabajos de fondo (mantenimiento, reconciliación de enlaces)
├── relation/   grafo de relaciones entre páginas · profile/ · source/ · metrics/
├── event/ sse/  eventos + streaming de digestión
└── model/ dto/ repository/ controller/ tool/
```

### Flujo (lo que ya probamos en vivo en P4/P5)

```
Documento subido/trigger (WikiPipelineTriggerListener)
  → WikiPipelineService → steps (LLM / skill)  → páginas con [[slug]] + citas
  → reconciliación de [[links]] (job/servicios) → hot cache → retrieval (SnippetExtractor)
  → el agente responde citando «Fuentes: [n]» (envia al SourceEvidenceLedger del Módulo 1)
```

**Gotcha:** los `[[wikilinks]]` rotos se detectan/reconcilian en segundo plano — un doc nuevo puede
referenciar slugs aún no existentes; verificar con los jobs de reconciliación.

---

## Módulo 5 · Canales IM (`vip.mate.channel`)

**Las superficies de entrada/salida** de los empleados digitales.

```
vip.mate.channel
├── ChannelAdapter (interfaz) + AbstractChannelAdapter   ★ SPI de canal
│     start/stop, onMessage, sendMessage, renderAndSend, sendApprovalNotice,
│     proactiveSend (con DeliveryOptions), soporte de tarjetas interactivas, líder único
├── feishu  wecom  weixin  dingtalk  telegram  discord  slack  qq    adapters IM
├── web/ WebChannelAdapter + WebChannel     canal web (consola)
├── webchat/                                widget webchat (UMD/ES)
├── controller/ service/ repository/        REST de canales + servicio de mensajes
├── verifier/ media/ qrcode/ tool/          soporte (verificación, medios, QR, tools de canal)
├── leader/ health/ notification/ cards/    líder de canal, health, notifs, tarjetas
└── model/ event/
```

### Decisiones clave

1. **SPI de canal**: implementar `ChannelAdapter` = nuevo canal (start/stop/onMessage/sendMessage).
   Es el punto de extensión oficial (ver `architecture.md`).
2. **Envío proactivo**: cada canal declara si soporta proactividad + *single leader* (para no
   duplicar envíos en deploy multi-instancia) y *staleness threshold*.
3. **Tarjetas de aprobación**: los canales pueden optar por tarjetas interactivas
   (`usesInteractiveApprovalCards`) o el fallback de texto (marcador `[Pendiente de aprobación]`).
4. **Mensajes parciales**: `sendContentParts` / `renderAndSend` manejan partes (texto, imagen…).

**Gotcha (lo que tocamos):** el marcador bilingüe de aprobación vive en `ApprovalPlaceholderUtil`
(`approval`) y su parsing en `MessageBubble` (frontend); el render de tarjeta es el fallback cuando el canal
no soporta interacción.

---

## Módulo 6 · Seguridad / aprobación / auditoría (`auth` + `approval` + `audit`)

**La capa de confianza.**

```
auth/   AuthService (login, JWT con clave `mateclaw.jwt.secret`, refresh por renovación próxima)
        + RBAC por rol · pat/ (Personal Access Tokens) · sso/ (proveedores SSO, SsoService/Controller)
audit/  AuditEventController/Service/Entity — trail de auditoría (quién hizo qué) — 4 clases
approval/  ApprovalService + ApprovalWorkflowService + ApprovalController
           + PendingApproval/Decision/Status + ApprovalPlaceholderUtil (marcador bilingüe)
```

### Flujo de aprobación

```
Acción sensible (tool / channel / workflow) → ApprovalService/PendingApproval
  → canal emite aviso (tarjeta interactiva o placeholder de texto)  → decisión (Approve/Reject)
  → ApprovalWorkflowService aplica el resultado y continúa/aborta la acción
```

**Gotchas:** la clave JWT por defecto (`MateClaw-Secret-Key-2024…`) es un secreto de DEV — en prod
**obligatorio** sobrescribirla en overlay (`application-prod.yml` / env `mateclaw.jwt.secret`). La suite
`approval` la tocamos al traducir marcadores: mantener parsing bilingüe.

---

## Módulo 7 · Workflow / triggers / cron / acp / plugin

**Las automatizaciones y el "hormigón armado" de integración.**

### workflow/ — DSL de flujos (Pebble)

```
workflow/
├── compiler/   WorkflowCompiler + Parser + WorkflowSchemaValidator + PebbleSubsetEvaluator
│               + WorkflowAclValidator (qué puede publicar cada rol) + OutputContentTypeChecker
├── runtime/    WorkflowRunner + pasos (Steps) vía StepAdapterRegistry:
│               AgentStepExecutor · ChannelDispatcher · MemoryWriter · ApprovalResumeBridge
│               + PayloadStore, MergeStrategies, WorkflowResumer, eventos de completion
├── draftgen/   WorkflowAuthoringTool + WorkflowDraftGenerator (el agente puede redactar flujos)
├── api/        WorkflowController + WorkflowResumeController (REST)
└── model/ repository/ service/
```

Flujo: `WorkflowController`/publicación → `WorkflowCompiler` (parse + schema + ACL) →
`WorkflowRunner` ejecuta pasos (agente → canal → memoria → aprobación) → reanudable
(`WorkflowResumer`) si una aprobación pausa el flujo.

**Punto de extensión natural:** registar un `StepAdapter` nuevo = nuevo tipo de paso del DSL.

### trigger/ — eventos que disparan flujos

```
trigger/
├── ingest/     TriggerEventIngestService (validación + rate limit), TriggerPatternMatcher, BotSelfFilter
├── dispatch/   TriggerDispatcher + WorkflowGraphLoader (DefaultWorkflowGraphLoader) +
│               bridges: ChannelMessageEventBridge, AgentLifecycleEventBridge, WorkflowCompletionEventBridge
└── scheduler/  TriggerScheduler
```

Flujo: evento (mensaje de canal, ciclo de vida del agente, workflow completado) → `ingest` filtra
(rate limit, bot-self) → `TriggerDispatcher` empareja patrón (PatternMatcher) → carga el grafo del
workflow y lo lanza.

### cron/ — cron distribuido

```
cron/  CronJobService (CRUD) + CronJobLifecycleService + CronJobRunner
       + delivery/ (ChannelCronResultDelivery, CronDeliveryListener, CronRunStaleCleanup)
       + config/ShedLockConfig  ★ lock distribuido (ShedLock)
```

**Decisión clave**: el lock es **ShedLock** — en multi-instancia un cron solo ejecuta en UNA instancia
(los runs stale tienen cleanup).

### acp/ — puente ACP (Claude Code / Codex)

```
acp/  AcpStdioClient (proceso stdio) + AcpDelegationService (acumula agent_message_chunk,
      sesiones multi-turno con timeout de "agente colgado") + endpoint mgmt + AcpRuntimeSupport
```

Es el puente para que AuraClaw delegue sesiones de **codificación** a agentes externos vía protocolo ACP
(cliente stdio + endpoints configurables).

### plugin/ — extensión vía plugins (SDK `mateclaw-plugin-api`)

```
plugin/  PluginManager + LoadedPlugin + bridges (PluginChannelBridge, PluginMemoryBridge,
         PluginSearchBridge) + PluginController + modelo
```

Los plugins (SDK en `mateclaw-plugin-api/`) extienden canales, memoria y búsqueda, y registran tools.

### Dónde personalizar / gotchas

| Quiero… | Voy a… |
|---|---|
| Automatización tipo "si mensaje → workflow" | Trigger (pattern) + workflow Pebble + Steps |
| Nuevo tipo de paso en workflows | `StepAdapter` (runtime) registrado en el registry |
| Ejecución programada robusta | CronJob + delivery a canal; el lock ShedLock evita duplicados |
| Delegar a un agente de código externo | Endpoint ACP configurable (`acp`) — Claude Code / Codex |
| Extender canales/memoria/búsqueda sin tocar el núcleo | Un plugin del SDK `mateclaw-plugin-api` |

**Gotchas:** el DSL Pebble es un **subconjunto** validado (`PebbleSubsetEvaluator` + schema) — no todo
Pebble vale; los ACL de publicación se validan en compile (`WorkflowAclValidator`). Los plugins no
sustituyen al registro nativo de tools (Módulo 3) — son para extensiones de terceros (bridge).

---

<!-- fin del mapa -->

## Nota final

Este mapa es la **capa operativa** sobre `architecture.md`. Antes de tocar cualquier zona marcada como
"superficie caliente" (nodes/dispatchers del grafo, `AgentGraphBuilder`, `RoleCapabilities`,
`MemoryLifecycleMediator`), leer el módulo correspondiente y consultar `docs/CUSTOMIZATIONS.md` para
respetar la regla de marcadores bilingües y las zonas V900+ / `com.auracore.*`.