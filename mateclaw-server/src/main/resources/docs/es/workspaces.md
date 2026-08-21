# Workspaces

**Un workspace es una caja alrededor de las cosas de un equipo.**

AuraClaw soporta múltiples equipos en un solo despliegue organizando todo recurso — agentes, skills, bases de conocimiento wiki, conversaciones, archivos de memoria, reglas de tool guard, canales — en **workspaces**. Cuando inicias sesión, ves los workspaces a los que perteneces y nada más. Cuando cambias de workspace, toda la UI se re-acentúa: distintos agentes, distintos skills, distinto conocimiento, distintos canales.

El punto es que un despliegue de AuraClaw puede servir a un equipo de producto, un equipo de ingeniería y un equipo de investigación sin que sus datos, agentes o conversaciones sangren entre sí.

---

## Qué pertenece a un workspace

Casi todo. Los recursos acotados:

| Recurso | Cómo se acota |
|----------|-----------|
| **Agentes** | Toda fila de agente tiene una clave foránea `workspace_id` |
| **Skills** | Los skills custom y MCP se acotan por workspace; los skills builtin son globales |
| **Bases de conocimiento Wiki** | Toda KB pertenece exactamente a un workspace |
| **Conversaciones y mensajes** | Acotados al workspace en el que vive el agente |
| **Archivos de memoria del workspace** | `workspace/{workspaceId}/{agentId}/...` |
| **Canales** | Cada canal se liga a un agente, así transitivamente a un workspace |
| **Reglas de Tool Guard** | Las reglas pueden ser globales o acotadas a un workspace específico |
| **Rutas de File Guard** | Las rutas permitidas/denegadas pueden ser específicas del workspace |
| **Cron jobs** | Acotados al workspace del agente que disparan |
| **Fuentes de datos** | Conexiones de BD externas, acotadas por workspace |
| **Eventos de auditoría** | Todo evento de auditoría registra su `workspace_id` |

Lo que **no** está acotado (es decir, global):

- Secreto JWT y config de auth
- Proveedores de modelos y claves API (globales, con uso rastreado por workspace)
- Definiciones de servidores MCP (conexiones globales; el acceso al workspace se controla por permisos)
- Ajustes a nivel de sistema en `mate_system_setting`
- Skills builtin

---

## Roles de workspace

Cada usuario se asigna a un workspace con uno de cuatro roles. Las capacidades son **aditivas** — un rol superior hereda todo lo de abajo:

| Rol | Capacidades (agregadas sobre el nivel inferior) |
|------|-----------------------------------------------|
| **Viewer** | `chat`, `view:wiki`. Solo lectura. Para que el chat funcione, un Viewer también puede leer el modelo activo y leer los archivos de workspace de un empleado. |
| **Member** | Viewer + `view:memory`, `view:dashboard`, `manage:wiki`, `manage:agents` |
| **Admin** | Member + `manage:skills`, `manage:channels`, `manage:models`, `manage:security`, `manage:settings` |
| **Owner** | Igual que Admin, más solo-dueño: borrar el workspace, transferir la propiedad |

Un usuario puede pertenecer a múltiples workspaces con roles distintos. Cuando cambia de workspace, sus permisos efectivos cambian con él.

### Admin global vs rol de workspace

Son dos sistemas de permisos independientes:

- **Admin global** — `mate_user.role='admin'`, de todo el sistema. Gestiona usuarios, crea workspaces y abarca **todos** los workspaces con poder equivalente a dueño incluso donde no es miembro.
- **Rol de workspace** — `mate_workspace_member.role`, uno por workspace, los cuatro roles de arriba.

Los endpoints de nivel sistema (modelos / proveedores / OAuth / fuentes de datos, gestión de usuarios, creación de workspaces) requieren un admin global (`@RequireGlobalAdmin`); los endpoints acotados a workspace (skills / tools / plugins) requieren un rol de workspace — las lecturas necesitan Member, las escrituras Admin.

### Alcance de capacidades — el backend es la fuente de verdad

Los roles controlan la **visibilidad de la UI** y el **acceso a la API**, y **el backend es la única fuente de verdad para las capacidades**: tiene un mapeo `RoleCapabilities`, y el frontend nunca las deriva localmente. Tras un cambio de workspace, o ante un 403 relacionado con capacidades, el frontend llama `GET /api/v1/workspaces/{id}/access`, que devuelve `memberRole`, `isGlobalAdmin`, `effectiveRole` y `capabilities`.

El frontend se controla con esto: las rutas declaran una capacidad requerida; la barra lateral filtra por capacidad (sin flash de menú antes de cargar); un Viewer aterriza en `/chat`; la barra lateral también muestra insignias de notificación (aprobaciones pendientes, empleados atascados). El backend impone las mismas reglas en todo endpoint de API, así una solicitud sin la capacidad devuelve `403 Forbidden`.

---

## Crear un workspace

`Ajustes → Workspaces → Nuevo Workspace`.

1. Nómbralo por lo que hace el equipo, no por cómo se llama el equipo ("Investigación de Producto" sobre "Equipo Alpha")
2. Descripción opcional
3. Guarda

