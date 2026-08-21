# Seguridad y Aprobación

**Manos fuertes, límites firmes.**

AuraClaw les da a los agentes capacidades reales — acceso a shell, escrituras de archivos, automatización de navegador, delegación a otros agentes, herramientas remotas sobre MCP. Esa es la mitad de "manos fuertes". Esta página trata la otra mitad: los límites que evitan que las manos fuertes hagan estupideces.

- **Auth JWT** — quién eres
- **Tool Guard (basado en reglas)** — qué se le permite hacer a cada agente
- **Flujo de aprobación** — cuándo un humano necesita decidir antes de la ejecución
- **File Guard** — cómo se ve el filesystem para un agente
- **Aislamiento de workspace** — qué puede ver cada equipo
- **Log de auditoría** — qué hizo cada quien, en orden, para siempre

Si estás corriendo AuraClaw en producción, lee esta página de punta a punta.

::: tip Agentico, pero no autónomo
Todo departamento de TI y CISO en 2025–2026 tiene la misma pregunta antes de comprar IA:

> **"¿Y si el agente se sale de carril y borra algo equivocado?"**

Cualquiera que te diga "la IA no se saldrá de carril" está mintiendo. La respuesta de AuraClaw es distinta — **el agente te pregunta primero cuando importa.**

Cuando el agente quiere borrar un archivo, enviar un correo, correr un SQL de escritura o golpear una API de pago — cualquier llamada a herramienta que coincida con una regla de Tool Guard **se pausa a mitad de turno**. Una notificación de aprobación se empuja a tu IM (Feishu / DingTalk / Slack / correo). Tú tocas aprobar, el agente reanuda desde donde se detuvo. Cada acción aterriza en `mate_tool_guard_audit_log` — solo-anexar, retenido todo el tiempo que quieras, exportable a CSV.

**Agentico — actúa. No autónomo — no actúa por iniciativa propia en lo que importa.**

Esa es la línea entre "deja que la IA haga trabajo por ti" y "deja que la IA decida por ti". AuraClaw se queda al lado izquierdo de esa línea — que es también el lado al que tu CISO no le dice que no de inmediato.
:::

---

## Autenticación JWT

### Cómo funciona

1. El usuario envía credenciales a `/api/v1/auth/login`
2. El servidor valida y devuelve un JWT
3. Cada solicitud posterior incluye el token en el encabezado `Authorization`
4. El servidor valida el token en cada solicitud

### Iniciar sesión

```bash
curl -X POST http://localhost:18088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Respuesta:

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400
  }
}
```

### Cambio de contraseña

Los usuarios pueden cambiar su propia contraseña desde el diálogo de ajustes de perfil. Los administradores pueden resetear la contraseña de cualquier miembro desde la gestión de miembros.

---

### Renovación por ventana deslizante

AuraClaw hace renovación de tokens por ventana deslizante. Cuando la vida restante de un token cae bajo el `renewal-threshold` configurable (default 2 horas / 7200000ms), el servidor emite un token nuevo en el encabezado de respuesta `X-New-Token`. El frontend lo recoge y reemplaza el token almacenado de forma transparente. Los usuarios activos nunca son expulsados; las sesiones inactivas igual expiran a tiempo.

### Configuración

```yaml
mateclaw:
  jwt:
    secret: tu-clave-secreta-de-al-menos-32-caracteres
    expiration: 86400000          # vida del token (ms, default 24h)
    renewal-threshold: 7200000    # renovación deslizante cuando la vida restante cae bajo esto (ms)
```

::: warning
**Cambia el secreto JWT por defecto en producción.** Al menos 32 caracteres. Defínelo vía variable de entorno (`JWT_SECRET=...`), nunca lo commitees.
:::

### Códigos de error

| Código | Significado | Respuesta |
|------|---------|----------|
| 401 | Token faltante, expirado o inválido | `{"code":401,"msg":"Token expired or invalid","data":null}` |
| 403 | Token válido pero permisos insuficientes | `{"code":403,"msg":"Forbidden","data":null}` |

