# Arquitectura

**Cómo está armado AuraClaw, en una página.**

Si estás usando AuraClaw, lee [Introducción](./intro). Si estás construyendo sobre AuraClaw — agregando herramientas, canales nuevos, proveedores de memoria personalizados, nodos de grafo de agente nuevos — lee esta página.

---

## El producto en un diagrama

```
┌─────────────────────────────────────────────────────────────────┐
│                         AuraClaw                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Consola Web  │  │  App Desktop │  │   Canales IM        │   │
│  │   Vue 3 SPA  │  │   Electron   │  │ DingTalk / Feishu / │   │
│  │  (src/static)│  │  + JRE 21    │  │ WeCom / Telegram /  │   │
│  │               │  │   embebido   │  │ Discord / QQ / ...  │   │
│  └───────┬──────┘  └──────┬───────┘  └──────────┬──────────┘   │
│          │  HTTP/SSE       │  HTTP/SSE            │ SPI           │
│          └────────┬────────┴───────────────────────┘              │
│                   │                                               │
│  ┌────────────────▼──────────────────────────────────────────┐  │
│  │            Backend Spring Boot (vip.mate.*)                │  │
│  │                                                             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │  │
│  │  │    auth     │  │  channel    │  │      agent          │   │  │
│  │  │   (JWT)     │  │  adapters   │  │  (runtime          │   │  │
│  │  └────────────┘  └─────┬──────┘  │   StateGraph)       │   │  │
│  │                        │         │                     │   │  │
│  │  ┌────────────┐        │         │  ┌──────────────┐   │   │  │
│  │  │ workspace  │        │         │  │  ReasoningN  │   │   │  │
│  │  │ isolation  │        │         │  │  ActionN     │   │   │  │
│  │  └────────────┘        │         │  │  Observation │   │   │  │
│  │                        │         │  │  PlanGenN    │   │   │  │
│  │                        ▼         │  │  StepExecN   │   │   │  │
│  │                ┌──────────────┐  │  │  FinalAnsN   │   │   │  │
│  │                │  Message     │  │  └──────────────┘   │   │  │
│  │                │  Router      ├──▶      │               │   │  │
│  │                └──────────────┘  └──────┼─────────────┘   │  │
│  │                                          │                   │  │
│  │  ┌─────────────────────────────────────▼────────────────┐ │  │
│  │  │                    Tool Registry                        │ │  │
│  │  │                                                         │ │  │
│  │  │   @Tool integrado  +  clientes MCP  +  scripts Skill   │ │  │
│  │  └─────────┬───────────────────────────────────────────┬──┘ │  │
│  │            │                                            │   │  │
│  │            ▼                                            ▼   │  │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────────┐  │  │
│  │  │  Tool Guard  │  │ Approval    │  │  Audit Log        │  │  │
│  │  │  (reglas)    │  │ Workflow    │  │  Pipeline         │  │  │
│  │  └──────────────┘  └─────────────┘  └───────────────────┘  │  │
│  │                                                             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │  │
│  │  │   memory    │  │    wiki     │  │    skill            │   │  │
│  │  │ multicapa   │  │  (en capas) │  │  (runtime SKILL.md) │   │  │
│  │  │   SPI       │  │  digestor   │  │                     │   │  │
│  │  └────────────┘  └────────────┘  └────────────────────┘   │  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │           MyBatis Plus / H2 o MySQL                │   │  │
│  │  │                                                      │   │  │
│  │  │    mate_agent / mate_message / mate_wiki_* /        │   │  │
│  │  │    mate_tool_guard_* / mate_workspace / ...          │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Un JAR. Un proceso. Todo el artilugio.

---

## Layout del repositorio

```
mateclaw/
├── mateclaw-server/          # Backend Spring Boot (el corazón)
│   └── src/main/java/vip/mate/
│       ├── MateClawApplication.java
│       ├── agent/            # Runtime StateGraph, nodos, aristas, estado
│       ├── planning/         # Persistencia de Plan y SubPlan
│       ├── workflow/         # Motor de workflow (1.3.0+): compilador DSL, runtime lineal, derrame de payload
│       ├── trigger/          # Motor de triggers (1.3.0+): 6 tipos de patrón, gobernanza de eventos, CronDelegationPort
│       ├── tool/             # ToolRegistry, beans @Tool, MCP (ligadura por agente), guard
│       ├── approval/         # Flujo de aprobación (también puentea la pausa/reanudación de await_approval del workflow)
│       ├── skill/            # Paquetes de skills dinámicos
│       ├── wiki/             # LLM Wiki + motor de Transformaciones (1.3.0+)
│       ├── memory/           # Capas de memoria + SPI
│       ├── workspace/        # Entidad de workspace + conversación + documento
│       ├── channel/          # SPI de canales + adaptadores (1.3.0+: WeCom v2, cola de respuestas, lease de líder)
│       ├── llm/              # Configuración de proveedores LLM (1.3.0+: enrutamiento de sidecar multimodal)
│       ├── auth/             # Spring Security + JWT
│       ├── audit/            # Pipeline de eventos de auditoría
│       ├── cron/             # Motor de jobs programados (trigger.cron reutiliza vía CronDelegationPort)
│       ├── task/             # Runtime de tareas asíncronas
│       ├── dashboard/        # Agregación de métricas
│       ├── datasource/       # Conexiones de BD externas
│       ├── stt/              # Voz-a-texto
│       ├── tts/              # Texto-a-voz
│       ├── system/           # Ajustes del sistema, bootstrap, onboarding
│       ├── config/           # Configuración de Spring
│       ├── common/           # Utilidades compartidas
│       └── exception/        # Manejador global de excepciones
│   └── src/main/resources/
│       ├── application.yml
│       ├── db/migration/      # Scripts de migración Flyway (h2/ + mysql/)
│       ├── db/data.sql       # Datos semilla
│       ├── prompts/          # Plantillas de prompt del LLM
│       ├── skills/           # Paquetes de skills empaquetados
│       └── static/           # Salida de build del frontend
├── mateclaw-ui/              # Consola de administración Vue 3
├── mateclaw-desktop/         # Shell de escritorio Electron
├── mateclaw-webchat/         # Widget de chat embebible
├── matevip-sites/            # Sitios de marketing y docs (workspace pnpm)
├── docs/                     # Esta documentación (VitePress)
├── deploy/                   # Configs de despliegue de producción
├── docker-compose.yml
└── .env.example
```

El backend es un **monolito modular único**. Los otros proyectos son paquetes independientes que no comparten código con el backend.

---

## El runtime del agente es un StateGraph

Esto es lo más importante de saber si contribuyes al backend.

**El runtime del agente de AuraClaw no es una jerarquía de clases.** No hay una cadena de herencia `BaseAgent` → `ReActAgent` → `MyCustomAgent`. El runtime es un **StateGraph** (de `spring-ai-alibaba-graph`) compuesto de nodos y aristas condicionales, ensamblado en runtime por `AgentGraphBuilder`.

### Piezas clave

- `agent/graph/StateGraphReActAgent.java` — ensambla el bucle ReAct
- `agent/graph/plan/StateGraphPlanExecuteAgent.java` — ensambla el grafo Plan-and-Execute
- `agent/graph/node/` — `ReasoningNode`, `ActionNode`, `ObservationNode`, `FinalAnswerNode`, `SummarizingNode`, `LimitExceededNode`, `GoalEvaluationNode`
- `agent/graph/plan/node/` — `PlanGenerationNode`, `StepExecutionNode`, `PlanSummaryNode`, `DirectAnswerNode`
- `agent/graph/edge/` + `plan/edge/` — funciones dispatcher que deciden el siguiente nodo según el estado
- `agent/graph/state/MateClawStateKeys.java` — las claves del objeto de estado compartido
- `agent/graph/state/MateClawStateAccessor.java` — accessor tipado del mapa de estado (no toques el mapa directamente)
- `agent/graph/lifecycle/ReActLifecycleListener.java` — hooks de instrumentación a nivel de nodo
- `agent/AgentGraphBuilder.java` — el builder que cablea nodos y aristas por config de agente
- `agent/GraphEventPublisher.java` + `agent/graph/NodeStreamingChatHelper.java` — cómo los eventos de streaming escapan del grafo al stream SSE

### Cómo extender

**Agregando comportamiento de agente** — crea un nodo nuevo en `agent/graph/node/` o un dispatcher de arista nuevo en `agent/graph/edge/`. Cabléalo en `AgentGraphBuilder`. Lee y escribe estado a través de `MateClawStateAccessor`.

**No** crees una clase `XxxAgent` nueva. Estarías reimplementando lo que el grafo ya hace.

### Nodo de evaluación de objetivos (1.4.0+)

El grafo (tanto ReAct como Plan-Execute) ahora corre un `GoalEvaluationNode` después de que `FinalAnswerNode` ha transmitido la respuesta final: desde 1.5.0 juzga el checklist del objetivo criterio por criterio (modos bootstrap / verdict), trata el objetivo como completo **solo cuando todo criterio pasa**, y puede opcionalmente inyectar un mensaje de auto-followup apuntando a los criterios restantes para seguir empujando cualquier objetivo no cumplido.

### Otros cambios de runtime de 1.4.0

- **Divulgación progresiva de herramientas/skills** — una capa de divulgación de herramientas divide las herramientas en niveles core y extension; `enable_tool` / `load_skill` dejan que un empleado active herramientas extension / cargue skills a demanda, manteniendo el prompt de sistema pequeño.
- **Delegación de subagentes multinivel** — la delegación padre-a-hijo es recursiva y con tope de profundidad, formando un árbol; los eventos del grafo hijo se retransmiten de vuelta a la conversación raíz en tiempo real.
- **SPI ChannelToolProvider** — los canales (p. ej. Feishu) pueden exponer capacidades de plataforma directamente como herramientas de agente sin un servidor MCP separado.
- **RBAC de workspace** — las capacidades se resuelven desde un mapeo rol→capacidad del backend que controla tanto los endpoints REST como las rutas/menús del frontend.

### Claves de estado compartido

| Clave | Propósito |
|-----|---------|
| `USER_MESSAGE` | Entrada actual del usuario |
| `MESSAGES` | Mensajes de conversación cargados desde `mate_message` |
| `OBSERVATION_HISTORY` | Resultados de llamadas a herramientas en este turno |
| `CURRENT_ITERATION` | Cuántos bucles han ocurrido |
| `MAX_ITERATIONS` | El techo |
| `TOOL_CALLS` | Lista actual de llamadas a herramientas |
| `AWAITING_APPROVAL` | True cuando una llamada necesita aprobación humana |
| `FINAL_ANSWER` | La respuesta del agente |
| `FINISH_REASON` | Por qué terminó el grafo |

---

## Flujo de datos — un solo turno

```
1. POST /api/v1/chat?agentId={id}   (o POST /api/v1/chat/stream con agentId en el cuerpo)
        ↓