Te conviertes en el dueño del workspace. Ahora puedes invitar miembros.

### Vía API

```bash
curl -X POST http://localhost:18088/api/v1/workspaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Research",
    "description": "Competitive research and product specs"
  }'
```

---

## Miembros y roles

`Ajustes → Miembros`. Toda gestión de miembros requiere **Admin o superior**.

### Agregar un miembro

Ingresa un nombre de usuario, elige un rol (default `member`), guarda.

- Si el usuario **no existe**, la cuenta se **crea en el acto** — se requiere una contraseña en ese caso.
- Si el usuario **existe** y provees una contraseña, su **contraseña se resetea** (útil cuando un admin quita a un miembro y luego lo re-agrega con una contraseña nueva).
- El apodo es opcional.

El miembro ve inmediatamente el workspace en su cambiador de workspace en la siguiente carga de página. Sin correo de invitación, sin flujo de aceptación.

```bash
# Agregar por nombre de usuario; crea la cuenta con la contraseña dada si no existe
curl -X POST http://localhost:18088/api/v1/workspaces/1/members \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "init-pass-123",
    "nickname": "Alice",
    "role": "member"
  }'
```

### Actualizar el rol de un miembro (Admin+, no puede cambiar al Owner)

```bash
curl -X PUT http://localhost:18088/api/v1/workspaces/1/members/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

> La ruta es `/members/{memberId}`, **no** `/members/{memberId}/role`.

### Quitar un miembro (Admin+, no puede quitar al Owner)

```bash
curl -X DELETE http://localhost:18088/api/v1/workspaces/1/members/42 \
  -H "Authorization: Bearer <token>"
```

### Listar miembros

```bash
curl http://localhost:18088/api/v1/workspaces/1/members \
  -H "Authorization: Bearer <token>"