El frontend maneja ambos de forma uniforme — redirige a login, limpia los tokens almacenados.

### Credenciales por defecto

AuraClaw viene con `admin` / `admin123`. **Cambia esto de inmediato en cualquier despliegue que no sea tu laptop.**

### Config de Spring Security

- **Sesiones sin estado** — sin sesión del lado del servidor; todo el estado en el JWT
- **Endpoints públicos de API** — `GET /api/v1/settings/language`, `/api/v1/auth/login`, `/api/v1/chat/stream`, `/api/v1/chat/*/stop`, `/api/v1/agents/*/chat/stream`, `/api/v1/setup/**`, `/api/v1/channels/webhook/**`, `/api/v1/channels/webchat/**`, `/api/v1/talk/ws`, `/api/v1/files/generated/**`
- **Endpoints protegidos** — todo lo demás bajo `/api/**`
- **CSRF deshabilitado** — no es necesario para JWT sin estado

---

## Tool Guard — motor de permisos basado en reglas

Tool Guard es cómo AuraClaw decide qué se le permite hacer a una llamada a herramienta. **No es una lista plana de herramientas peligrosas.** Es un motor de reglas. Cada regla especifica: *para esta herramienta, opcionalmente coincidiendo con estos argumentos, en este workspace, haz X* — donde X es `allow`, `deny` o `require_approval`.

### Las tres tablas

| Tabla | Propósito |
|-------|---------|
| **`mate_tool_guard_config`** | Config global — habilitado, política por defecto, timeout de aprobación, canales de notificación |
| **`mate_tool_guard_rule`** | Reglas individuales — patrón de herramienta, regex de argumentos opcional, alcance de workspace, acción, prioridad |
| **`mate_tool_guard_audit_log`** | Toda llamada custodiada obtiene una entrada — herramienta, args, regla coincidente, decisión, usuario, marca de tiempo |

### Cómo se evalúa una regla

```
Llega una llamada a herramienta
      │
      ▼
Cargar reglas para este workspace + reglas globales, ordenadas por prioridad
      │
      ▼
Por cada regla en orden de prioridad:
  ┌─ ¿Coincide el nombre de la herramienta con el patrón?
  │  └─ No → siguiente regla
  ├─ ¿Coincide el patrón de argumentos (si lo hay)?
  │  └─ No → siguiente regla
  └─ Sí en ambos → aplicar la acción de esta regla y detenerse
      │
      ▼
Sin reglas coincidentes → aplicar la política por defecto
      │
      ▼
Acción: allow / deny / require_approval
      │
      ▼
Escribir entrada en el log de auditoría
      │
      ▼
Ejecutar / rechazar / suspender para aprobación
```

Las reglas con mayor prioridad corren primero. Gana la primera regla coincidente. Una regla puede estar acotada a un workspace específico o ser global.

### Reglas de ejemplo

```
Regla 1 (prioridad 100):  ShellExecuteTool, arg coincide con "^(ls|cat|grep|find)\\s"  → allow
Regla 2 (prioridad 50):   ShellExecuteTool                                        → require_approval
Regla 3 (prioridad 50):   WriteFileTool, arg.path empieza con "/tmp"              → allow
Regla 4 (prioridad 40):   WriteFileTool                                           → require_approval
Regla 5 (prioridad 30):   *                                                        → allow (default)
```

Los comandos shell de solo lectura se ejecutan de inmediato. Cualquier otra cosa necesita aprobación. Las escrituras de archivos bajo `/tmp` son libres; en otro lado necesitan aprobación. Todo lo demás corre.

### Gestionando reglas

`Ajustes → Seguridad y Aprobación → Reglas de Tool Guard`: listar, crear, editar, reordenar, deshabilitar. O vía config:

```yaml
mateclaw:
  tool:
    guard:
      enabled: true
      default-policy: require_approval
      rules:
        - tool: ShellExecuteTool
          arg-pattern: "^(ls|cat|grep|find)\\s"
          action: allow
          priority: 100
        - tool: ShellExecuteTool
          action: require_approval
          priority: 50
        - tool: WriteFileTool
          arg-pattern: "^/tmp/"
          action: allow
          priority: 50
        - tool: WriteFileTool
          action: require_approval
          priority: 40
```

O vía API:

```bash
curl -X POST http://localhost:18088/api/v1/security/guard/rules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "ShellExecuteTool",
    "argPattern": "^(ls|cat|grep|find)\\s",
    "action": "allow",
    "priority": 100
  }'
```

### Toggles de reglas de credenciales (1.4.0)

Las reglas de credenciales ahora soportan **control por regla** — cada regla puede habilitarse/deshabilitarse individualmente, cada regla lleva su propia decisión (allow / deny / require_approval), y todo el conjunto de reglas de guarda puede **exportarse e importarse como JSON** para migrar entre despliegues o versionar tu política.

### Detección de patrones peligrosos

Además de las reglas definidas por el usuario, la herramienta de shell de AuraClaw tiene detección integrada de patrones que son peligrosos sin importar qué. `find -delete`, `rm -rf /`, descargas por pipe a través de `bash`, y patrones similares disparan aprobación elevada incluso si una regla de otro modo los permitiría.

---

## Flujo de aprobación — humano en el bucle

Cuando una regla evalúa a `require_approval`, AuraClaw no falla la llamada. **Suspende al agente a mitad de turno**, crea una aprobación pendiente, se la muestra al usuario y reanuda exactamente donde se quedó una vez que el usuario decide.

::: tip Desde 1.3.0: los workflows viajan en el mismo riel de aprobación
El paso `await_approval` del [workflow](./workflow) v1.3.0 suspende la corrida completa del workflow en la misma tabla `mate_tool_approval` — persistido entre reinicios. Las solicitudes de aprobación se reparten al canal del aprobador (Feishu / DingTalk / Slack / WeCom); una vez resuelto, el runtime del workflow auto-reanuda el siguiente paso. Un log de auditoría, un pipeline de notificaciones, una semántica de "pausa / reanuda" — cubriendo tanto llamadas a herramientas de agente como pasos de workflow.
:::

### Cómo fluye

```
El agente llama a una herramienta
     │
     ▼
Tool Guard: require_approval
     │
     ▼
Crear fila mate_tool_approval (status=pending)
     │
     ▼
Poner AWAITING_APPROVAL=true en el estado del grafo
     │
     ▼
Emitir evento SSE approval_required
     │
     ▼
El grafo termina limpiamente
     │
     ▼
El frontend muestra la tarjeta de aprobación
     │
     ▼
El usuario hace clic en Aprobar o Rechazar
     │
     ▼
POST /api/v1/chat/stream con /approve o /deny
     │
     ├─ Aprobado → recargar agente, re-ejecutar la llamada a herramienta, continuar razonando
     └─ Rechazado → enviar el rechazo como observación, continuar razonando
```

El mecanismo de "re-ejecución" es importante. Cuando el agente reanuda, **no re-razona desde cero** — salta directo a la llamada a herramienta aprobada, la ejecuta y continúa desde la observación. Sin llamadas al LLM duplicadas, sin tokens desperdiciados.

El camino web actual no tiene un endpoint estilo escritura `POST /api/v1/approvals/{id}/resolve`. La aprobación y la denegación usan el mismo canal SSE que el chat normal para que re-ejecución, persistencia y cancelación queden todos en un solo ciclo de vida.

