---
title: Integración MCP — Extensión de Herramientas con Model Context Protocol
description: AuraClaw actúa como cliente MCP, conectándose a cualquier servidor de herramientas externo vía Model Context Protocol. Descubrimiento dinámico JSON-RPC, doble transporte SSE/stdio, unificación sin fisuras con las herramientas integradas.
head:
  - - meta
    - name: keywords
      content: MCP,Model Context Protocol,cliente MCP,protocolo de herramientas,JSON-RPC,extensión de herramientas IA,Anthropic MCP
---

# MCP — Model Context Protocol

**MCP es cómo AuraClaw habla con herramientas que otro construyó.**

Model Context Protocol es un estándar abierto de Anthropic para conectar modelos de IA a herramientas y datos externos. Un servidor MCP es un proceso — local o remoto — que anuncia un conjunto de herramientas sobre JSON-RPC. AuraClaw actúa como un cliente MCP *client*: se conecta, descubre herramientas vía `tools/list` y las expone a tus agentes como si fueran nativas. **Desde el punto de vista del agente, no hay diferencia entre un Spring bean `@Tool` integrado y una herramienta que viene de un servidor MCP.**

Esta es la escotilla de escape. Si necesitas una capacidad que AuraClaw no trae — acceso a filesystem para un directorio sandboxeado, búsqueda Tavily, un servicio de datos interno personalizado, una suite de automatización de navegador — probablemente ya existe un servidor MCP para eso, y puedes enchufarlo sin escribir una línea de Java.

---

## Qué es MCP realmente

```
┌───────────────────────┐              ┌───────────────────────┐
│     AuraClaw           │              │     Servidor MCP      │
│     (Cliente MCP)      │              │     (Proveedor de     │
│                       │   JSON-RPC   │      herramientas)    │
│  Motor de Agentes ────┼──────────────┼──► Herramienta A      │
│                       │              │    Herramienta B      │
│  Registry de Tools ◄──┼──────────────┼─── Descubrimiento     │
│                       │              │    (tools/list)       │
└───────────────────────┘              └───────────────────────┘
```

Conceptos centrales:

- **Cliente MCP** — AuraClaw, conectándose a servidores, descubriendo herramientas, reenviando invocaciones
- **Servidor MCP** — un proceso de terceros que declara sus herramientas disponibles y ejecuta llamadas
- **Descubrimiento de herramientas** — el cliente envía `tools/list` para recuperar toda herramienta y su esquema de parámetros
- **Invocación de herramientas** — cuando el agente decide llamar a una herramienta, el cliente reenvía la solicitud al servidor MCP correcto

Las nuevas capacidades de herramientas quedan disponibles para los agentes **sin modificar código ni reiniciar el servicio**.

---

## Tipos de transporte

Tres transportes para distintos escenarios de despliegue:

### stdio (Standard I/O)

AuraClaw lanza un proceso hijo local e intercambia mensajes JSON-RPC vía stdin/stdout.

```
AuraClaw  ── stdin ──►  Subproceso del servidor MCP
          ◄─ stdout ──
```

**Casos de uso:** paquetes MCP locales de Node.js/Python (p. ej., `@anthropic/mcp-filesystem`), envoltorios de herramientas de línea de comandos, desarrollo.  
**Ventajas:** sin configuración de red, funciona de inmediato, aislamiento de procesos.  
**Limitaciones:** solo local.

### streamable_http (HTTP transmitible)

HTTP POST estándar para JSON-RPC, con respuestas transmitidas de vuelta por HTTP. **Recomendado para producción.**

```
AuraClaw  ── HTTP POST ──►  Servidor MCP remoto
          ◄─ Stream HTTP ──
```

**Casos de uso:** servidores MCP desplegados en cloud, despliegues detrás de balanceadores de carga.  
**Ventajas:** HTTP estándar, amigable con CDN/firewall, encabezados de auth.

### sse (Server-Sent Events)

Transporte HTTP anterior usando SSE para el push servidor-a-cliente. Compatibilidad legacy; los proyectos nuevos deberían preferir `streamable_http`.

### Comparación de transportes