```

---

## Cambiar de workspace

Arriba a la izquierda de la consola de administración. Haz clic en el nombre del workspace para abrir el cambiador; elige otro para cambiar. Toda la UI se re-acentúa:

- Los menús de la barra lateral se re-renderizan según el rol del workspace nuevo
- La lista de agentes se refresca para mostrar los agentes de este workspace
- La lista de Wiki, la lista de skills, la lista de canales, etc., cambian todas
- Las conversaciones activas siguen abiertas (pertenecen a su propio workspace)

La selección de workspace se persiste por usuario — cuando vuelves a iniciar sesión, aterrizas en el último workspace que usaste.

---

## Primitivas de seguridad que siguen los límites del workspace

Aquí es donde el aislamiento de workspace gana su sustento.

### File Guard

La lista de rutas permitidas por defecto de File Guard es `workspace/{workspaceId}/...`. Una llamada a herramienta de un agente del workspace A no puede leer ni escribir archivos que pertenecen al workspace B, sin importar los trucos de recorrido de rutas — el chequeo de symlinks y la normalización de rutas lo atrapan.

### Reglas de Tool Guard

Las reglas pueden acotarse a un workspace específico. Puedes tener:

- Una regla **global** que diga que `ShellExecuteTool` necesita aprobación
- Una regla **específica del workspace** que diga que `ShellExecuteTool` está permitido si el comando coincide con un patrón estrecho de solo lectura

Solo la segunda regla aplica dentro de ese workspace. Otros workspaces ven solo la regla global.

### Bases de conocimiento Wiki

Los datos de una KB Wiki nunca salen de su workspace. Un agente del workspace B no puede leer una KB que pertenece al workspace A, incluso si lo intenta. Las herramientas de búsqueda y lectura de Wiki resuelven `kbId` desde el workspace del agente ligado; las lecturas entre workspaces se rechazan en la capa de API.

### Archivos de memoria

Los archivos de memoria del workspace (PROFILE.md, MEMORY.md, notas diarias) viven bajo `workspace/{workspaceId}/{agentId}/`. File Guard impone el límite del workspace; las herramientas de memoria acotan sus operaciones de listar/leer/escribir al workspace del llamador.

### Canales

Cada canal se liga exactamente a un agente, así transitivamente exactamente a un workspace. Un bot de DingTalk configurado en el workspace A es completamente separado de un bot de DingTalk configurado en el workspace B, incluso si están configurados para conectarse a la misma aplicación de DingTalk (probablemente no quieras eso, pero técnicamente está permitido).

Desde 2.0.0, **la generación de ids de conversación codifica la identidad del canal** — dos canales del mismo tipo creados en workspaces distintos mantienen filas de conversación separadas incluso para el mismo usuario externo; los chats de dos workspaces ya no pueden aterrizar en una sola conversación.

### Skills (2.0.0)

Los skills del mismo nombre coexisten independientemente entre workspaces: la dedup de instalación filtra por workspace, los directorios en disco codifican el workspaceId, y la carga en runtime / lecturas de archivos / corridas de scripts resuelven solo dentro del workspace de la conversación (+ builtin + virtual global). Un empleado de un workspace no puede ni leer ni ejecutar el skill del mismo nombre de otro workspace. Ver [Skills](./skills).

---

## Lo que el aislamiento NO cubre

- **Config global compartida** — el secreto JWT, las claves API de proveedores de modelos, las definiciones de servidores MCP son globales. Un admin de workspace no puede cambiarlas.
- **Acceso entre workspaces al log de auditoría** — los admins de seguridad con los permisos correctos pueden consultar eventos de auditoría en todos los workspaces. Es intencional — quieres ver actividad sospechosa sin importar en qué workspace ocurrió.
- **Reporte de uso de tokens** — agregado globalmente, desglosado por workspace, por agente, por modelo en el Dashboard.
- **Costos de proveedores de modelos** — una relación de facturación por proveedor a nivel global; las cuotas por workspace están en el [Roadmap](./roadmap).

---

## Raíz de almacenamiento por defecto y whitelist de herramientas locales del desktop (2.0.0+)

Dos ítems aterrizaron del issue #512:

- **La raíz de almacenamiento por defecto del workspace es configurable en la UI.** El `base_path` de cada workspace siempre pudo definirse individualmente en Seguridad → Workspaces, pero la raíz de sandbox global de respaldo (`mateclaw.workspace.sandbox.root`, default `data/workspace`) solía requerir una edición de env var o yml. Ahora es un ajuste de **"ruta de almacenamiento por defecto del workspace"** en la consola: los archivos de conversaciones y workspaces recién creados viven bajo ella; cambiarla afecta solo creaciones futuras y **nunca migra datos existentes**.
- **La whitelist de herramientas locales del desktop soporta remoción por entrada.** La whitelist de directorios a los que las herramientas locales pueden acceder en desktop solía gestionarse con un diálogo nativo que solo ofrecía "agregar" y "deshabilitar" — la API de borrado era código muerto. Los directorios whitelisteados ahora se **listan y se pueden quitar individualmente** en la UI.

---

## Mover recursos entre workspaces

No soportado directamente. Tienes dos opciones:

1. **Exportar e importar** — algunos recursos tienen export JSON (agentes vía API, KBs wiki vía API). Re-créalos en el workspace destino.
2. **Cambiar propiedad** — un admin o dueño puede actualizar directamente la columna `workspace_id` en la base de datos para recursos simples. No está soportado oficialmente; hazlo bajo tu propio riesgo y solo con un backup.

Nos gustaría soportar el movimiento de primera clase en un release futuro. Si lo necesitas, deja una nota en el [issue de GitHub](https://github.com/mateaix/mateclaw/issues).

---

## Borrar un workspace

**Solo el dueño puede borrar un workspace.** `Ajustes → Workspaces → [workspace] → Borrar`.

Borrar un workspace:

- Borra suavemente todo recurso que le pertenezca — agentes, skills, KBs, conversaciones, archivos de memoria, canales
- Quita todas las asociaciones de miembros
- Registra un evento de auditoría

El borrado suave significa que los datos no se eliminan físicamente — se marcan `deleted = 1` y se ocultan de las consultas. Si borras por error, un admin de BD puede restaurarlo volteando la flag. Tras el período de retención configurado, los datos borrados pueden purgarse permanentemente por un job de limpieza.

---

## API de gestión de workspaces

```bash
# Listar workspaces a los que perteneces
curl http://localhost:18088/api/v1/workspaces \
  -H "Authorization: Bearer <token>"

# Obtener detalle de un workspace
curl http://localhost:18088/api/v1/workspaces/1 \
  -H "Authorization: Bearer <token>"

# Crear
curl -X POST http://localhost:18088/api/v1/workspaces \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Product Research"}'

# Actualizar
curl -X PUT http://localhost:18088/api/v1/workspaces/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description": "Descripción actualizada"}'

# Borrar (solo dueño)
curl -X DELETE http://localhost:18088/api/v1/workspaces/1 \
  -H "Authorization: Bearer <token>"

# Gestión de miembros
curl http://localhost:18088/api/v1/workspaces/1/members \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:18088/api/v1/workspaces/1/members \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 42, "role": "member"}'

curl -X DELETE http://localhost:18088/api/v1/workspaces/1/members/42 \
  -H "Authorization: Bearer <token>"

curl -X PUT http://localhost:18088/api/v1/workspaces/1/members/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## Modelo de datos

**`mate_workspace`**

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `name` | Nombre del workspace |
| `description` | Descripción corta |
| `owner_id` | ID de usuario del dueño |
| `create_time` / `update_time` | Marcas de tiempo |
| `deleted` | Flag de borrado lógico |

**`mate_workspace_member`**

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `workspace_id` | FK a `mate_workspace` |
| `user_id` | FK a `mate_user` |
| `role` | `owner` / `admin` / `member` / `viewer` |
| `create_time` / `update_time` | Marcas de tiempo |

---

## Siguiente

- [Consola de Administración](./console) — cambiador de workspace y UI
- [Seguridad y Aprobación](./security) — cómo interactúa el aislamiento de workspace con Tool Guard y File Guard
- [LLM Wiki](./wiki) — bases de conocimiento acotadas por workspace
- [Memoria](./memory) — archivos de memoria del workspace
