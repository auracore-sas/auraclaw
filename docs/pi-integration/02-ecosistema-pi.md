# 02 · Ecosistema Pi

> Qué es Pi **hoy**, qué piezas existen y cuáles nos importan. Capa de referencia: no describe
> nuestra integración (eso es `03`), sino el material con el que trabajamos.
>
> Fuente primaria: documentación local de Pi en
> `/home/pvalarezo/.nvm/.../node_modules/@earendil-works/pi-coding-agent/` y el repo
> [`earendil-works/pi`](https://github.com/earendil-works/pi).

---

## 1. Qué es Pi

Pi es un **harness de agentes de terminal** + **toolkit**, licencia **MIT**. No es un producto
multiusuario ni un SaaS: es un motor extensible. Su filosofía es explícita — *"adapta Pi a tus
flujos, no al revés"*.

Da al modelo cuatro herramientas base (`read`, `write`, `edit`, `bash`) y todo lo demás se añade vía
**extensiones, skills, prompt templates y paquetes**.

> **Implicación para AuraClaw:** Pi encaja como **ejecutor de capacidades**, no como capa de
> usuarios. Todo lo "empresarial" lo sigue aportando AuraClaw.

---

## 2. Los cuatro modos de ejecución

| Modo | Invocación | Uso para nosotros |
|---|---|---|
| Interactivo (TUI) | `pi` | Desarrollo manual / depuración |
| Print / JSON | `pi -p "…"` | **Integración simple** (Camino A, v1) |
| **RPC** | `pi --mode rpc` | **Integración robusta** (JSONL por stdin/stdout) |
| **SDK** | `createAgentSession()` | Embeber en un servicio propio |
| *(experimental)* Chord server/client | `PI_EXPERIMENTAL=1` | Vigilar; no usar aún |

---

## 3. CLI relevante

Flags que usaremos desde AuraClaw (proceso externo):

| Flag | Para qué |
|---|---|
| `--mode rpc` | Arranca el agente en modo RPC (protocolo JSONL) |
| `-p, --print` | Ejecución no interactiva de un prompt |
| `--provider <name>` / `--model <patrón>` | Forzar proveedor/modelo (`provider/id:thinking`) |
| `--session-dir <path>` | Aislar el historial por usuario/workspace |
| `--no-session` | Ejecución efímera (sin persistir sesión) |
| `--tools <lista>` | Restringir herramientas (p. ej. `read,bash` en modo lectura) |
| `--skill <path>` / `--no-skills` | Controlar qué skills carga |
| `-e, --extension <path>` | Cargar una extensión concreta |
| `--system-prompt` / `--append-system-prompt` | Inyectar contexto de empresa/política |
| `-a/--approve`, `-na/--no-approve` | Confiar o no en recursos locales del proyecto |

---

## 4. SDK (TypeScript)

Incluido en el paquete principal. Puntos clave:

```ts
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(), // o SessionManager.create(cwd)
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Genera un informe PDF con gráficas de ventas");
```

Conceptos:

| Concepto | Qué es |
|---|---|
| `createAgentSession()` | Factoría de una sesión de agente |
| `AgentSession` | Ciclo de vida, historial, modelo, eventos, compaction |
| `createAgentSessionRuntime()` / `AgentSessionRuntime` | Reemplazo de sesión (new/resume/fork/import) |
| `SessionManager` | Persistencia de sesión (fichero JSONL o memoria) |
| `session.prompt()/steer()/followUp()` | Envío y cola de mensajes |
| `session.subscribe()` | Eventos: `message_update`, `tool_execution_*`, `agent_start`… |
| `ResourceLoader` | Provee extensiones, skills, prompts, temas, context files |

---

## 5. Formas de extensión

| Mecanismo | Qué permite | Estándar |
|---|---|---|
| **Extensions** (TypeScript) | Herramientas, UI, hooks, proveedores custom | — |
| **Skills** (Markdown) | Capacidades cargadas *on-demand* con scripts de apoyo | [Agent Skills](https://agentskills.io/specification) |
| **Prompt templates** | Plantillas `/comando` con variables | — |
| **Pi Packages** | Empaquetar y compartir todo lo anterior vía npm/git (`pi install npm:…`) | — |
| **Themes** | Apariencia de la TUI | — |

**Para AuraClaw lo más relevante son las *Skills*:** un fichero `SKILL.md` + scripts que enseñan a Pi
un procedimiento concreto (p. ej. "informe ejecutivo con gráficas"). Se versionan como texto.

---

## 6. MCP en Pi

Pi **no trae MCP en el núcleo**; se añade por extensión. Extensiones conocidas:

- `pi-mcp-extension` — cliente MCP completo (stdio, streamable-http, sse), auto-descubrimiento.
- `pi-mcp-adapter` — adaptador token-efficient (evita inflar el contexto con decenas de tools).

> Nota: existen **dos** capas de MCP en juego y no hay que confundirlas — el MCP **de AuraClaw**
> (per-agent binding verificado con PowerFin) y el MCP **de Pi** (opcional, dentro del worker). Para
> el Camino A, lo normal es que Pi **no** necesite MCP propio: AuraClaw le pasa los datos ya resueltos.

---

## 7. Proyectos hermanos del ecosistema

| Proyecto | Qué es | ¿Nos sirve? |
|---|---|---|
| **`pi-chat`** | Puente **Discord + Telegram** a sesiones Pi en sandbox Gondolin, con memoria, skills y secretos por canal | Referencia / uso interno, **no** sustituye al canal Telegram de AuraClaw |
| **`pi-web-ui`** | UI web self-hosted (chat, terminal, git) — **single-user** | Solo como referencia de UX; **no** entra en producción |
| **`gondolin`** | Sandbox micro-VM (QEMU/krun) con control de red/secretos | **Candidato** para aislar la ejecución de Pi |
| **Chord** (experimental) | Arquitectura server/client con *facets* | Vigilar |
| **`@earendil-works/pi-ai`, `pi-agent-core`, `pi-tui`** | Paquetes core reutilizables por extensiones | — |

---

## 8. Proveedores y modelos

Pi soporta de forma nativa, entre otros: **DeepSeek, MiniMax, OpenAI**, Anthropic, Google Gemini,
Mistral, Groq, xAI, OpenRouter, Azure y cualquier API compatible con OpenAI. También `llama.cpp`.

> Esto encaja con nuestra política de coste: **solo pagamos API**. Pi no exige GPU.

---

## 9. Variables de entorno útiles

| Variable | Significado |
|---|---|
| `PI_CODING_AGENT_DIR` | Directorio de configuración (por defecto `~/.pi/agent`) |
| `PI_CODING_AGENT_SESSION_DIR` | Directorio de sesiones |
| `PI_OFFLINE` | Desactiva red de arranque (útil en producción/air-gapped) |
| `PI_TELEMETRY` | Activa/desactiva telemetría de instalación |
| `PI_SESSION_ID` / `PI_SESSION_FILE` | Metadatos que reciben los comandos de `bash` |

En un despliegue empresarial **fijaremos `PI_CODING_AGENT_DIR` y `PI_OFFLINE`** y controlaremos la
telemetría por política.

---

## 10. Licencia y gobernanza

- **MIT** en Pi y en `pi-chat`, `pi-web-ui`, `gondolin`.
- Riesgo de dependencia: son proyectos **jóvenes y en evolución** (Gondolin y Chord están marcados
  como experimentales). Por eso **no los usamos como plataforma**, sino como ejecutor aislado y
  reemplazable.

---

## 11. Implicaciones directas para AuraClaw

1. La integración será **proceso externo** (CLI/RPC), no una librería embebida en la JVM.
2. Necesitamos un **contrato de artefactos** claro (qué ficheros produce Pi y en qué carpeta).
3. El **aislamiento** (sandbox/red/secretos) hay que definirlo nosotros; Gondolin es un candidato.
4. La **versión de Pi se fija** (pin) y se trata como dependencia: sin auto-update en producción.
5. La **memoria** sigue siendo de AuraClaw; Pi es *stateless* por defecto (`--no-session` o
   `--session-dir` efímero).

→ Siguiente: [`03-arquitectura-de-integracion.md`](./03-arquitectura-de-integracion.md)