2. ChatController.sendMessage()
        ↓
3. ConversationManager.loadOrCreate(conversationId)
        ↓
4. AgentGraphBuilder.build(agentEntity)   ← resuelve el grafo compilado
        ↓
5. graph.invoke(initialState)              ← comienza la ejecución del StateGraph
        ↓
   ReasoningNode → Dispatcher → ActionNode → ObservationNode → (bucle o terminar)
        ↓
6. Las llamadas a herramientas pasan por:
   ToolRegistry.resolve() →
   evaluación de reglas de Tool Guard →
   (si se necesita aprobación) fila mate_tool_approval + evento SSE + AWAITING_APPROVAL=true
   (si se aprueba en línea) ToolExecutionExecutor.execute() → observación
        ↓
7. Los segmentos fluyen al cliente vía:
   GraphEventPublisher → NodeStreamingChatHelper → stream SSE
        ↓
8. Al completar:
   FinalAnswerNode agrega el resultado
   ConversationManager persiste los segmentos en mate_message
   Se publica ConversationCompletedEvent (arranca la extracción asíncrona de memoria)
        ↓
9. La respuesta se cierra
```

---

## Puntos de extensión

Estos son los SPIs y puntos de plugin sobre los que puedes construir:

### Spring beans anotados con `@Tool`

Escribe un `@Component` con métodos `@Tool`. Lo recoge `ToolRegistry` al arrancar. Todo método `@Tool` se vuelve una herramienta llamable.

```java
@Component
public class MyCustomTool {
    @Tool(description = "What the LLM sees")
    public String doThing(@ToolParam(description = "...") String input) {
        return "result";
    }
}
```

### SPI `ChannelAdapter`

Implementa `vip.mate.channel.ChannelAdapter` (o `StreamingChannelAdapter` para streaming). Regístralo como Spring bean. Agrega endpoints de webhook vía `ChannelWebhookController`. Ver [Canales](./channels).

```java
public interface ChannelAdapter {
    void onMessage(ChannelMessage message);
    void sendMessage(String channelId, String content);
    String getChannelType();
}
```

### SPI `MemoryProvider`

Implementa `vip.mate.memory.spi.MemoryProvider` para enchufar un backend de memoria personalizado (vectorial, de grafos, servicio externo). Múltiples proveedores pueden apilarse por agente. Ver [Memoria](./memory).

### Servidores MCP

Conecta servidores de herramientas externos sobre stdio, streamable_http o sse. Sus herramientas aparecen en el registry de herramientas automáticamente — el código del agente no sabe que son externos. Ver [MCP](./mcp).

### Paquetes de skills

Empaqueta instrucciones + herramientas + scripts opcionales en un `SKILL.md`. Súbelo vía la UI o la API. Los agentes pueden invocarlos en runtime. Ver [Skills](./skills).

### Nodos y aristas del grafo de agente

Para personalización más profunda, agrega un nodo nuevo en `agent/graph/node/` o un dispatcher nuevo en `agent/graph/edge/`. Cabléalo en `AgentGraphBuilder` detrás de una flag de config. El acceso al estado pasa por `MateClawStateAccessor`.

---

## Persistencia — un esquema, dos bases de datos

AuraClaw usa **MyBatis Plus** (no JPA) para el acceso a la base de datos. Convenciones:

- Todas las tablas con prefijo `mate_`
- Columnas `snake_case`, campos Java `camelCase`, auto-mapeados
- Toda tabla tiene `create_time`, `update_time`, `deleted` (borrado lógico)
- **Flyway** gestiona las migraciones de esquema — `db/migration/h2/` y `db/migration/mysql/` contienen scripts específicos de dialecto, auto-seleccionados al arrancar
- `FlywayRepairConfig` corre `repair()` antes de `migrate()` en cada arranque, auto-curando el desvío de checksums y las migraciones parcialmente fallidas
- Los datos semilla los carga `DatabaseBootstrapRunner` desde `db/data-*.sql`, idempotente

### Grupos de tablas

**Identidad y config** — `mate_user`, `mate_system_setting`, `mate_model_config`, `mate_model_provider`, `mate_datasource`, `mate_mcp_server`

**Agentes y planificación** — `mate_agent`, `mate_agent_skill`, `mate_agent_tool`, `mate_plan`, `mate_sub_plan`

**Conversación** — `mate_conversation`, `mate_message`, `mate_channel`, `mate_channel_session`

**Herramientas y aprobación** — `mate_tool`, `mate_tool_approval`, `mate_tool_guard_rule`, `mate_tool_guard_config`, `mate_tool_guard_audit_log`

**Skills y workspace** — `mate_skill`, `mate_workspace`, `mate_workspace_member`, `mate_workspace_file`

**Conocimiento y memoria** — `mate_wiki_knowledge_base`, `mate_wiki_raw_material`, `mate_wiki_page`, `mate_wiki_transformation`, `mate_wiki_transformation_run` (1.3.0+), `mate_memory_recall`

**Workflow y triggers (1.3.0+)** — `mate_workflow`, `mate_workflow_revision`, `mate_workflow_run`, `mate_workflow_step_run`, `mate_workflow_payload`, `mate_trigger`, `mate_trigger_event`

**Ops** — `mate_cron_job`, `mate_cron_job_run`, `mate_async_task`, `mate_usage_daily`, `mate_audit_event`, `mate_doctor_check`

---

## Streaming — por qué SSE, no WebFlux

AuraClaw usa **Spring MVC**, no Spring WebFlux. WebFlux está explícitamente excluido del grafo de dependencias.

Por qué: Spring MVC + SSE es suficiente para transmitir respuestas LLM al frontend. Es más simple de razonar, más fácil de depurar, y no fuerza a todo el stack a volverse reactivo.

::: tip Virtual threads (JDK 21)
`spring.threads.virtual.enabled=true` está encendido. Los hilos de solicitud de Tomcat, las tareas `@Scheduled` y los métodos `@Async` corren todos en virtual threads. Las conexiones largas SSE ya no retienen hilos de plataforma — el conteo de conexiones concurrentes ya no está limitado por el tamaño del pool de hilos.
:::

Flujo de streaming:

1. El cliente hace `POST /api/v1/chat/stream` con `agentId` / `message` / `conversationId` en el cuerpo JSON y `Accept: text/event-stream` en los encabezados
2. El controller devuelve `SseEmitter`
3. El grafo del agente corre en un hilo worker; la ejecución de nodos emite eventos a `GraphEventPublisher`
4. Los eventos se serializan en formato SSE y se escriben al emitter
5. `ChatStreamTracker` vigila los streams abandonados y los limpia

El mismo patrón SSE lo reutilizan los adaptadores de canal que soportan streaming (DingTalk AI Card, Web).

---

## Arquitectura del frontend

**Vue 3 + TypeScript + Composition API + `<script setup>`** en todas partes. Piezas clave:

- **`src/views/`** — componentes de página
- **`src/stores/`** — stores Pinia, dirigidos por dominio (cada store posee su porción exclusivamente)
- **`src/composables/`** — helpers de Composition API (el streaming del chat vive aquí, no en un store global)
- **`src/api/`** — instancia Axios + definiciones de endpoints
- **`src/router/`** — Vue Router con guardas de auth y ocultamiento por rol
- **`src/i18n/`** — traducciones `zh-CN.ts` y `en-US.ts`
- **`src/assets/main.css`** — los tokens de diseño CSS `--mc-*` (fuente de verdad para el tematizado)

Ver [Consola de Administración](./console) para detalles por página y [Contribuir](./contributing) para convenciones del frontend.

---

## Tres superficies de entrega

Mismo JAR de backend, tres formas distintas de enviarlo:

1. **Web** — corre el JAR directamente, abre un navegador en `http://localhost:18088`. El frontend está embebido en el `static/` del JAR.
2. **Escritorio** — el shell Electron en `mateclaw-desktop/` embebe el JRE 21 y el JAR. Los usuarios nunca instalan Java. Auto-actualización vía electron-updater.
3. **Docker** — `docker-compose.yml` con MySQL. Despliegue de producción.