### La tabla `mate_tool_approval`

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `agent_id` | Qué agente está esperando |
| `conversation_id` | Qué conversación está suspendida |
| `tool_name` | La herramienta que se está llamando |
| `tool_args` | JSON de los argumentos reales |
| `rule_id` | Qué regla disparó la aprobación |
| `status` | `pending` / `approved` / `denied` / `consumed` / `timeout` / `superseded` |
| `requested_at` | Cuándo se creó la aprobación |
| `resolved_at` | Cuándo decidió el usuario |
| `resolved_by` | Quién decidió |
| `notes` | Notas opcionales del usuario sobre la decisión |

### Sustitución de placeholders

A veces los argumentos de la herramienta del agente contienen placeholders — una ruta de archivo calculada, un comando templado. El flujo de aprobación **resuelve los placeholders antes de mostrar el diálogo**, así los usuarios ven los valores reales que están aprobando. La aprobación también devuelve los valores resueltos, para que lo que el agente ejecuta sea exactamente lo que el usuario vio.

### Timeouts

Las aprobaciones pendientes expiran tras un timeout configurable (default: 30 minutos). Las aprobaciones expiradas se vuelven `timeout`, y el agente trata la expiración igual que un rechazo del usuario.

### Notificaciones

AuraClaw puede notificar a través de adaptadores `channel/notification/` — correo, alerta en la app, push de DingTalk/Feishu. Configura en `Ajustes → Seguridad y Aprobación → Notificaciones`.

### Superficie de API actual

```bash
# Hidratar aprobaciones pendientes tras un refresco de página
curl http://localhost:18088/api/v1/chat/{conversationId}/pending-approvals \
  -H "Authorization: Bearer <token>"

# Aprobar en la conversación en espera
curl -N -X POST http://localhost:18088/api/v1/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"1","conversationId":"conv-abc123","message":"/approve"}'

# Rechazar en la conversación en espera
curl -N -X POST http://localhost:18088/api/v1/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"1","conversationId":"conv-abc123","message":"/deny"}'

# Gestionar concesiones de auto-aprobación
curl http://localhost:18088/api/v1/approval/grants \
  -H "Authorization: Bearer <token>"
```

### Auto-aprobación: hits visibles, misses explicables (2.0.0+)

El escenario más exasperante pre-2.0: configuraste una concesión de auto-aprobación exactamente como sugería la intuición, y las llamadas a herramientas **aún** iban a revisión humana — la página de concesiones decía "habilitado", el log de auditoría decía solo "necesita aprobación", y nada en ningún lado te decía por qué la concesión no se disparó. 2.0.0 hace toda la cadena transparente:

- **Las razones de miss se clasifican.** El resolvedor ya no mete todo miss en "sin concesión": **existe una concesión pero su techo de severidad es demasiado bajo** (p. ej. un techo LOW bloqueando una llamada HIGH — la trampa más común), no hay concesión candidata en absoluto, desajuste de workspace, CRITICAL forzado a revisión humana… cada una recibe su propio código de razón.
- **El resultado aterriza en la fila de auditoría.** Cada fila de auditoría de guarda registra el resultado y la razón de auto-aprobación — las llamadas auto-aprobadas ya no muestran engañosamente "necesita aprobación", y las llamadas que fueron a revisión muestran *por qué* de un vistazo. Las filas de auditoría también llevan el id real de aprobación pendiente, así puedes saltar de la auditoría directo a esa aprobación.
- **Creación de concesión de un clic desde la página de auditoría.** Cuando ves un miss de "techo de severidad demasiado bajo", un atajo de **crear concesión** está justo en la fila de auditoría, pre-llenado con el nombre de la herramienta, el alcance y el techo sugerido — sin reconfigurar de memoria.
- **Formularios anti-disparo-en-el-pie.** Los ids de alcance cambian de texto libre a **selectores tipados por alcance** (elige un agente para alcance AGENT, una conversación para CONVERSATION, un workspace para WORKSPACE), erradicando de raíz las concesiones muertas por tipo desajustado; el techo de severidad lleva pistas semánticas ("LOW solo auto-aprueba llamadas de baja severidad"); y **las configuraciones muertas entre workspaces se rechazan al crear** — una concesión que nunca podría dispararse se señala en el acto en lugar de dejarte adivinando en el log de auditoría.

