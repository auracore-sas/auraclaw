# 09 · Referencias y glosario

> Enlaces, rutas locales y términos. Mantener actualizado: es el punto de entrada para cualquiera
> que retome la integración.

---

## 1. Documentación de Pi

| Recurso | Ubicación |
|---|---|
| Repo oficial | https://github.com/earendil-works/pi |
| Web / paquetes | https://pi.dev |
| Paquete npm | `@earendil-works/pi-coding-agent` |
| Paquetes core | `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-tui` |

**Documentación local** (instalación del equipo):

```
/home/pvalarezo/.nvm/versions/node/v26.2.0/lib/node_modules/@earendil-works/pi-coding-agent/
├── README.md                 # modos, CLI, providers, extensiones
├── docs/
│   ├── sdk.md                # createAgentSession, SessionManager, eventos
│   ├── rpc.md                # modo RPC (JSONL), comandos y eventos
│   ├── skills.md             # Agent Skills standard
│   ├── extensions.md         # extensiones TypeScript
│   ├── packages.md           # Pi Packages (npm/git)
│   ├── custom-provider.md    # proveedores/modelos custom
│   ├── models.md             # catálogo de modelos
│   ├── environment-variables.md
│   ├── sessions.md / session-format.md / compaction.md
│   └── ...
└── examples/
    ├── sdk/                  # 01-minimal … 13-session-runtime
    └── extensions/           # gondolin, subagent, plan-mode, permission-gate, …
```

---

## 2. Ecosistema y proyectos hermanos

| Proyecto | Repo | Uso en nuestra integración |
|---|---|---|
| `pi-chat` | https://github.com/earendil-works/pi-chat | Referencia de multiusuario por Telegram/Discord + Gondolin |
| `gondolin` | https://github.com/earendil-works/gondolin | **Sandbox candidato** (micro-VM) |
| `pi-web-ui` | https://github.com/xing-shuyin/pi-web-ui · https://pi.dev/packages/pi-web-ui | Referencia de UX; **no** entra en producción |
| `pi-mcp-extension` | https://pi.dev/packages/pi-mcp-extension | MCP para Pi (opcional) |
| `pi-mcp-adapter` | https://github.com/nicobailon/pi-mcp-adapter | MCP token-efficient (opcional) |
| Agent Skills | https://agentskills.io/specification | Estándar de las skills |

---

## 3. Documentos internos de AuraClaw relacionados

| Documento | Relación |
|---|---|
| `docs/CUSTOMIZATIONS.md` | Registro de cambios del fork (obligatorio) |
| `docs/CODE_MAP.md` | Módulos 1 (runtime), 2 (memoria/workspace), 3 (tools), 6 (seguridad), 7 (acp/plugin) |
| `docs/NEXT_SESSION.md` | Bitácora de sesiones |
| `docs/WIKI_MODEL_SETUP.md` | Uso de `usage_scope` para modelos dedicados |
| `AGENTS.md` | Protocolo de testing (§4bis) y gotcha de la BD H2 compartida (§4ter) |
| `docs/TELEGRAM_PER_MEMBER.md` | Canal Telegram por miembro |

---

## 4. Zonas de código propias

| Zona | Uso |
|---|---|
| `com.auracore.*` | Todo el código de la integración de Pi |
| `vip.mate.*` | Núcleo del upstream — **no ensuciar** |

Interfaces clave del upstream que usamos (rama `feature/upstream-v2.2.0`):

```
vip.mate.agent.runtime.contract.AgentRuntimeProvider
vip.mate.agent.runtime.contract.AgentRuntimeConnection
vip.mate.agent.runtime.contract.RuntimeSession
vip.mate.agent.runtime.contract.RuntimeEvent / RuntimeEventType / RuntimeCapabilities
vip.mate.agent.runtime.dsh.*            (implementación de referencia)
vip.mate.tool.*                          (registro de tools @Tool)
vip.mate.acp.*                           (precedente de agente externo)
vip.mate.tool.builtin.SendFileTool       (entrega de artefactos)
```

---

## 5. Glosario

| Término | Definición |
|---|---|
| **Pi** | Harness de agentes y toolkit (MIT) que integramos como motor |
| **Camino A** | Pi como `@Tool` (`pi_worker`) invocado por un agente de AuraClaw |
| **Camino B** | Pi como `AgentRuntimeProvider` (motor de un empleado digital) |
| **`pi_worker`** | Nombre de la tool del Camino A |
| **perfil** | Preset de tools/skills/red por caso de uso (`report`, `office`, `media`, `data`) |
| **artefacto** | Fichero producido por Pi y entregado al usuario (PDF, DOCX, MP4…) |
| **`out/`** | Única carpeta publicable de un job |
| **jobId** | Identificador de una ejecución de Pi (auditoría y limpieza) |
| **`usage_scope`** | Feature V900 que dedica modelos a propósitos internos (p. ej. `pi_worker`) |
| **Gondolin** | Sandbox micro-VM de Pi (aislamiento de ejecución, red y secretos) |
| **DSH** | DeepSeek Harness — runtime externo por JSON-RPC del upstream v2.2.0 |
| **`owner_key`** | Clave de multi-tenencia (usuario/dueño) de memoria y canales |
| **superficie caliente** | Ficheros del upstream con alto conflicto de merge (grafo, nodes, dispatchers) |

---

## 6. Licencias

| Componente | Licencia | Nota |
|---|---|---|
| Pi y hermanos (`pi-chat`, `pi-web-ui`, `gondolin`) | MIT | Permisiva; sin obligaciones de marca |
| AuraClaw / MateClaw | Apache-2.0 | Mantener avisos y registro de modificaciones |
| Skills y scripts propios | propiedad de Auracore SAS | Sin secretos embebidos |

---

## 7. Contactos y mantenimiento de esta carpeta

- **Responsable:** equipo Auracore SAS (programación agéntica).
- **Al cerrar cada fase:** actualizar `08` §Registro de avance, `CUSTOMIZATIONS.md` y `NEXT_SESSION.md`.
- **Al actualizar la versión de Pi:** revisar `02` (CLI/SDK pueden cambiar) y el pin de versión en `06`.

→ Volver al [índice](./README.md)
