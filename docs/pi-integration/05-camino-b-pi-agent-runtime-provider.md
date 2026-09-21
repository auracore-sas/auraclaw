# 05 · Camino B — `PiAgentRuntimeProvider`

> Especificación del camino ambicioso: hacer que un "empleado digital" de AuraClaw **corra sobre el
> motor de Pi**, conservando sesión, políticas, tools, aprobaciones y UI de AuraClaw.
>
> Estado: 📐 Diseño · **Bloqueado por el merge de upstream v2.2.0** (rama `feature/upstream-v2.2.0`).
> Solo se acomete si el Camino A demuestra valor y queremos el motor completo.

---

## 1. Prerrequisito

El contrato `AgentRuntimeProvider` **no existe en nuestra base v2.1.0**. Llega con upstream **v2.2.0**
y está presente en la rama `feature/upstream-v2.2.0`:

```
vip/mate/agent/runtime/
├── contract/
│   ├── AgentRuntimeProvider.java        ← interfaz a implementar
│   ├── AgentRuntimeConnection.java      ← Flux<RuntimeEvent> prompt / cancel / contextUsage
│   ├── AgentRuntimeCoordinator.java
│   ├── RuntimeProviderRegistry.java     ← auto-registro por Spring (List<AgentRuntimeProvider>)
│   ├── RuntimeSession.java              ← record de sesión
│   ├── RuntimeEvent.java                ← evento normalizado
│   ├── RuntimeEventType.java            ← enum de tipos
│   ├── RuntimeCapabilities.java
│   ├── RuntimeContextUsage.java
│   ├── RuntimeResult.java
│   ├── RuntimeSessionFactory.java
│   └── RuntimeValidation.java
├── dsh/                                 ← IMPLEMENTACIÓN DE REFERENCIA (DeepSeek Harness)
│   ├── DshRuntimeService.java
│   ├── DshBridgeConnection.java
│   ├── DshBridgeProtocol.java / Methods / Message / Events / Requests
│   ├── DshBridgeAuthenticator.java
│   └── management/ (config resolver + service)  ← patrón de gestión a imitar
├── RuntimeProviderConfiguration.java    ← registro Spring
├── RuntimeEventProjector.java / RuntimeEventStreamAdapter.java
└── RunningConversationRegistry.java / ConversationTurnGate.java
```

Migración de BD asociada: `db/migration/**/V186__agent_runtime_provider.sql`.

**Antes de empezar:** merge de `v2.2.0` a `main` (procedimiento en `CUSTOMIZATIONS.md` §3), con
rerere activo y branding re-aplicado.

---

## 2. El contrato (tal cual está en la rama)

```java
public interface AgentRuntimeProvider {
    String type();                                  // "pi"
    RuntimeValidation validate(RuntimeSession s);   // ¿está Pi disponible y utilizable?
    RuntimeCapabilities capabilities();             // qué soporta
    AgentRuntimeConnection start(RuntimeSession s); // arranca una sesión
}
```

```java
public record RuntimeSession(
    String sessionId, String conversationId, Long agentId, Long workspaceId,
    String modelName, Path workingDirectory, Map<String,Object> configuration) {}
```

```java
public interface AgentRuntimeConnection extends AutoCloseable {
    Flux<RuntimeEvent> prompt(String message);      // streaming del turno
    Mono<Void> cancel();
    Mono<RuntimeContextUsage> contextUsage();
}
```

```java
public record RuntimeEvent(String sessionId, long sequence, RuntimeEventType type,
                           String text, Map<String,Object> data, boolean terminal) {}
// factorías: RuntimeEvent.of(...)  ·  RuntimeEvent.terminal(...)
```

```java
public enum RuntimeEventType {
    RUNTIME_READY, ASSISTANT_DELTA, THINKING_DELTA, TOOL_STARTED,
    TOOL_APPROVAL_REQUIRED, TOOL_FINISHED, SUBAGENT_STARTED, SUBAGENT_FINISHED,
    CONTEXT_USAGE, COMPLETED, FAILED, CANCELLED;
    public boolean terminal() { … }   // COMPLETED | FAILED | CANCELLED
}
```

```java
public record RuntimeCapabilities(boolean supportsCancellation, boolean supportsApprovals,
                                  boolean supportsSubagents, boolean supportsContextUsage) {}
```

**Registro:** implementar la interfaz como bean Spring; `RuntimeProviderRegistry(List<AgentRuntimeProvider>)`
lo recoge automáticamente. No hay que tocar el grafo ni el ensamblador.

---

## 3. Diseño propuesto

```
com.auracore.runtime.pi/
├── PiRuntimeProvider.java       implements AgentRuntimeProvider   (type() = "pi")
├── PiRuntimeService.java        gestión (enable/validate/test) — espejo de DshRuntimeService
├── PiProcessManager.java        ciclo de vida del proceso `pi --mode rpc`
├── PiRpcClient.java             protocolo JSONL (stdin/stdout) + correlación de ids
├── PiRpcEventMapper.java        eventos Pi → RuntimeEventType
├── PiRuntimeConnection.java     AgentRuntimeConnection (Flux de RuntimeEvent)
└── PiRuntimeProperties.java     configuración (binary, versión, sandbox, límites)
```

Se imita deliberadamente la estructura del paquete `dsh/` (que es la implementación de referencia
del propio upstream), para minimizar diferencias conceptuales y facilitar futuros merges.

---

## 4. Mapeo de eventos: Pi RPC → `RuntimeEventType`