Los pisos duros no cambian: CRITICAL siempre va a un humano, y los bloqueos del piso de seguridad siguen siendo innegociables.

---

## File Guard

File Guard es control de acceso a nivel de filesystem. Se sienta debajo de cualquier herramienta o skill que lea o escriba archivos, y decide qué rutas están dentro de los límites.

### Pipeline de evaluación

```
Solicitud de acceso a archivo
     │
     ▼
Normalización de ruta (resolver .., symlinks, rutas relativas)
     │
     ▼
Chequeo de allowlist: ¿está la ruta dentro de un directorio permitido?
     │
     ▼
Chequeo de denylist: ¿está la ruta dentro de un directorio denegado?
     │
     ▼
Chequeo de symlink: ¿seguir la ruta escapa del sandbox?
     │
     ▼
Permitir / Denegar
```

### Reglas integradas

| Regla | Descripción |
|------|-------------|
| Aislamiento de workspace | El acceso por defecto se restringe al directorio del workspace |
| Denegación de rutas de sistema | `/etc`, `/usr`, `/bin`, `/boot`, etc. bloqueados |
| Protección de archivos sensibles | `.ssh`, `.config`, `.env` bloqueados |
| Prevención de recorrido de rutas | los ataques `../` se detectan y bloquean |
| Chequeo de symlinks | Los destinos de symlinks se resuelven y re-validan |

### Configuración

Las reglas de rutas permitidas / denegadas viven en la base de datos y se gestionan desde la página de Seguridad del admin o `GET` / `PUT /api/v1/security/guard/config/file-guard` — **no application.yml**. La única pieza YAML es la **raíz de sandbox de respaldo global** a la que las herramientas de archivo/shell se confinan cuando una conversación no tiene ruta base por workspace:

```yaml
mateclaw:
  workspace:
    sandbox:
      enabled: true                    # pon false para restaurar el comportamiento legacy sin restricciones
      root: ${user.dir}/data/workspace # raíz de sandbox de respaldo, creada al arrancar
```

Editor visual en `Ajustes → Seguridad y Aprobación → File Guard`.

---

## Aislamiento de workspace

Los workspaces son cómo AuraClaw mantiene separados los datos de múltiples equipos. Todo agente, skill, wiki, conversación y archivo de memoria pertenece exactamente a un workspace.

### Primitivas de seguridad que siguen los límites del workspace

- **File Guard** — las allowlists de rutas por defecto son `workspace/{workspaceId}/...`
- **Reglas de Tool Guard** — pueden estar acotadas a un workspace específico
- **Bases de conocimiento Wiki** — propiedad de un workspace, legibles solo por miembros
- **Archivos de memoria** — la memoria de cada agente está bajo el directorio de su workspace
- **Canales** — cada canal pertenece a un workspace

### Roles (RBAC de cuatro niveles)

Las capacidades son **aditivas** — un rol superior hereda todo lo de abajo.

| Rol | Capacidades (agregadas sobre el nivel inferior) |
|------|-----------------------------------------------|
| **Viewer** | `chat`, `view:wiki`. Solo lectura. Para que el chat funcione, un Viewer también puede leer el modelo activo y leer los archivos de workspace de un empleado. |
| **Member** | Viewer + `view:memory`, `view:dashboard`, `manage:wiki`, `manage:agents` |
| **Admin** | Member + `manage:skills`, `manage:channels`, `manage:models`, `manage:security`, `manage:settings` |
| **Owner** | Igual que Admin, más solo-dueño: borrar el workspace, transferir la propiedad |

