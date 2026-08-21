---
title: Backstage — Consola de Runtime de Admin para Visibilidad de Agentes en Vivo
description: Backstage es la vista en vivo solo-admin de todo empleado digital actualmente en el reloj. Avatares con anillo de estado, líneas de estado, detección de atascados y huérfanos basada en watchdog, stop suave, reciclaje forzado, barrer-todos e interrupción por sub-agente. Abre una URL cuando un usuario dice "el agente está atascado".
head:
  - - meta
    - name: keywords
      content: runtime de agente,consola de admin,reciclaje forzado,agente atascado,corrida huérfana,observabilidad multi-agente,limpieza de stream SSE,empleado digital,visibilidad de agentes en vivo
---

# Backstage — consola de runtime del admin

**La página que abres cuando alguien dice "mi agente está atascado".**

Un empleado digital congelado a mitad de paso es una de las pocas cosas en AuraClaw que no se arreglan solas. Los streams se cuelgan, los subagentes se abren en abanico al vacío, el buffer SSE mantiene vivo un flujo que nadie está leyendo. Backstage es la única pantalla que muestra todo eso y te deja meter la mano.

Es **solo-admin** (`ROLE_ADMIN`), en vivo (auto-refresco cada 5 s, pausable) e intencionalmente simple — una tarjeta por agente corriendo, cuatro acciones, sin menús.

---

## Dónde vive

::: tip 1.4.0: la vista en vivo se plegó en la página de Empleados
Desde v1.4.0, esta vista de runtime en vivo se pliega en la página de **Empleados**. `/backstage` ahora **redirige a** `/agents?view=live`, y la página de Empleados tiene un toggle segmentado **Plantilla / En Vivo** — "En Vivo" es la consola de runtime descrita aquí. La ruta `/backstage` de abajo sigue funcionando; solo aterriza en la vista en vivo de la página de Empleados.
:::

- **Ruta:** `/backstage` (redirige a `/agents?view=live`)
- **Barra lateral:** el segmento **En Vivo** de la página de Empleados; cuando un empleado está atascado, la barra lateral muestra un **punto naranja de "empleado atascado"** que enlaza directo a esta vista en vivo
- **Autorización:** el JWT debe llevar `ROLE_ADMIN`. Los no-admins reciben un 403 de todo endpoint `/api/v1/admin/agent-runtime/*`, y la guarda de ruta oculta el enlace de la barra lateral por completo.

---

## Qué ves

Una cuadrícula de tarjetas, una por empleado digital corriendo. El chip de auto-refresco en el encabezado de la página muestra si el feed en vivo está activo; haz clic para pausar (p. ej. cuando estás por actuar y no quieres que la tarjeta salte bajo tu cursor a mitad de clic).

Cuando nada está corriendo ves un estado vacío calmado de "todo tranquilo" — eso es una feature, no una página faltante.

### Anatomía de la tarjeta

| Elemento | Qué muestra |
|---|---|
| **Avatar con anillo de estado** | El avatar del agente dentro de un anillo de color: **verde respirando** = sano, **naranja lento** = atascado, **púrpura tenue** = huérfano |
| **Nombre del agente + dueño** | El nombre visible más `@usuario` de quien inició la corrida |
| **Línea de estado** | Una oración de estado legible (p. ej. *"Razonando sobre chunks recuperados…"*) — tomada de la última fase publicada por el runtime |
| **Chip de herramienta** | Un chip separado junto a la línea de estado que muestra la herramienta en la que el agente está actualmente, cuando hay una activa |
| **Tiempo transcurrido** | Edad legible de la corrida (p. ej. `2m 34s`) |
| **Insignia de huérfano** | Mostrada cuando `orphan && !stuckReason`. Significa que la corrida está viva en memoria pero ningún cliente está leyendo el stream |
| **Barra de progreso** | Aparece cuando `ageMs > 30 s`. Interpolación lineal en una ventana de 5 minutos — puedes detectar una corrida a la deriva de un vistazo |
| **Pila de subagentes** | Hasta 3 avatares de agentes hijo; el resto colapsa a `+N`. Haz clic en `+N` para expandir la lista |
| **Botones de acción** | Detener / Terminar / Interrumpir subagente — ver abajo |

Una franja de contadores arriba de la página resume el snapshot: **N corriendo · M atascados · K huérfanos**. Los números vienen de la misma llamada `/snapshot` que alimenta las tarjetas, así que siempre son consistentes con la cuadrícula.

---

## Acciones

Toda acción surte efecto sobre el `RunState` en memoria vivo de esa conversación, no solo sobre la fila de la base de datos.

