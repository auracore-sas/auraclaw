---
title: Integración ACP — Enchufa Agentes de Codificación Externos en AuraClaw
description: AuraClaw actúa como host ACP. Delega prompts a Claude Code, Codex, OpenCode, Qwen Code o cualquier agente de Agent Client Protocol sobre stdio. Endpoints integrados, editor visual de env, tarjetas de skill auto-puenteadas, modelo de confianza, traducción de errores.
head:
  - - meta
    - name: keywords
      content: ACP,Agent Client Protocol,Claude Code,Codex,OpenCode,Qwen Code,agente externo,stdio JSON-RPC,integración de agentes de codificación
---

# ACP — Agent Client Protocol

**ACP es cómo AuraClaw le entrega un prompt a un agente que otro construyó.**

Agent Client Protocol es una especificación abierta para que los clientes de agentes hablen con servidores de agentes sobre JSON-RPC. AuraClaw actúa como el **host**: lanza un CLI externo (Claude Code, Codex, OpenCode, Qwen Code, …), corre el handshake `initialize` → `session/new` → `session/prompt` sobre stdio, transmite la respuesta de vuelta a la conversación y cierra el proceso.

Si MCP es "enchufa una herramienta", ACP es **"enchufa un agente completo"**. Desde dentro de un turno de AuraClaw, llamar a Claude Code se ve igual que llamar a cualquier herramienta integrada — tu agente solo pide `acp_claude-code_prompt` y lee la respuesta.

---

## ACP vs MCP de un vistazo

| | **MCP** | **ACP** |
|---|---|---|
| Qué conectas | Un servidor de herramientas | Un agente |
| Granularidad | Por herramienta (`tools/list`) | Por prompt (un solo tiro) |
| Transporte en AuraClaw | stdio / streamable_http / sse | stdio |
| Modelo de sesión | De larga vida, multi-llamada | Sin estado: lanzar → prompt → cerrar |
| Uso típico | Filesystem, búsqueda, API de datos personalizada | Delegar una tarea de codificación a Claude Code / Codex |
| Superficie en AuraClaw | Catálogo de herramientas | Catálogo de skills (auto-puenteado) + envoltorio de herramienta |

Puedes mezclar ambos en el mismo agente.

---

## Endpoints integrados

La migración Flyway que viene con AuraClaw siembra cuatro endpoints, todos **deshabilitados por defecto** — actívalos tras instalar el CLI correspondiente.

| Slug | Nombre visible | Comando | Notas |
|---|---|---|---|
| `claude-code` | Claude Code | `npx -y @zed-industries/claude-agent-acp` | Claude Code de Anthropic; lee `ANTHROPIC_API_KEY` |
| `codex` | OpenAI Codex CLI | `npx -y @zed-industries/codex-acp` | Agente de codificación de OpenAI; lee `OPENAI_API_KEY` |
| `opencode` | OpenCode | `opencode acp` | Agente multi-modelo; el binario debe estar en el `PATH` |
| `qwen-code` | Qwen Code | `qwen --acp` | Agente de codificación de Alibaba; lee `DASHSCOPE_API_KEY` |

Las filas integradas están protegidas contra escritura — puedes editar `args_json` / `env_json` / `description` / `trusted` / `enabled`, pero no puedes cambiar el slug, reemplazar el comando o borrar la fila. Para correr un agente no relacionado, **agrega un endpoint personalizado** en su lugar.

---

## Configura vía la consola de administración

`Ajustes → Endpoints ACP` es la superficie CRUD completa.

### Agregar o editar un endpoint

- **Slug** — identificador en minúsculas (p. ej. `claude-code`). Inmutable tras crear. Los skills referencian los endpoints por este slug.
- **Nombre visible** — etiqueta humana mostrada en la página de Skills.
- **Descripción** — notas del operador.
- **Comando** — el ejecutable (`npx`, `opencode`, …). Bloqueado en filas integradas.
- **Args (arreglo JSON)** — argumentos de CLI, p. ej. `["-y","@zed-industries/claude-agent-acp"]`.
- **Env (objeto JSON)** — variables de entorno extra fusionadas al proceso hijo. El editor visual enmascara los valores cuya clave coincide con `*API_KEY*`, `*TOKEN*`, `*SECRET*` o `*PASS*`.
- **Modo de parseo de herramientas** — `call_title` / `call_detail` / `update_detail`. Controla cómo los eventos de llamadas a herramientas upstream se renderizan en la transcripción transmitida.
- **Confiable** — en ON, AuraClaw auto-permite cualquier `session/request_permission` que el agente upstream pida. En OFF, toda solicitud de permiso se deniega (úsalo para contextos no interactivos).
- **Habilitado** — flag de compuerta. Los endpoints deshabilitados no se puentean al catálogo de skills.