**El backend es la única fuente de verdad para las capacidades** — tiene un mapeo `RoleCapabilities`, y el frontend nunca las deriva localmente. Tras un cambio de workspace, o ante un 403 relacionado con capacidades, el frontend llama `GET /api/v1/workspaces/{id}/access`, que devuelve `memberRole`, `isGlobalAdmin`, `effectiveRole` y `capabilities`.

**Admin global vs rol de workspace**: `mate_user.role='admin'` es el admin global de todo el sistema — gestiona usuarios, crea workspaces y abarca **todos** los workspaces con poder equivalente a dueño incluso donde no es miembro; `mate_workspace_member.role` es por workspace. Los endpoints de nivel sistema (modelos / proveedores / OAuth / fuentes de datos, gestión de usuarios, creación de workspaces) requieren un admin global (`@RequireGlobalAdmin`); los endpoints acotados a workspace (skills / tools / plugins) requieren un rol de workspace — las lecturas necesitan Member, las escrituras Admin.

Detalles completos en [Workspaces](./workspaces).

### Lo que el aislamiento NO cubre

- **Config global compartida** — el secreto JWT, las claves de proveedores de modelos, las definiciones de servidores MCP son globales
- **Logs de auditoría** — los eventos de seguridad de todos los workspaces están en el mismo log de auditoría; solo los admins con acceso de auditoría leen entre workspaces

---

## Log de auditoría

Toda acción relevante para la seguridad se registra en `mate_audit_event`. **Solo-anexar** — no puedes modificar una entrada, y las filas se retienen por la ventana configurada (default 90 días).

### Qué se registra

| Tipo de evento | Datos capturados |
|------------|---------------|
| **Llamadas a herramientas** | Nombre de herramienta, args, resumen del resultado, duración, agente, workspace |
| **Decisiones de Tool Guard** | Regla coincidente, acción tomada, ID de regla |
| **Aprobaciones** | Quién aprobó/rechazó, cuándo, notas |
| **Decisiones de File Guard** | Ruta, permitir/denegar, razón |
| **Ejecuciones de skills** | Nombre del skill, parámetros, agente |
| **Eventos de login** | Usuario, IP, éxito/fallo |
| **Cambios de configuración** | Valores viejos y nuevos de ajustes relevantes a seguridad |

### Esquema de entrada

```
timestamp       Cuándo pasó
user_id         Quién lo hizo (system para eventos automatizados)
action          Qué hizo
resource        Sobre qué se hizo
details         Blob JSON con los detalles
result          success / failure / denied
ip_address      IP de origen cuando aplica
workspace_id    A qué workspace pertenece
```

### Consultar

`Ajustes → Seguridad y Aprobación → Log de Auditoría`: vista filtrable por rango de tiempo, tipo de evento, usuario, workspace, resultado. Exportar a CSV.

Vía API:

```bash
curl "http://localhost:18088/api/v1/audit/events?from=2026-04-01&to=2026-04-11&action=tool_call" \
  -H "Authorization: Bearer <token>"
```

---

## Escaneo de seguridad de skills

Los skills personalizados se escanean en busca de patrones peligrosos antes de volverse activos:

| Chequeo | Qué busca |
|-------|-------------------|
| **Inyección de prompt** | Intentos de sobrescribir prompts de sistema, instrucciones ocultas |
| **Referencias a herramientas peligrosas** | Herramientas fuera de la allowlist, o herramientas que requieren aprobación sin declararla |
| **Referencias a URLs externas** | Enlaces a recursos externos no confiables |
| **Inyección de scripts** | Scripts embebidos o intentos de ejecución de código |

### Niveles de severidad

| Nivel | Acción |
|-------|--------|
| `CRITICAL` | Instalación bloqueada; debe arreglarse |
| `HIGH` | Advertencia + el admin debe confirmar |
| `MEDIUM` | Advertencia mostrada; instalación permitida |
| `LOW` | Solo registrado |
| `INFO` | Solo registrado |