El widget webchat en `mateclaw-webchat/` es un cuarto camino — una UI de chat embebible que puedes soltar en cualquier sitio web. Habla con las mismas APIs del backend.

---

## Capas de solicitud

```
   Solicitud HTTP
        │
        ▼
   Filtro de Spring Security  ── validación JWT, renovación por ventana deslizante
        │
        ▼
   Filtro de Acceso por Rol  ── permisos de workspace
        │
        ▼
   Controller                ── @RestController
        │
        ▼
   Service                   ── lógica de negocio
        │
        ▼
   Mapper (MyBatis Plus)     ── SQL
        │
        ▼
   Base de datos (H2 / MySQL)
```

Cada capa tiene una única responsabilidad. Las preocupaciones transversales (logging de auditoría, métricas) se implementan como aspectos AOP o endpoints de Spring Boot Actuator.

::: tip Observabilidad de Spring AI
La Observación Micrometer integrada de Spring AI está habilitada — toda llamada al LLM registra automáticamente `gen_ai.client.operation` (latencia) y `gen_ai.client.token.usage` (tokens de entrada/salida). Míralas vía `/actuator/metrics/gen_ai.*`. El contenido del prompt nunca se filtra a los spans (`log-prompt=false`).
:::

---

## Siguiente

- [Introducción](./intro) — el "por qué" antes del "cómo"
- [Agentes](./agents) — inmersión en StateGraph
- [Contribuir](./contributing) — convenciones para agregar código
- [Referencia de API](./api) — la superficie REST que expone el backend