| Acción | Endpoint | Cuándo usarla |
|---|---|---|
| **Detener** *(suave)* | `POST /api/v1/admin/agent-runtime/runs/{conversationId}/stop` | El agente sigue progresando pero quieres que se detenga tras el paso actual. Cooperativo — la corrida termina lo que esté a mitad de camino y luego sale limpiamente. |
| **Terminar** *(forzado)* | `POST /api/v1/admin/agent-runtime/runs/{conversationId}/recycle` | El agente tiene un `stuckReason`. Descarta el flujo SSE, suelta el `RunState`, libera la fila de conversación. El botón se oculta cuando la corrida no está atascada para que no lo alcances por error. |
| **Ordenar** | `POST /api/v1/admin/agent-runtime/sweep` | Recicla a la fuerza toda corrida atascada en la página. Úsalo tras una caída de proveedor para limpiar con un clic. |
| **Interrumpir subagente** | `POST /api/v1/admin/agent-runtime/subagents/{subagentId}/interrupt` | Cancela una corrida hija delegada sin tocar a su padre. El padre recibe un evento `delegation_cancelled` y decide si reintentar o rendirse. |

La página también expone el **endpoint de snapshot** de solo lectura que alimenta todo lo que ves:

```
GET /api/v1/admin/agent-runtime/snapshot
```

Devuelve conteos de corriendo / atascado / huérfano y el detalle por corrida renderizado en las tarjetas. Útil para enchufar en Grafana o tu propio dashboard de ops.

---

## Qué cuenta como atascado o huérfano

Dos condiciones distintas, dos señales distintas.

### Atascado — el runtime se rindió esperando

`stuckReason` es no-nulo en la corrida. El watchdog del runtime lo define cuando un paso sobrepasa su timeout:

| Paso | Umbral por defecto | Notas |
|---|---|---|
| Pasos cortos (chunks de razonamiento, actualizaciones de estado) | 30 s | Vitalidad a nivel de token |
| Llamada a herramienta | 150 s | Incluye herramientas integradas y MCP / ACP |
| Turno completo | 600 s | Tope end-to-end |

Los tres son configurables. Una cadena de razón típica se ve como `tool_call.timeout(150s)` o `reasoning.no_progress(30s)` para que la tarjeta pueda mostrar *por qué*, no solo *que murió*.

Cuando una corrida se atasca, el runtime deja de alimentarla pero no la desmonta — esa es tu decisión. Pulsa **Terminar** para reciclar, o espera y mira si se recupera (algunas APIs upstream toman 5+ minutos cuando están degradadas).

### Huérfano — vivo pero sin vigilancia

`orphan && !stuckReason`. La corrida sigue progresando, pero ningún cliente está leyendo el stream:

- El usuario cerró la pestaña del navegador y nunca volvió
- La app de escritorio crasheó a mitad de stream
- Un adaptador de canal externo (DingTalk, Feishu, …) perdió su sesión de webhook

Las corridas huérfanas no se matan automáticamente — pueden terminar y escribir un turno útil a la conversación de todos modos. La insignia es informativa. Recíclalas si necesitas el slot de vuelta, déjalas si no.

Una corrida puede estar atascada y huérfana a la vez; la señal de **atascado** gana y la insignia de huérfano se suprime en ese caso para que no tengas una fila confusa de dos píldoras.

---

## Una sesión típica

Un usuario te pinguea en Slack: "mi agente lleva girando 10 minutos".

1. Abre `/backstage`.
2. Encuentra su tarjeta. El anillo de estado naranja te dice que está atascado antes de que leas cualquier otra cosa.
3. Lee la línea de estado y el chip de herramienta — normalmente suficiente para ver qué era lo último que el agente estaba haciendo.
4. Si quieres ver qué lo disparó, entra a la conversación desde el enlace de la tarjeta. Si no, pulsa **Terminar**.
5. La tarjeta desaparece en el siguiente tick de refresco de 5 segundos.

Tiempo total: unos 15 segundos. Ese es todo el punto de esta página.

Si múltiples usuarios reportan lo mismo — normalmente significa que un proveedor se cayó — cambia a **Ordenar** y limpia todas las corridas atascadas con un clic en lugar de triagear individualmente.

---

## Notas operativas

- **Costo del refresco** — el endpoint de snapshot recorre un mapa en memoria. El auto-refresco a 5 s es barato; no lo bajes sin razón.
- **Auditoría** — todo Detener / Terminar / Ordenar / Interrumpir se registra vía el pipeline de auditoría estándar. Busca eventos `agent_runtime.stop`, `.recycle`, `.sweep`, `.interrupt_subagent` en `mate_audit_event`.
- **Estado vacío** — si la página está vacía durante un período conocido-ocupado, tu runtime probablemente reinició y perdió el `RunState` en memoria. Las conversaciones en sí están intactas en `mate_conversation` / `mate_message`; solo el cableado en vivo se fue.
- **Despliegues multi-replica** — `RunState` vive en la JVM que está sirviendo el stream SSE. Backstage te muestra lo que corre *en la réplica que maneja la solicitud de snapshot*. Detrás de un balanceador de carga, refresca un par de veces para ver las otras, o acota por sticky session.

---

## Siguiente

- [Consola de Administración](./console) — la SPA más amplia que aloja Backstage
- [Agentes](./agents) — qué está corriendo realmente dentro de esas tarjetas
- [Doctor](./doctor) — chequeos de salud del sistema (disco, colas, proveedores); empareja naturalmente con Backstage al triagear un incidente
- [Seguridad y Aprobación](./security) — el rastro de auditoría donde aterrizan tus acciones de Backstage