Los reportes de escaneo viven en `Ajustes → Seguridad y Aprobación → Escaneos de Skills`.

---

## Protección de claves API

- Las claves API se cifran en reposo en la base de datos
- Las claves se **enmascaran** (`sk-****abcd`) en toda respuesta de API — nunca se devuelven completas tras la creación
- Los valores `env_json` y `headers_json` de los servidores MCP se sanean igual
- Las referencias a variables de entorno (`${VAR}`) en la config MCP se resuelven en runtime desde el entorno del proceso

---

## Seguridad de red

### Recomendaciones de producción

| Recomendación | Detalles |
|----------------|---------|
| **HTTPS** | Reverse proxy con TLS (Nginx o Caddy) |
| **Deshabilitar consola H2** | `spring.h2.console.enabled=false` en producción |
| **Firewall** | Solo exponer el puerto público |
| **Rate limiting** | Configurar a nivel de reverse proxy |
| **Base de datos de producción, no H2** | Sigue el stack Docker público con PostgreSQL 16, o usa una instancia dedicada de MySQL 8 / KingbaseES |

### Ejemplo de reverse proxy Nginx

```nginx
server {
    listen 443 ssl;
    server_name auraclaw.example.com;

    ssl_certificate /etc/ssl/certs/auraclaw.pem;
    ssl_certificate_key /etc/ssl/private/auraclaw.key;

    location / {
        proxy_pass http://localhost:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Soporte SSE
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

### Protección de solicitudes salientes (SSRF)

Toda **solicitud HTTP saliente que un agente pueda manejar** lleva protección SSRF por defecto, para que un agente manipulado no pueda ser dirigido a sondear tu red interna o un endpoint de metadatos cloud. Tres caminos salientes están cubiertos:

| Camino saliente | Disparado por | Comportamiento por defecto |
|---------------|--------------|-------------------|
| **Herramienta de navegador** | la acción `open` de `browser_use` | resuelve el host destino y rechaza direcciones restringidas |
| **Webhook de hook** | la llamada HTTP de una acción de hook | el host debe estar en `trusted-domains` Y no debe ser una dirección privada |
| **Descarga de imágenes** | la herramienta de imágenes trayendo una referencia de URL | rechaza hosts privados / loopback |

Clases de direcciones bloqueadas por defecto: loopback (`127.0.0.0/8`, `::1`), privadas (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, `fe80::/10`), any-local, multicast, y endpoints de metadatos cloud (`169.254.169.254`, `100.100.100.200`, `192.0.0.192`, …).

#### Permitir direcciones internas: `mateclaw.security.ssrf-allowlist`

Cuando un agente necesita legítimamente alcanzar un servicio interno, agrégalo a la allowlist compartida. **Un ajuste, aplicado a los tres caminos salientes.** Cada entrada es una de:

| Forma | Ejemplo | Significado |
|------|---------|---------|
| Hostname literal | `internal.corp` | coincidencia exacta insensible a mayúsculas |
| IP literal | `192.168.100.100` | coincide con esa dirección exacta |
| Bloque CIDR IPv4 | `192.168.100.0/24` | coincide con toda IP del rango |

```yaml
mateclaw:
  security:
    ssrf-allowlist:
      - 192.168.100.100      # una sola dirección interna
      - 192.168.100.0/24     # una subred interna completa
      - internal.corp        # un hostname interno