| Evento de Pi (`--mode rpc`) | `RuntimeEventType` |
|---|---|
| arranque de sesión OK | `RUNTIME_READY` |
| `message_update` + `text_delta` | `ASSISTANT_DELTA` |
| `thinking_delta` | `THINKING_DELTA` |
| `tool_execution_start` | `TOOL_STARTED` |
| `tool_execution_end` | `TOOL_FINISHED` |
| gate de permiso de Pi / aprobación | `TOOL_APPROVAL_REQUIRED` |
| subagente (extensión) | `SUBAGENT_STARTED` / `SUBAGENT_FINISHED` |
| uso de contexto | `CONTEXT_USAGE` |
| fin normal | `COMPLETED` |
| error | `FAILED` |
| `abort` | `CANCELLED` |

`data` transporta metadatos (nombre de tool, ids, contadores) para que `RuntimeEventProjector`
los proyecte a la UI existente.

---

## 5. Ciclo de vida de una sesión

```
start(RuntimeSession)
  → validate(session)                 ¿binary existe? ¿versión coincide? ¿sandbox listo?
  → arranca proceso `pi --mode rpc --session-dir <dir efímero> --no-session?`
  → devuelve PiRuntimeConnection
prompt(msg)
  → escribe {"type":"prompt", ...} por stdin
  → Flux<RuntimeEvent> conforme llegan líneas por stdout
cancel()
  → {"type":"abort"} y, si no responde, mata el proceso y limpia
contextUsage()
  → consulta el uso reportado por Pi
close()
  → termina el proceso y borra la raíz de trabajo
```

**Propiedad de datos:** la sesión, el workspace, los ficheros y la memoria siguen siendo de AuraClaw.
Pi es un ejecutor **efímero** (`--no-session` o `--session-dir` temporal por conversación).

---

## 6. Capacidades que declararemos

```java
capabilities() = new RuntimeCapabilities(
    true,   // supportsCancellation  → Pi RPC tiene abort
    true,   // supportsApprovals     → vía permisos de Pi + gate de AuraClaw
    true,   // supportsSubagents     → extensión de subagentes de Pi
    true    // supportsContextUsage  → Pi reporta uso
);
```

> Declarar capacidades **honestamente**: si algo no está implementado y probado, poner `false`.
> El coordinador puede tomar decisiones a partir de esto.

---

## 7. Selección de runtime por agente

Igual que con DSH: un agente puede correr en el runtime **nativo** (StateGraph) o en **Pi**. La
selección se persiste por agente (migración `V186`). La identidad y la gobernanza del "empleado"
se mantienen aunque cambie el motor.

**Regla de producto sugerida:** Pi como runtime para "empleados" de trabajo pesado (informes, datos,
media); el runtime nativo para conversación y conocimiento.

---

## 8. Configuración

```yaml
auracore:
  pi:
    runtime:
      enabled: true
      binary: /usr/local/bin/pi
      version: "0.85.1"
      mode: rpc
      sandbox: gondolin
      session-mode: ephemeral        # ephemeral | per-conversation
      timeout-seconds: 900
      idle-timeout-seconds: 120
```

Debe seguir el patrón `management/` de DSH (resolver + servicio de config + validación + enable/disable
desde consola).

---

## 9. Consola de runtime

v2.2.0 ya trae `AgentRuntimeController` + `AgentRuntimeAggregator` y una consola de runtime
(ver/forzar reciclado). Pi debe aparecer ahí como un provider más, con su salud y su estado.
No hay que construir UI nueva si se integra en el agregador existente.

---

## 10. Trade-offs y riesgos

| Ventaja | Coste |
|---|---|
| Motor completo de Pi dentro de AuraClaw | Dependencia de un contrato joven (v2.2.0) |
| Un runtime común para nativo y Pi | Más piezas móviles (proceso, protocolo, sandbox) |
| Reutiliza toda la gobernanza existente | Curva de pruebas más alta que el Camino A |

| Riesgo | Mitigación |
|---|---|
| Cambios del contrato entre versiones | Pin de versión + tests de contrato |
| Proceso huérfano / fuga de recursos | `PiProcessManager` con watchdog e idle-timeout |
| Doble fuente de verdad de sesión | Pi efímero; AuraClaw es la única dueña |
| Deriva del upstream | Código en `com.auracore.*`; imitar `dsh/` para minimizar divergencia |

---

## 11. Criterios de aceptación (F3)

- [ ] `PiRuntimeProvider` se registra y aparece en la consola de runtime.
- [ ] `validate()` falla de forma clara si Pi no está o la versión no coincide.
- [ ] Un "empleado" configurado con runtime Pi completa un turno con streaming de texto y tools.
- [ ] Cancelación y uso de contexto funcionan y se reflejan en la UI.
- [ ] Aprobaciones de tools pasan por el gate de AuraClaw (`TOOL_APPROVAL_REQUIRED`).
- [ ] Cero procesos/ficheros huérfanos tras 24 h de operación.
- [ ] Todo en `com.auracore.*` y registrado en `CUSTOMIZATIONS.md`.

---

## 12. ¿Vale la pena el Camino B?

Solo si se cumplen **las dos**:

1. El Camino A está en producción y demuestra que Pi aporta valor real.
2. Queremos que *empleados completos* (no solo una tool) razonen con Pi, con streaming y cancelación
   en la UI.

Si no, **quedarse en el Camino A**. No construir B "por completitud".

→ Siguiente: [`06-seguridad-aislamiento-y-operacion.md`](./06-seguridad-aislamiento-y-operacion.md)