| Característica | stdio | streamable_http | sse |
|---------|-------|-----------------|-----|
| Despliegue | Solo local | Local o remoto | Local o remoto |
| Requisito de red | Ninguno | HTTP alcanzable | HTTP alcanzable |
| Autenticación | Variables de entorno | Encabezados HTTP | Encabezados HTTP |
| Gestión de procesos | AuraClaw gestiona el subproceso | Externo | Externo |
| Recomendación | Herramientas locales | Servicios remotos | Compatibilidad legacy |

---

## Configuración vía UI

`Herramientas → Servidores MCP → Agregar Servidor MCP`. Llena:

- **Nombre** — identificador único (letras, números, `_`, `-`, `.`, espacios; 1–128 caracteres)
- **Descripción** — opcional
- **Tipo de transporte** — `stdio`, `streamable_http` o `sse`
- **Comando** (stdio) — `npx`, `node`, `python`, etc.
- **Argumentos** (stdio) — arreglo JSON (p. ej., `["-y", "@anthropic/mcp-filesystem", "/path"]`)
- **Directorio de trabajo** (stdio) — opcional
- **Variables de entorno** (stdio) — objeto JSON; soporta referencias `${ENV_VAR}`
- **URL** (streamable_http/sse) — endpoint del servidor
- **Encabezados HTTP** (streamable_http/sse) — objeto JSON (p. ej., `{"Authorization": "Bearer token"}`)
- **Timeout de conexión** — default 30s
- **Timeout de lectura** — default **60s** (subido de 30s en 1.5.0, #247; un round-trip de callTool que legítimamente corre más tiempo ya no se corta. Cada servidor es ajustable 5–300s)

Guarda. Si está habilitado, AuraClaw auto-intenta conectarse y descubrir herramientas.

### Probar, habilitar, estado

- **Probar Conexión** — envía `tools/list`, devuelve resultado, latencia, lista de herramientas
- **Toggle Habilitar/Deshabilitar** — suelta la conexión sin borrar la config
- **Estado** — `connected` / `disconnected` / `error` con detalle del error

---

## Configuración vía REST API

CRUD completo en `/api/v1/mcp/servers`.

### Listar todos

```bash
curl -s http://localhost:18088/api/v1/mcp/servers \
  -H "Authorization: Bearer <token>" | jq
```

La respuesta incluye `headersJson` y `envJson` automáticamente **saneados** (`sk-****abcd`).

### Crear — stdio

```bash
curl -X POST http://localhost:18088/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "filesystem",
    "transport": "stdio",
    "command": "npx",
    "argsJson": "[\"-y\", \"@anthropic/mcp-filesystem\", \"/home/user/workspace\"]",
    "enabled": true
  }'
```

### Crear — streamable_http

```bash
curl -X POST http://localhost:18088/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "remote-tools",
    "transport": "streamable_http",
    "url": "https://mcp.example.com/mcp",
    "headersJson": "{\"Authorization\": \"Bearer your-api-key\"}",
    "connectTimeoutSeconds": 15,
    "readTimeoutSeconds": 60,
    "enabled": true
  }'
```

### Actualizar (semántica PATCH)

```bash
curl -X PUT http://localhost:18088/api/v1/mcp/servers/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"description": "Actualizado", "readTimeoutSeconds": 60}'
```

Tras actualizar, los servidores habilitados se reconectan automáticamente.

### Borrar / Alternar / Probar / Refrescar

```bash
curl -X DELETE http://localhost:18088/api/v1/mcp/servers/{id} \
  -H "Authorization: Bearer <token>"

curl -X PUT "http://localhost:18088/api/v1/mcp/servers/{id}/toggle?enabled=false" \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:18088/api/v1/mcp/servers/{id}/test \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:18088/api/v1/mcp/servers/refresh \
  -H "Authorization: Bearer <token>"
```

**Los servidores integrados** (`builtin=true`) no pueden borrarse.

---

## Ejemplos prácticos

### Ejemplo 1 — Filesystem MCP (stdio)

```bash
curl -X POST http://localhost:18088/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "filesystem",
    "description": "Acceso a filesystem (restringido al directorio especificado)",
    "transport": "stdio",
    "command": "npx",
    "argsJson": "[\"-y\", \"@anthropic/mcp-filesystem\", \"/home/user/workspace\"]",
    "enabled": true
  }'
```

Herramientas descubiertas: `read_file`, `write_file`, `list_directory`, `search_files`, `get_file_info`.

Seguridad: `@anthropic/mcp-filesystem` solo permite acceso al directorio especificado y sus subdirectorios.

### Ejemplo 2 — HTTP remoto con auth

```bash
curl -X POST http://localhost:18088/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "internal-data-service",
    "transport": "streamable_http",
    "url": "https://mcp-api.internal.example.com/mcp",
    "headersJson": "{\"Authorization\": \"Bearer sk-your-api-key\", \"X-Team-Id\": \"engineering\"}",
    "connectTimeoutSeconds": 10,
    "readTimeoutSeconds": 120,
    "enabled": true
  }'
```

**Los valores de encabezados soportan referencias a variables de entorno**: `{"Authorization": "Bearer ${MCP_API_KEY}"}` se reemplaza en runtime, **los secretos no aterrizan en la base de datos**.

### Ejemplo 3 — Búsqueda Tavily (stdio + variables de entorno)

```bash
curl -X POST http://localhost:18088/api/v1/mcp/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "tavily-search",
    "transport": "stdio",
    "command": "npx",
    "argsJson": "[\"-y\", \"@anthropic/mcp-tavily\"]",
    "envJson": "{\"TAVILY_API_KEY\": \"${TAVILY_API_KEY}\"}",
    "enabled": true
  }'
```

---

## Cómo las herramientas MCP quedan disponibles para los agentes

```
Arranque de la aplicación
   │
   ▼
Iterar sobre servidores MCP habilitados
   │
   ▼
Conectar por transporte → inicializar → listar herramientas → cachear
   │
   ▼
Registry de herramientas (agrega herramientas integradas + herramientas MCP)
   │
   ▼
Conjunto de herramientas del agente
```

**Clave:** el agente obtiene la lista de herramientas activas **más reciente** en cada invocación, así agregar o quitar servidores MCP surte efecto **sin reiniciar**. Desde la perspectiva del agente, **las herramientas MCP y las integradas son idénticas** — sin diferencia.

---

## Ligadura de herramientas por agente

::: tip Nuevo en 1.3.0
Antes de v1.2.0, todos los empleados podían llamar a toda herramienta MCP por defecto — era un interruptor global. v1.3.0 hace la ligadura **por empleado**, y agrega detección de estado sucio más manejo de colisiones de namespace.
:::

### Tres problemas que resuelve

**Problema 1: Colisiones de namespace de herramientas.**
Dos servidores MCP exponen ambos `read_file` — ¿cuál gana? v1.3.0 internamente usa un **nombre de callback estable prefijado por servidor** (`{serverName}__{toolName}`) y lo persiste a `mate_mcp_server.tools_cache_json`. El selector los muestra como `serverA__read_file` y `serverB__read_file`; el prompt del agente los mapea de vuelta a los nombres originales para ahorrar tokens y evitar confusión del LLM.

**Problema 2: Renombrar el servidor/herramienta MCP rompe las ligaduras.**
En v1.2.0, renombrar un servidor huérfanaba a todo empleado ligado a él. v1.3.0 introduce una **caché persistente de herramientas**: cada listado exitoso de herramientas escribe los metadatos de herramientas a una columna JSON `tools_cache_json` en `mate_mcp_server`. Al validar ligaduras y el servidor está temporalmente inalcanzable, la caché se consulta como fallback — las ligaduras se mantienen marcadas `stale` y vuelven a estar vivas en el momento en que el servidor reconecta.

**Problema 3: Guardar aceptaba silenciosamente referencias a herramientas inexistentes.**
Un `nonexistent-server.weird-tool` con typo se guardaba bien y explotaba en runtime. v1.3.0 corre `AgentBindingService.validate(...)` al guardar:

| Estado | Significado | Comportamiento al guardar |
|---|---|---|
| `connected` | Servidor en línea, herramienta visible | ✅ Persistir normal |
| `stale` | Servidor temporalmente offline pero en caché | ✅ Persistir (marcado stale) |
| `unavailable` | Servidor deshabilitado | ✅ Persistir (marcado unavailable) |
| `orphan` | El servidor / herramienta ya no existe en absoluto | ❌ Rechazar el guardado, pedir al usuario limpiar |

### Dónde ver el estado de las herramientas

`Agentes → elige empleado → Herramientas` — ver [Ligadura de herramientas del agente](./agents#tool-binding-per-agent-tool-picker).

### Contrato de datos

- `mate_mcp_server.tools_cache_json` (columna nueva en v1.3.0): arreglo JSON, cada elemento `{name, description, inputSchema, lastSeenAt}`
- `mate_agent_tool.tool_name`: almacena el **nombre de callback prefijado** `{serverName}__{toolName}` en lugar del nombre crudo, así un renombrado de servidor aparece de inmediato como un join miss observable
- `AgentBindingService.getEffectiveToolNames(agentId)` es la única fuente de verdad para el despacho de herramientas — corre cada turno, asegurando que la vista del editor y la vista del runtime siempre coincidan

### Reglas del lado del servidor

- Los servidores MCP puenteados vía ACP **no pueden editarse** desde la lista de servidores MCP (son propiedad del ciclo de vida del propio servidor ACP)
- Una herramienta marcada `unavailable` **no se lista** en el prompt de sistema del agente — el LLM no la buscará, pero la fila de ligadura se preserva
- Las herramientas `returnDirect=true` (cuya salida reemplaza el turno del asistente) pasan por la misma ACL — **no evaden** la ligadura

---

## Gestión de conexiones

### Conexión automática al arrancar

Todos los servidores MCP con `enabled=true` se conectan automáticamente cuando la app arranca. El fallo de un solo servidor no bloquea a los otros servidores ni el arranque de la aplicación.

### Seguridad de hilos

El mapa de clientes activos es concurrente, con un lock independiente por servidor.

### Reemplazo de conexión

Estrategia **"conectar nuevo, luego desconectar viejo"**: construir un cliente nuevo, inicializarlo, intercambiarlo en el pool, cerrar el viejo. Si el cliente nuevo falla, el viejo permanece.

### Limpieza de subprocesos

Para servidores stdio, la limpieza ocurre en: deshabilitar/borrar, reemplazo de config, apagado de la aplicación (`@PreDestroy`), fallo de conexión.

### Monitoreo de estado

Tras cada operación de conexión, los resultados persisten:

- `last_status` — `connected` / `disconnected` / `error`
- `last_error` — mensaje de error
- `last_connected_time` — marca de tiempo del último éxito
- `tool_count` — herramientas actualmente descubiertas

### Refresco manual

`POST /api/v1/mcp/servers/refresh` suelta todas las conexiones existentes y reconecta todo servidor habilitado. Útil para resolver problemas.

---

## Almacenamiento en base de datos — `mate_mcp_server`

| Columna | Tipo | Default | Propósito |
|--------|------|---------|---------|
| `id` | BIGINT | — | Clave primaria |
| `name` | VARCHAR(128) | — | Identificador único |
| `description` | TEXT | NULL | Descripción del servidor |
| `transport` | VARCHAR(32) | `stdio` | `stdio` / `streamable_http` / `sse` |
| `url` | VARCHAR(512) | NULL | URL remota |
| `headers_json` | TEXT | NULL | JSON de encabezados HTTP |
| `command` | VARCHAR(512) | NULL | Comando de arranque |
| `args_json` | TEXT | NULL | Arreglo JSON de argumentos de comando |
| `env_json` | TEXT | NULL | JSON de variables de entorno; soporta `${VAR}` |
| `cwd` | VARCHAR(512) | NULL | Directorio de trabajo |
| `enabled` | BOOLEAN | TRUE | Encendido/apagado |
| `connect_timeout_seconds` | INT | 30 | Timeout de conexión HTTP |
| `read_timeout_seconds` | INT | 60 | Timeout de respuesta de solicitud (default 60 desde 1.5.0, antes 30) |
| `last_status` | VARCHAR(32) | `disconnected` | Último estado de conexión |
| `last_error` | TEXT | NULL | Último mensaje de error |
| `last_connected_time` | DATETIME | NULL | Última conexión exitosa |
| `tool_count` | INT | 0 | Conteo de herramientas descubiertas |
| `builtin` | BOOLEAN | FALSE | Si es un servidor integrado |
| `create_time` / `update_time` | DATETIME | — | Marcas de tiempo |
| `deleted` | INT | 0 | Borrado lógico |

### Saneamiento de datos sensibles

Los valores de `headers_json` y `env_json` se enmascaran automáticamente en las respuestas de API. `args_json` se devuelve tal cual.

### Referencias a variables de entorno

- `${VAR_NAME}` — coincidencia y reemplazo exactos
- `$VAR_NAME` — coincidencia por regex

Mantiene los secretos fuera de la base de datos.

---

## Reenviando la identidad del usuario a un servidor MCP (on-behalf-of)

Un servidor MCP STDIO es **un subproceso compartido por configuración**, usado por todo usuario; su entorno es fijo al lanzarse y STDIO no tiene un canal de encabezados por solicitud como HTTP. Así que la identidad por usuario **no puede viajar vía env** — debe ir en banda con cada llamada a herramienta.

AuraClaw puede inyectar el **nombre de usuario autenticado** en cada llamada a herramienta de un servidor elegido, para que el servidor pueda llamar a su backend REST downstream en nombre de ese usuario.

### Habilitar (opt-in, por servidor)

Apagado por defecto — inyectar en todo servidor filtraría el nombre de usuario a cualquier servidor MCP de terceros. Habilita por servidor **por nombre o id**:

```yaml
mateclaw:
  mcp:
    identity-forward:
      servers:
        - my-internal-api      # nombre del servidor en mate_mcp_server
        - 1000000042           # o el id numérico del servidor
```

### Contrato de datos

Cuando está habilitado, AuraClaw inyecta el argumento reservado **`__mateclaw_user__`** (valor = nombre de usuario autenticado) en los argumentos JSON de cada llamada a herramienta. Lo inyecta código confiable del servidor, **nunca el LLM** — cualquier valor del mismo clave suministrado por el modelo se sobrescribe, así el modelo no puede suplantar identidad. Cuando no hay usuario autenticado, no se inyecta nada (la identidad nunca se fabrica).

El servidor MCP lee y quita la clave, luego llama a REST con ella más su propia clave API de backend (p. ej. un encabezado `X-On-Behalf-Of`):

```python
# Ejemplo FastMCP: servidor MCP como script CLI de Python (STDIO)
import os, httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-internal-api")
REST_BASE = os.environ["REST_BASE"]
API_KEY = os.environ["BACKEND_API_KEY"]      # clave a nivel de servicio (autentica el servicio MCP)

@mcp.tool()
def query_orders(keyword: str, __mateclaw_user__: str | None = None) -> str:
    if not __mateclaw_user__:
        raise ValueError("identidad inyectada faltante")   # rechaza llamadas sin identidad
    headers = {
        "Authorization": f"ApiKey {API_KEY}",            # identidad del servicio
        "X-On-Behalf-Of": __mateclaw_user__,             # el usuario actuante
    }
    r = httpx.get(f"{REST_BASE}/orders", params={"q": keyword}, headers=headers, timeout=30)
    r.raise_for_status()
    return r.text

if __name__ == "__main__":
    mcp.run()   # STDIO
```

> Si el esquema de entrada de una herramienta es `additionalProperties: false`, declara `__mateclaw_user__` como parámetro opcional (como arriba) o la validación estricta lo rechazará.

### Dos modelos de confianza

**① Texto plano (default)**: inyecta el nombre de usuario en texto plano. Encaja en una red confiable donde el backend autentica al servicio MCP por clave API y trata al usuario reenviado como on-behalf-of. El backend confía en la cadena cruda.

**② Token firmado (recomendado a través de un límite de confianza)**: inyecta un **JWT RS256 de corta vida** que AuraClaw firma con una clave privada (la clave reservada pasa a ser **`__mateclaw_token__`**); el backend REST **lo verifica con la clave pública**, así confía en la firma — no en el servicio MCP, el script de Python o el transporte.

```yaml
mateclaw:
  mcp:
    identity-forward:
      servers:
        - my-internal-api
      token:
        enabled: true
        issuer: mateclaw
        ttl-seconds: 60                 # corto, decenas de segundos
        key-id: mateclaw-mcp-1
        private-key-pem: ${MCP_IDFWD_PRIVATE_KEY_PEM:}   # PEM PKCS#8 (clave privada RS256)
        audiences:                      # opcional; aud por defecto = nombre del servidor
          my-internal-api: https://api.internal
```

Genera el par de claves (privada → AuraClaw, pública → backend REST):

```bash
openssl genpkey -algorithm RSA -pkcs8 -out mcp-idfwd-private.pem
openssl pkey -in mcp-idfwd-private.pem -pubout -out mcp-idfwd-public.pem
# private-key-pem toma el cuerpo de la clave privada (encabezados PEM opcionales; se quitan al parsear)
```

Claims del token: `iss`, `sub`=usuario, `aud`=este servidor, `iat`, `exp` (corto), `jti`. `aud` + `exp` corto acotan el replay a decenas de segundos y a un backend. **Cuando el modo token está encendido pero no hay clave configurada, falla cerrado** (sin token acuñado, nada inyectado — el backend rechaza) en lugar de degradar silenciosamente a texto plano.

> `sub` lleva el identificador de usuario de AuraClaw (`ChatOrigin.requesterId`). Si tu backend autoriza sobre un id numérico inmutable, resuelve usuario→id antes de acuñar (mantenido desacoplado del almacén de usuarios aquí).

El servidor MCP (Python) solo reenvía — no verifica:

```python
@mcp.tool()
def query_orders(keyword: str, __mateclaw_token__: str | None = None) -> str:
    if not __mateclaw_token__:
        raise ValueError("token de identidad faltante")
    headers = {"Authorization": f"Bearer {__mateclaw_token__}"}   # reenvía a REST
    return httpx.get(f"{REST_BASE}/orders", params={"q": keyword}, headers=headers, timeout=30).text
```

El backend REST verifica (pseudocódigo):

```python
import jwt  # PyJWT
claims = jwt.decode(token, public_key_pem, algorithms=["RS256"],
                    issuer="mateclaw", audience="https://api.internal")
user = claims["sub"]            # confiable solo tras la verificación de firma
# → autorización por usuario; inválido/expirado → 401
```

> Distribución de clave pública: por ahora un operador configura la clave pública en el lado REST fuera de banda. Un endpoint JWKS para auto-distribución + rotación es un seguimiento natural.
>
> Relación con la clave API: puedes mantener la clave API como auth de servicio/canal ("este servicio MCP puede hablar con el backend") más el JWT como la aserción de usuario — dos capas limpias — o dejar que el JWT cargue ambas.

---

## Resolución de problemas

### "Command not found" (stdio)

1. Confirma que el comando esté en el PATH del usuario que corre AuraClaw
2. Verifica: `which npx` o `npx --version`
3. Docker: confirma que el comando esté instalado en el contenedor
4. Usa ruta completa: `/usr/local/bin/npx`

### Timeout de conexión

1. HTTP/SSE: confirma que la URL sea alcanzable (`curl -v <url>`)
2. Revisa las reglas de firewall
3. Sube `connectTimeoutSeconds` / `readTimeoutSeconds`
4. stdio: la primera corrida de `npx -y` puede necesitar descargar paquetes

### Errores SSL/TLS

1. Confirma que el certificado SSL remoto sea válido y no esté expirado
2. Auto-firmado: agrega el certificado CA al trust store de la JVM
3. Confirma que el JDK soporte la versión TLS requerida

### Herramientas que no aparecen

1. Chequea `tool_count > 0`
2. Usa probar conexión, confirma que `discoveredTools` no esté vacío
3. Verifica que el servidor MCP implemente `tools/list`
4. Revisa los logs del backend para la salida de descubrimiento de herramientas MCP

### Fallos de invocación de herramientas

1. Revisa los logs del backend para errores específicos
2. Confirma que el proceso del servidor MCP esté corriendo (stdio)
3. Confirma que el servidor remoto sea alcanzable (HTTP/SSE)
4. Chequea que `readTimeoutSeconds` sea suficiente
5. Prueba refrescar conexiones

### Subprocesos huérfanos (stdio)

Los subprocesos se limpian en el apagado normal. Si AuraClaw fue matado a la fuerza (`kill -9`), los subprocesos pueden quedar. `ps aux | grep mcp` y termínalos.

---

## Siguiente

- [Herramientas](./tools) — cómo se relacionan las herramientas MCP con las integradas
- [Skills](./skills) — skills respaldados por MCP
- [Configuración](./config) — referencia completa de configuración