### Probar la conexión

Haz clic en **Probar** para lanzar el proceso, correr `initialize` + `session/new` y desmontar. El panel de resultado muestra versión de protocolo, capacidades del agente, tiempo transcurrido y — ante fallo — una pista de error traducida (ver [Confianza y traducción de errores](#trust-error-translation)). El estado persiste en la fila como `last_status` / `last_tested_at` / `last_error`.

### Habilitar / deshabilitar / borrar

- **Toggle** — saca el endpoint del catálogo sin borrarlo.
- **Borrar** — solo disponible en filas personalizadas. Las filas integradas no pueden borrarse.

Cualquier cambio publica un `AcpEndpointChangedEvent` y el catálogo de skills se re-sincroniza de inmediato — sin reinicio necesario.

---

## REST API

Ruta base: `/api/v1/acp/endpoints`. Requiere JWT.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET`    | `/`              | Lista todos los endpoints |
| `GET`    | `/{id}`          | Trae uno |
| `POST`   | `/`              | Crea un endpoint personalizado |
| `PUT`    | `/{id}`          | Parchea campos (el `command` integrado está bloqueado) |
| `DELETE` | `/{id}`          | Borra un endpoint personalizado (los integrados se niegan) |
| `PUT`    | `/{id}/toggle?enabled=true\|false` | Habilita / deshabilita |
| `POST`   | `/{id}/test`     | Corre la prueba de conexión |

### Crear un endpoint personalizado

```bash
curl -X POST http://localhost:18088/api/v1/acp/endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "my-coder",
    "displayName": "My Custom Coder",
    "description": "Internal coding agent",
    "command": "npx",
    "argsJson": "[\"-y\",\"@my-org/my-acp-agent\"]",
    "envJson": "{\"MY_API_KEY\":\"sk-...\"}",
    "toolParseMode": "call_detail",
    "trusted": true,
    "enabled": true
  }'
```

### Probar un endpoint

```bash
curl -X POST http://localhost:18088/api/v1/acp/endpoints/9100002/test \
  -H "Authorization: Bearer <token>"
```

Forma de la respuesta:

```json
{
  "name": "claude-code",
  "command": "npx",
  "args": ["-y", "@zed-industries/claude-agent-acp"],
  "agentCapabilities": { "loadSession": false, "promptCapabilities": { "image": true } },
  "status": "OK",
  "elapsedMs": 1842
}
```

Ante fallo `status` es `ERROR` y `error` lleva la pista traducida.

---

## Cómo llegan los endpoints a tus agentes

Hay dos caminos:

### 1. Skill virtual auto-puenteado (cero config)

Por cada endpoint habilitado, AuraClaw registra una tarjeta de skill virtual y una herramienta envoltorio llamada `acp_<slug>_prompt`. La herramienta toma un único string `prompt` y devuelve la respuesta de texto acumulada del agente upstream. Cualquier agente puede llamarla igual que llama a una herramienta integrada — sin manifiesto de skill requerido.

```
Ajustes → Endpoints ACP (toggle on)
   ↓
AcpEndpointChangedEvent
   ↓
El catálogo de skills gana la tarjeta "Claude Code"
El registry de herramientas gana "acp_claude-code_prompt"
   ↓
El agente llama la herramienta → AcpDelegationService.prompt()
   ↓
lanzar → initialize → session/new → session/prompt
   ↓
acumular notificaciones agent-message-chunk
   ↓
devolver texto al turno del agente
```

### 2. Skills escritos a mano (control total)

Un manifiesto de skill puede declarar `type: acp` y fijarse a un endpoint. El skill obtiene su propia herramienta envoltorio (`acp_<endpoint>_<skill>_prompt`), puede inyectar un `systemPrefix` delante de cada prompt y puede sobrescribir `cwd` por sesión.

```yaml
# frontmatter del SKILL.md
type: acp
acp:
  endpoint: claude-code
  systemPrefix: |
    You are working inside the AuraClaw repo. Always run `mvn test` before reporting done.
  cwd: /workspaces/mateclaw
```

Así se envían las plantillas de skill `claude-code-helper` y `codex-helper`.

---

## Confianza y traducción de errores {#trust-error-translation}

### Flag de confianza

Los servidores ACP pueden pausar y pedir permiso al host (`session/request_permission`) antes de hacer algo sensible — escribir archivos, correr comandos de shell, etc. AuraClaw **no** le pregunta al usuario a mitad de stream; en su lugar, la flag `trusted` por endpoint decide:

- `trusted: true` — auto-permite la primera opción que el agente ofreció. Mejor para CLIs instalados que controlas.
- `trusted: false` — cancela toda solicitud de permiso. Úsalo para endpoints sandboxeados o no confiables; el agente upstream retrocederá con elegancia.

### Traducción de errores

Los errores upstream de los agentes de codificación son notoriamente crípticos. `AcpRuntimeSupport.translateAuthError()` reconoce patrones comunes de 401 / 403 / "Request not allowed" y los reescribe en algo accionable:

- Clave faltante → "Define `ANTHROPIC_API_KEY`" / `OPENAI_API_KEY` / `DASHSCOPE_API_KEY` / `GOOGLE_API_KEY`, elegida por endpoint.
- Secuestro del keychain OAuth de Claude Code → sugiere `claude logout` para limpiar un token OAuth obsoleto de `~/.claude/` que está sombreando tu variable de entorno.

Las pistas aparecen en el panel de prueba y en el mensaje de error transmitido que recibe tu agente.

### Timeouts y límites

- Handshake `initialize`: 15s
- `session/new`: 10s
- Round-trip completo de `session/prompt`: 5 min
- Tope de buffer de stdio: 50 MiB por llamada (configurable en la fila vía `stdio_buffer_limit_bytes`)

---

## Base de datos — `mate_acp_endpoint`

| Columna | Tipo | Default | Propósito |
|---|---|---|---|
| `id` | BIGINT | — | Clave primaria. Los integrados usan `9100001`–`9100004` |
| `name` | VARCHAR(64) | — | Slug único. Los skills referencian esto |
| `display_name` | VARCHAR(128) | NULL | Etiqueta |
| `description` | TEXT | NULL | Notas del operador |
| `command` | VARCHAR(256) | — | Comando del proceso |
| `args_json` | TEXT | NULL | Args de CLI (arreglo JSON) |
| `env_json` | TEXT | NULL | Overrides de env (objeto JSON) |
| `tool_parse_mode` | VARCHAR(32) | `call_title` | `call_title` / `call_detail` / `update_detail` |
| `builtin` | BOOLEAN | FALSE | Las filas integradas están protegidas contra escritura |
| `trusted` | BOOLEAN | TRUE | Auto-permite solicitudes de permiso |
| `enabled` | BOOLEAN | FALSE | Apagado hasta que optes por encenderlo |
| `stdio_buffer_limit_bytes` | BIGINT | 52428800 | Tope de 50 MiB en stdio acumulado |
| `last_status` | VARCHAR(32) | NULL | `OK` / `ERROR` |
| `last_tested_at` | DATETIME | NULL | Marca de tiempo de la última prueba |
| `last_error` | TEXT | NULL | Error de la última prueba |
| `workspace_id` | BIGINT | 1 | Workspace ligado |
| `create_time` / `update_time` | DATETIME | — | Marcas de tiempo |
| `deleted` | INT | 0 | Borrado lógico |

El esquema vive en `db/migration/{h2,mysql}/V68__add_acp_endpoints.sql`.

---

## Resolución de problemas

### "Command not found"

El `command` debe estar en el `PATH` del usuario que corre AuraClaw. Verifica con `which npx` (o `which opencode`, `which qwen`). En Docker, instala el CLI en la imagen. Como último recurso, pon `command` en la ruta absoluta completa.

### "Request not allowed" / 403 de Claude Code

Probablemente tienes un token OAuth cacheado en `~/.claude/` que está sobrescribiendo el `ANTHROPIC_API_KEY` que definiste en el editor de env. Corre `claude logout`, luego haz clic en **Probar** de nuevo. El panel de prueba te lo dirá cuando detecte este caso.

### Se cuelga en `session/new`

Normalmente significa que el CLI upstream está descargando dependencias en la primera corrida (`npx -y` hace esto). Pre-calienta corriendo el CLI una vez fuera de AuraClaw, o simplemente reintenta — las llamadas posteriores son rápidas.

### "Subprocess output exceeded buffer"

El agente emitió más de 50 MiB de stdio en una sola llamada. Sube `stdioBufferLimitBytes` en el endpoint, o divide el prompt en turnos más pequeños.

### La herramienta no aparece en la página de Skills

- Confirma `enabled: true`.
- Confirma que la prueba pase (`last_status: OK`).
- Abre la ligadura de herramientas del agente — las herramientas auto-puenteadas están disponibles para todo agente salvo exclusión explícita.

---

## Siguiente

- [Skills](./skills) — incluyendo skills escritos a mano de tipo ACP
- [Herramientas](./tools) — cómo la herramienta envoltorio se enchufa al registry
- [MCP](./mcp) — el protocolo hermano para servidores de herramientas
- [Seguridad y Aprobación](./security) — emparejando la flag de confianza con Tool Guard