```

La allowlist abre **solo las entradas que listas**: `192.168.100.0/24` no abre también `192.168.200.x`, y `192.168.100.100` no abre IPs hermanas en la misma subred. Los cambios requieren reinicio del backend.

::: warning Mantenla estrecha
Las entradas de allowlist **pueden re-exponer endpoints de metadatos cloud** (p. ej. `169.254.169.254`). Una vez expuesto, un agente comprometido podría usarlo para robar credenciales cloud. Agrega solo las direcciones internas que realmente necesitas, y **nunca** abras cosas con un CIDR amplio como `0.0.0.0/0` o `10.0.0.0/8`.
:::

La herramienta de navegador también tiene un interruptor maestro `mateclaw.browser.ssrf-check-enabled` (default `true`). Ponerlo en `false` **deshabilita el chequeo SSRF por completo** para el camino del navegador — incluidos los endpoints de metadatos — y está desaconsejado; prefiere la allowlist de arriba para excepciones precisas.

---

## Buenas prácticas de seguridad

1. **Cambia la contraseña por defecto.** Ahora mismo. En todo despliegue.
2. **Pon un secreto JWT real.** Al menos 32 caracteres, vía variable de entorno, nunca commiteado.
3. **Mínimo privilegio.** Solo habilita las herramientas que los agentes realmente necesitan.
4. **Default a `require_approval`.** Voltea la política por defecto de Tool Guard, luego agrega reglas `allow` para casos seguros. Las herramientas recién agregadas son seguras por defecto.
5. **Configura File Guard.** Bloquea las rutas permitidas/denegadas antes de que cualquier agente toque el filesystem con intención.
6. **Revisa los logs de auditoría regularmente.** Pon un recordatorio recurrente. Busca anomalías.
7. **Vigila tus escaneos de skills.** Los hallazgos CRITICAL no deberían saltarse a la ligera.
8. **Aísla las redes.** Ollama, consola H2, servidores MCP internos — ninguno debería ser público.
9. **No te saltes las aprobaciones en producción.** Las reglas de auto-aprobación deberían ser estrechas y específicas. `allow *` es una crisis esperando a ocurrir.

---

## Referencia de configuración de seguridad

application.yml lleva **tres** bloques relacionados con seguridad — JWT, el sandbox de filesystem y la allowlist de solicitudes salientes:

```yaml
mateclaw:
  jwt:
    secret: ${JWT_SECRET:tu-clave-secreta-al-menos-32-caracteres}
    expiration: 86400000          # vida del token (milisegundos)
    renewal-threshold: 7200000    # renovación deslizante cuando la vida restante cae bajo esto (ms)

  # Sandbox global de respaldo para herramientas de archivo/shell: cuando una
  # conversación no tiene ruta base por workspace, todas las operaciones de
  # archivo/shell se confinan a esta raíz (default fail-closed)
  workspace:
    sandbox:
      enabled: true
      root: ${user.dir}/data/workspace

  # Allowlist SSRF saliente: permite hosts/IPs/bloques CIDR internos específicos,
  # compartida por los caminos salientes de navegador, hook y descarga de imágenes.
  # Vacía significa que toda dirección privada está bloqueada por la política por defecto.
  security:
    ssrf-allowlist: []            # p. ej. [192.168.100.100, 192.168.100.0/24]
```

**Todo lo demás se gestiona en la base de datos — desde la página de Seguridad del admin (o `/api/v1/security/guard/*`), no application.yml:**

- **Tool Guard** interruptor, política por defecto, reglas, timeout de aprobación (default 30 minutos), canales de notificación → `mate_tool_guard_config` / `mate_tool_guard_rule`
- **File Guard** reglas de rutas permitidas / denegadas → `GET` / `PUT /api/v1/security/guard/config/file-guard`
- **El log de auditoría** está siempre encendido, escrito fila por fila a `mate_tool_guard_audit_log`, exportable como CSV
- **El escaneo de seguridad de skills** se muestra durante la instalación de skills; los hallazgos CRITICAL se bloquean por defecto

---

## Siguiente

- [Herramientas](./tools) — detalles de herramientas y patrones de reglas de Tool Guard
- [Skills](./skills) — detalles del escaneo de seguridad de skills
- [Workspaces](./workspaces) — primitivas de aislamiento de workspace
- [Agentes](./agents) — cómo la aprobación pausa y reanuda un turno de agente
- [Configuración](./config) — referencia completa de configuración
