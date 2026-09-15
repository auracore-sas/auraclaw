# Canal de Telegram por miembro — Runbook

> Procedimiento operativo para dar a cada miembro de AuraClaw **su propio canal de
> Telegram** (su propio bot, sus propias conversaciones), sin tocar código.
>
> Decisión de producto: se eligió la **opción A** (el admin crea el canal y reasigna el
> dueño por SQL) en lugar de desarrollar self-service. Ver §8 para el porqué y sus límites.
>
> Última revisión: 2026-09-16 (verificado sobre v2.2.0, `mateclaw-server` en Docker).

---

## 1. Cómo funciona (por qué basta con SQL)

La arquitectura ya soporta múltiples canales de Telegram: cada canal guarda **su propio
`bot_token`** en `config_json`, `ChannelManager` arranca **todos** los canales habilitados, y
el liderazgo se toma por canal (`channel-leader:telegram:<id>`). No hay índice único por tipo
en `mate_channel`, así que pueden convivir tantos como hagan falta.

La pieza que hace posible el aislamiento es la personalización **V901** (`owner_username`):
`ChannelMessageRouter` pasa el dueño del canal al crear la conversación, de modo que las
conversaciones de cada bot quedan **a nombre de su dueño** y no las ven los demás.

Lo único que falta para el flujo por miembro es que **el dueño se fuerza al que llama**
(`POST /channels` hace `setOwnerUsername(auth.getName())`, y todos los endpoints de canales son
`admin`). Por eso el último paso es un `UPDATE`: no hay forma de asignarlo desde la UI.

**El cambio de dueño surte efecto sin reiniciar**: el router relee el canal de la BD a cada
mensaje.

---

## 2. Requisitos previos

Antes de empezar, necesitas **tres datos por miembro**:

| Dato | Quién lo aporta | Cómo |
|---|---|---|
| **Token del bot** | El miembro | Crear un bot con **@BotFather** en Telegram (`/newbot`) y pasar el token |
| **Su Telegram user ID** | El miembro | Escribir a **@userinfobot** y pasar el número (ej. `123456789`) |
| **Su `username` en AuraClaw** | Tú | Debe existir como usuario (Ajustes → Usuarios) |

> ⚠️ **Cada miembro necesita su propio bot.** Telegram admite **un solo consumidor** por bot
> (polling o webhook): no se puede compartir un bot entre dos canales.

Ver los usuarios existentes:

```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT id, username, nickname, role FROM mateclaw.mate_user WHERE deleted=0 ORDER BY id;"
```

---

## 3. Procedimiento

### Paso 1 — El miembro crea su bot
En Telegram: **@BotFather** → `/newbot` → nombre y usuario del bot → te comparte el **token**
(con formato `123456789:AAE...`). Que te pase también su **user ID** (vía @userinfobot).

### Paso 2 — El admin crea el canal
En AuraClaw: **Ajustes → Canales → Añadir canal**.

- **Tipo**: Telegram
- **Nombre**: algo identificable, ej. `Telegram — Pato`
- **Agente**: el empleado digital que debe responder por ese bot
- **Bot Token**: el token del paso 1
- **Modo de conexión**: `Long-Polling` (no requiere IP pública) salvo que uses webhook
- **Control de acceso** → **Usuarios Permitidos**: el **user ID de Telegram** del miembro
  (lista separada por comas; vacío = cualquiera puede usar el bot)
- **Activar** el canal

> 🔒 **No dejes `Usuarios Permitidos` vacío.** Sin esa lista, cualquier persona que encuentre
> el bot puede conversar con tu agente. Es la única barrera real: el dueño del canal solo
> controla a quién pertenecen las *conversaciones*, no quién puede hablarle al bot.

### Paso 3 — Localizar el ID del canal recién creado
```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT id, name, enabled, owner_username
     FROM mateclaw.mate_channel
    WHERE channel_type='telegram'
    ORDER BY create_time DESC LIMIT 5;"
```
El canal recién creado aparece primero y con `owner_username = admin` (es el paso 4).

### Paso 4 — Reasignar el dueño
```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "UPDATE mateclaw.mate_channel
      SET owner_username = 'ebermeo',
          update_time    = now()
    WHERE id = <ID_DEL_CANAL>;"
```

Comprobar:
```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT id, name, enabled, owner_username FROM mateclaw.mate_channel WHERE id=<ID_DEL_CANAL>;"
```

> No hace falta reiniciar el servidor. El cambio se aplica en el siguiente mensaje.

### Paso 5 — Verificación end-to-end
1. Pide al miembro que le escriba a **su** bot.
2. Debe recibir respuesta.
3. Confirma que la conversación quedó a su nombre:

```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT conversation_id, username, title, create_time
     FROM mateclaw.mate_conversation
    WHERE username = 'ebermeo'
    ORDER BY create_time DESC LIMIT 5;"
```
4. Comprueba que **no** aparece en el historial de otros usuarios.

---

## 4. Comandos de consulta útiles

```bash
# Todos los canales con su dueño
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT id, name, channel_type, enabled, owner_username
     FROM mateclaw.mate_channel ORDER BY channel_type, id;"

# Conversaciones por usuario
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "SELECT username, count(*) FROM mateclaw.mate_conversation GROUP BY username ORDER BY 2 DESC;"

# ¿Qué mensajes entraron por un canal? (útil si algo no responde)
docker logs mateclaw-server 2>&1 | grep -iE "telegram" | tail -20

# ¿El bot rechazó a alguien por la lista blanca?
docker logs mateclaw-server 2>&1 | grep -i "not in allow_from list" | tail -5
```

---

## 5. Cambios posteriores

**Reasignar a otro miembro** — repetir el paso 4 con el nuevo `owner_username`.

**Desactivar temporalmente** (sin borrar nada): Ajustes → Canales → apagar el interruptor, o
```bash
docker exec mateclaw-postgres psql -U mateclaw -d mateclaw -c \
  "UPDATE mateclaw.mate_channel SET enabled=false, update_time=now() WHERE id=<ID>;"
```
> Tras cambiar `enabled` por SQL hay que reiniciar el servidor (el toggle de la UI sí avisa al
> `ChannelManager`; un `UPDATE` directo no).

**Dar de baja definitivamente** — Ajustes → Canales → borrar el canal. Las conversaciones
históricas del miembro **se conservan** (pertenecen al usuario, no al canal).

**Volver a un único canal compartido** — poner `owner_username = NULL` hace que las
conversaciones **nuevas** vuelvan a ser del sistema y visibles para todo el workspace
(semántica original del upstream). Las conversaciones ya existentes **conservan** a su dueño
actual: el cambio no reescribe el histórico.

---

## 6. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El bot no responde | Token mal copiado, canal desactivado, o el server no lo arrancó | Revisar `enabled`; revisar logs; apagar y encender el canal desde la UI |
| El bot responde "no tienes permiso" | El user ID no está en `Usuarios Permitidos` | Añadir el ID en Control de acceso (o vaciar la lista) |
| Otro miembro ve las conversaciones | `owner_username` quedó en `admin` o `NULL` | Rehacer el paso 4 y confirmar con la consulta |
| Las conversaciones aparecen a nombre del admin | El paso 4 no se aplicó (o se aplicó a otro ID) | Verificar `owner_username` del canal |
| Telegram devuelve error de conflicto | Dos canales usando **el mismo** bot token | Cada canal debe tener su propio bot |
| El canal no arranca tras un UPDATE | El `ChannelManager` no fue notificado (solo ocurre con `enabled` por SQL) | Reiniciar el servidor |

---

## 7. Notas y limitaciones

- **El miembro no ve la página de Canales** y es lo esperado: la ruta exige la capacidad
  `manage:channels`, que solo tienen `admin`/`owner`. No la necesita: su canal funciona y sus
  conversaciones aparecen en su propio historial.
- **No concedas `manage:channels` a los miembros** para "que se gestionen solos":
  `GET /api/v1/channels` devuelve la entidad completa, **incluido `config_json` con el bot
  token**. Sin filtrado por dueño, se filtrarían los tokens de todos.
- **Un bot por persona** (límite de Telegram), y por tanto **un canal por persona**.
- **El agente es por canal**: puedes dar a cada miembro un empleado digital distinto, o el
  mismo para todos.
- **Trabajo manual por miembro**: ~5 minutos (crear canal en la UI + un `UPDATE`).
- Si algún día el volumen crece (muchos miembros, altas y bajas frecuentes), la evolución
  natural es la **opción B**: permitir que un admin especifique el dueño en el formulario y
  añadir el selector de dueño a `ChannelEditorModal`. Eso elimina el paso SQL sin abrir nada a
  los miembros.

---

## 8. Referencias

- `ChannelController` — los 11 endpoints de canales exigen `@RequireWorkspaceRole("admin")`;
  `POST /channels` fuerza `ownerUsername` al llamante (personalización V901)
- `ChannelMessageRouter` — propaga `ownerUsername` a las conversaciones (líneas ~805 y ~1253)
  y relee el canal a cada mensaje (líneas ~269-272)
- `AbstractChannelAdapter.checkAccess` — aplica `dm_policy`, `group_policy` y `allow_from`
- `docs/CUSTOMIZATIONS.md` — registro de la personalización V901 (canales individuales)
- `mateclaw-ui/src/components/channels/ChannelEditModal.vue` — sección "Control de acceso"
