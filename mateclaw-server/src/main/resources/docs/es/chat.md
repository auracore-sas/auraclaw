# Chat y Mensajería

El chat es donde realmente trabajas. Todo lo demás en AuraClaw — agentes, herramientas, memoria, wiki, canales — existe para que lo que pasa dentro de esta caja sea bueno.

Esta página trata de lo que esa caja realmente hace. No del endpoint REST. No del esquema de eventos SSE. Lo que ves, lo que hace por ti y por qué el diseño de interacción es como es. (La parte de API está al final, para integradores que la necesiten).

---

## Lo que ves

Tú escribes. El agente piensa. Los tokens empiezan a fluir. Tú observas.

Pero no es solo un muro de texto que vuelve. Una única respuesta del asistente está compuesta de **segmentos**, y cada segmento tiene un tipo:

- **Pensamiento** — el razonamiento interno del agente, mostrado en un panel colapsado que puedes abrir. Oculto por defecto por brevedad, un clic para expandir. Se conserva incluso si la red se corta a mitad de turno.
- **Llamada a herramienta** — una tarjeta que muestra el nombre de la herramienta, sus argumentos y (cuando termina) su resultado. Estilo ChatGPT, en línea con la conversación, no escondida detrás de un panel de depuración.
- **Contenido** — el texto de la respuesta en sí, fluyendo token a token.
- **Adjuntos** — imágenes, videos, música, clips TTS generados — ligados al mensaje que los produjo, no flotando en una burbuja nueva.

Los segmentos llegan progresivamente. Se persisten en la base de datos en tiempo real — es decir, si refrescas la página a mitad de una respuesta, no pierdes lo ya renderizado. Si el backend muere y reinicia, la respuesta parcial sigue ahí cuando vuelve.

Antes esto no era cierto. Ahora sí.

Las referencias en la respuesta también son vivas: los enlaces wiki `[[slug]]` y los **marcadores de citas** `[1]` / `[2]` que aparecen cuando el agente responde desde una base de conocimiento son clicables — cada uno navega directamente a la página wiki correspondiente. Cada línea de la lista "Fuentes:" al final de una respuesta también es totalmente clicable. Ver [LLM Wiki · Clic desde el chat](./wiki).

---

## La lista de tareas, para planes que toman tiempo

Cuando pides algo que dispara **Plan-and-Execute**, aparece una lista de tareas persistente junto a la conversación. Muestra:

- El plan actual (2–6 pasos, generado por el agente antes de que empiece la ejecución)
- El estado en vivo de cada paso: `pending → running → done` (o `failed`)
- La salida de cada paso, capturada mientras el agente ejecuta
- Un resumen compacto cuando el plan termina

La lista de tareas sobrevive al refresco de página. Sobrevive a navegar fuera y volver. Sobrevive a fallos en la generación del plan. Si un plan explota a mitad de vuelo, ves *cuál* paso explotó y por qué — no un spinner en blanco que nunca se resuelve.

Usa Plan-and-Execute cuando la tarea necesita varios pasos ordenados y quieres ver el trabajo suceder. Usa ReAct para todo lo más pequeño.

---

## Resumen de Ejecución: ve la tarea larga completa de un vistazo

Las tareas largas (planes multi-paso, colaboración multi-agente) antes significaban hacer scroll arriba y abajo por el flujo de mensajes para seguir el progreso. La vista de chat ahora tiene un **Resumen de Ejecución** siempre visible en un panel lateral derecho que reúne en un solo lugar los datos que el backend ya emite — sin volver a hacer scroll:

- **Progreso del plan** — en modo Plan, estado por paso en vivo (pendiente / en ejecución / completado) y un contador de progreso, con resultados de paso expandibles. Un marcador "planificando…" aparece antes de que el plan llegue por streaming, para que el panel no parpadee.
- **Estado en vivo de sub-agentes** — los sub-agentes delegados se renderizan como un **árbol** en vivo: nombre, herramientas llamadas, estado en ejecución / completado / error / estancado; la delegación multi-nivel se expande capa por capa.

El panel **se colapsa a una franja con insignia**; por debajo de 1280px se degrada a un **cajón flotante** para nunca apretar la columna de conversación. Es frontend puro sin endpoints nuevos, reutilizando el flujo de eventos SSE existente — así que el árbol de delegación sigue apareciendo en línea en el mensaje también; el panel simplemente eleva el resumen "actual / activo" a un lugar persistente.

---

## Pensamiento, llamadas a herramientas y en qué confiar

Una de las preguntas que AuraClaw intenta responder con su UI de chat es: **¿deberías confiar en lo que la IA te acaba de decir?** La respuesta por defecto en otros lados es "mira la respuesta y adivina". AuraClaw intenta hacerlo mejor.

**El pensamiento es visible.** Si el razonamiento del agente fue descuidado, puedes expandir el panel de pensamiento y verlo. Si se saltó un paso, está ahí. Si alucinó un dato antes de corregirse, puedes verlo corregirse.

**Las llamadas a herramientas son visibles.** Ya sea que el agente busque en la web, lea un archivo o consulte el Wiki — por cada llamada a herramienta ves la consulta, el resultado y cómo la usó el agente. Nada queda oculto en una caja de "confía en mí".

**Las pistas de fase son visibles.** Arriba de una respuesta en streaming, un pequeño indicador muestra la fase actual — *pensando*, *buscando*, *leyendo*, *generando*, *resumiendo*. Nunca te quedas mirando un spinner preguntándote si el agente está vivo.

La confianza se gana mostrando el trabajo. AuraClaw muestra el trabajo.

**Visor de detalles de plan de ejecución y llamadas a herramienta (1.5.0).** Cada paso del plan y cada fila de llamada a herramienta tiene un icono de "ver detalles" a la derecha. Haz clic para abrir un diálogo de cristal esmerilado que muestra los **argumentos completos de la solicitud y la salida de la respuesta** — las partes que la vista previa en línea trunca — con botones de copiar para solicitud y respuesta, y una insignia de estado (en progreso / completado / fallido / pendiente). Los datos viven en los metadatos del mensaje, así que los pasos del plan y las llamadas a herramientas siguen siendo legibles tras recargar la página.

---

## Sincronización multicanal en tiempo real

La ChatConsole no es solo donde chateas. Es una **consola de operaciones**.

- **Sincronización en tiempo real para canales externos** — un usuario de WeChat habla con tu agente, y ves el razonamiento, las llamadas a herramientas y la respuesta en streaming en la barra lateral de la ChatConsole. Sin refrescar. Sin esperar.
- **Indicador de ejecución** — las conversaciones con una corrida de agente activa muestran un pulso ámbar en su icono. Ves de un vistazo qué está vivo.
- **Cambiar no mata** — cambia a otra conversación a mitad de stream; la anterior sigue corriendo en segundo plano. Vuelve a cambiarte y reconéctate al buffer en vivo. Ni un solo token perdido.
- **Sin burbujas duplicadas** — la capa de reconciliación empareja los placeholders de client-uuid con los mensajes persistidos en BD mediante promoción de IDs. Los mensajes no parpadean convertidos en duplicados.
- **Tarjetas de error accionables** — "does not support tools" de Ollama ya no es "error desconocido". Recibes orientación específica: "cambia a qwen3 / qwen2.5:7b+ / llama3.1:8b+".

---

## Adjuntos y subida de archivos

Tres formas de darle un archivo al agente:

| Método | Comportamiento |
|--------|----------|
| **Clic** en el botón de adjuntar | Abre un selector de archivos; selecciona uno o varios archivos |
| **Pegar** desde el portapapeles (Ctrl/Cmd+V) | Pega imágenes o archivos copiados de otras apps |
| **Arrastrar y soltar** en el área de chat | Aparece una superposición translúcida; suelta en cualquier parte |

Suelta una **carpeta** en la app de escritorio y el agente recibe una referencia a la ruta absoluta de la carpeta — luego puede recorrerla con la herramienta de lectura de archivos o la de shell. Suelta una carpeta en la web y AuraClaw la expande recursivamente y sube cada archivo individualmente.

Límites de subida, por defecto:

| Ajuste | Por defecto |
|---------|---------|
| Tamaño máximo de archivo | 100 MB |
| Tamaño máximo de solicitud | 200 MB |
| Tipos permitidos | Todos |

Las imágenes entregadas a un modelo con capacidad de visión se adjuntan para comprensión visual. Los PDF y DOCX pasan por extracción de texto (con OCR de respaldo para material escaneado). Todo lo que el agente lee aterriza en su contexto para ese turno.

::: tip Archivos generados por herramientas: los enlaces de descarga sobreviven a los reinicios (1.5.0, #243)
Los archivos que un trabajador genera vía herramientas (documentos / imágenes / audio…) ahora se **persisten en disco** bajo `data/generated-files/`, con una ventana de retención de 7 días + una limpieza cada 6 horas y un LRU en memoria encima — los enlaces de descarga siguen funcionando después de un reinicio y ya no están limitados por la vieja ventana de 10 minutos en memoria. El frontend intercepta las descargas de `/api/v1/files/generated/{id}` mediante un delegador global de clics: el éxito pasa por un fetch autenticado → descarga de blob; el fallo (404/410/expirado) solo muestra un toast, **así un enlace muerto ya no bloquea toda la página**.
:::

### Vista previa en el navegador: Office / PDF / HTML / texto sin descargar (2.0.0+)

Imágenes, audio/video y modelos 3D siempre se previsualizan en línea — pero un reporte Word generado por el agente era solo un botón de descarga: para echarle un vistazo tenías que descargar, encontrar el archivo y abrir una app local. Ahora **los adjuntos de documentos se abren directamente en el chat**:

- **Clic para previsualizar**: archivos pdf / docx / xlsx / html / markdown / txt / código se abren en una capa de vista previa estilo cristal desde la tarjeta del adjunto — subidos y generados por IA por igual.
- **Renderizado 100% del lado del cliente**: PDF, Word y Excel se parsean y renderizan en el navegador — nada sale de tu máquina, sin servicio externo de previsualización, la historia de empaquetado de un solo JAR y de escritorio no cambia.
- **Respaldo de servidor para los formatos tercos**: pptx y Office binario legacy (doc / xls / ppt) se convierten a PDF del lado del servidor antes de previsualizar; si el conversor (LibreOffice) no está presente, se degradan elegantemente a descarga — sin error, sin cuelgue.
- **Vista previa segura de HTML**: se renderiza en un iframe aislado — las páginas interactivas y los gráficos funcionan de lleno (los scripts se ejecutan), pero el iframe vive en un origen opaco y no puede leer el estado de login ni el almacenamiento local de la app.

### ¿El modelo principal no ve imágenes? Enrutamiento con "sidecar multimodal"

::: tip Añadido en 1.3.0
Cuando el modelo principal del agente es solo texto (p. ej. `deepseek-chat`, `kimi-k2`), subir una imagen ya no se rompe. El runtime enruta automáticamente a través de un sidecar. Ver [issue #87](https://github.com/mateaix/mateclaw/issues/87).
:::

Cómo funciona:

1. Configuras un **modelo sidecar de visión** en **Ajustes → Modelos → Sidecar multimodal** (p. ej. `glm-4v`, `qwen-vl-max`).
2. En cada subida, el enrutador verifica si el modelo principal soporta visión:
   - **Sí** → toma la ruta multimodal nativa existente; los bytes crudos de la imagen van al modelo principal.
   - **No** → el sidecar entra en acción. El modelo de visión describe la imagen una vez, la descripción se pliega de vuelta en el texto del mensaje del usuario, y el modelo principal responde como si hubieras escrito esas palabras.

El chat principal sigue siendo barato (una llamada al modelo de visión por imagen subida, flujo de conversación sin cambios). Y — importante — **tus herramientas personalizadas ya no están bloqueadas**: antes el prompt de sistema forzaba una instrucción de "no llames a ninguna herramienta" cuando un adjunto no podía consumirse de forma nativa. Esa prohibición dura ya no existe. Con una herramienta capaz de manejar medios ligada al agente, el LLM ahora puede elegir delegarle.

Toda la decisión de enrutamiento es **totalmente visible**:

- **Pista sobre la caja de entrada**: pegar una imagen muestra inmediatamente "se enrutará a xxx (modo sidecar)".
- **Insignia de enrutamiento en la burbuja del asistente**: la fila de acciones recibe un chip `🔀 enrutado-a-xxx (imagen)`; pasa el cursor para ver detalles de principal / sidecar / proveedor.
- **Atribución por mensaje**: cada respuesta muestra qué modelo la sirvió realmente. Antes una caja negra, ahora una caja de cristal.

> **Límite actual (v1)**: solo sidecar de imágenes. Los adjuntos de video todavía requieren cambiar a un modelo principal con capacidad de video o ligar una herramienta de video personalizada (que ya no se suprime). El sidecar de video está en cola para la próxima iteración.

---

## Cómo fluyen realmente los mensajes

Esta es la versión de treinta segundos. La versión de noventa segundos está en [Agentes](./agents).

```
Tú escribes
   │
   ▼
POST /api/v1/chat?agentId={id}                ← o SSE para streaming (POST /api/v1/chat/stream)
   │
   ▼
Administrador de Conversaciones               ← carga/crea conversación, anexa el mensaje del usuario
   │
   ▼
Motor de Agentes                              ← bucle ReAct o grafo Plan-and-Execute
   │     ┌──► ensamblado de ventana de contexto: prompt de sistema + archivos del workspace + historial
   │     ├──► llamadas a herramientas (custodiadas por Tool Guard; pueden pausar por aprobación)
   │     ├──► lecturas del wiki (si está ligado a una base de conocimiento)
   │     └──► escrituras de memoria (asíncronas, tras terminar el turno)
   │
   ▼
Stream SSE / respuesta directa                ← entrega segmento por segmento
   │
   ▼
Persistir en mate_message                     ← en tiempo real, segmento por segmento
```

Lo que hay que notar: **la persistencia es sincrónica con el streaming**. Los segmentos aterrizan en la base de datos a medida que llegan del LLM, no en una única escritura al final. Por eso refrescar a mitad de stream no se come tu respuesta.

---

## Conversaciones

Una conversación es una secuencia de mensajes acotada a un solo agente y un solo usuario. AuraClaw las almacena en dos tablas:

**mate_conversation**

| Columna | Propósito |
|--------|---------|
| `id` | ID de conversación |
| `user_id` | Dueño |
| `agent_id` | Contra qué agente corre esta conversación |
| `title` | Auto-generado desde el primer mensaje del usuario (editable) |
| `create_time` / `update_time` | Marcas de tiempo |

**mate_message**

| Columna | Propósito |
|--------|---------|
| `id` | ID de mensaje |
| `conversation_id` | Conversación padre |
| `role` | `user` / `assistant` / `system` / `tool` |
| `content` | Texto completo del mensaje (para respuestas segmentadas: el contenido final concatenado) |
| `segments` | Arreglo JSON de segmentos (thinking, tool_call, tool_result, content), para visualización progresiva |
| `tool_calls` | Arreglo JSON de llamadas a herramientas hechas por el asistente |
| `tool_call_id` | Para mensajes de rol tool, la llamada que satisfacen |
| `create_time` | Marca de tiempo |

La representación por segmentos es lo que impulsa la visualización progresiva. También hace de la base de datos la fuente de verdad — la UI puede reconstruir cualquier respuesta pasada exactamente como se veía mientras fluía.

### Rebobinar y regenerar (2.0.0+)

Dos acciones de alta frecuencia ganaron **semántica del lado del servidor** en 2.0.0 — se acabó la prestidigitación de frontend:

- **Rebobinar hasta aquí**: trunca la conversación de vuelta hasta un mensaje — todo lo posterior se borra de verdad en la base de datos y los agregados de la conversación (cantidad de mensajes, resumen del último mensaje) se recalculan. Refresca la página o abre desde otro cliente y ves el estado rebobinado; las respuestas "borradas" no resucitan.
- **Regenerar**: borra la respuesta del asistente al final y **reutiliza el mensaje original del usuario** para la re-ejecución — no se inserta una fila de usuario duplicada. Antes cada regeneración agregaba una pregunta duplicada a la base de datos mientras la respuesta vieja rondaba el historial; ahora el historial queda limpio y consistente entre refrescos.

La misma semántica cubre la consola de administración, el widget de WebChat y la API — las tres entradas se comportan idéntico. Una conversación con un stream en vuelo se niega a rebobinar primero, para que un turno en escritura activa nunca se trunque.

### Selección de modelo por conversación

::: tip Añadido en 1.4.0
El selector de modelo en el encabezado del chat ahora liga un modelo **a la conversación**, no como un interruptor global. Ver [issue #150](https://github.com/mateaix/mateclaw/issues/150).
:::

Cambiar el modelo en el encabezado afecta **solo a esta conversación**: la elección se almacena en la conversación y entra en vigor a partir del **siguiente mensaje**. Una conversación que nunca configuraste explícitamente cae al modelo por defecto del workspace. El indicador de modelo del runtime se mantiene sincronizado con lo que esté fijado en la conversación — lo que ves es lo que el siguiente turno realmente usa.

Este aislamiento también hace la configuración de modelos más robusta: **un solo id de modelo malo ya no tumba a todo su proveedor**. La conversación rota solo se afecta a sí misma; todo lo demás sigue corriendo.

### Gestión de la lista de conversaciones

::: tip Añadido en 1.4.0
La barra lateral de conversaciones creció de una simple lista de historial a un panel de operaciones accionable. Ver [issue #144](https://github.com/mateaix/mateclaw/issues/144).
:::

- **Fijar / desfijar** — desde el menú `⋮` de desbordamiento de cada fila. Los hilos importantes quedan arriba en un grupo "Fijadas".
- **Borrado masivo multi-selección** — entra al modo multi-selección y aparece un checkbox en cada fila; marca varias y bórralas de una vez.
- **Filtrar por empleado** — cuando el workspace tiene **2 o más empleados**, aparece un desplegable arriba de la barra lateral para filtrar la lista por empleado (oculto con un solo empleado, para que no haya un control inútil).
- **Puntos de estado** — lee el estado de cada conversación de un vistazo: generando actualmente (pulso azul), un objetivo activo en progreso, o contenido sin leer.

### Atajos de teclado globales

::: tip Añadido en 1.4.0
Dos atajos globales te dejan saltar entre conversaciones sin tocar el mouse. La pista vive en el pie de la barra lateral.
:::

| Atajo | Acción |
|----------|--------|
| `Ctrl/Cmd + K` | Abre el selector de empleados para saltar a cualquier chat |
| `Ctrl/Cmd + N` | Inicia una conversación nueva |

`Ctrl+N` no se dispara mientras escribes en un input o textarea — su comportamiento nativo se deja intacto.

### Página de Administración de Sesiones

::: tip Añadido en 1.4.0
Cuando las conversaciones desbordan la barra lateral, llega a una página de administración dedicada desde el menú de desbordamiento del encabezado del chat ("Admin. de Sesiones"), en `/sessions`.
:::

Esta página existe para el caso de "muchas conversaciones":

- **Paginación del lado del servidor** — se acabó apretar miles de conversaciones en la barra lateral.
- **Buscar por título o ID** — filtra mientras escribes para localizar una conversación específica.
- **Diseño de tarjetas con profundidad** — una tarjeta por conversación, más densa que la barra lateral.
- **Chip de modelo editable en línea** — cada fila muestra y cambia el modelo de esa conversación directamente, sin entrar en ella primero.
- **Botón de volver** — un clic te devuelve a la consola de chat.

### Selector de empleados compartido

::: tip Añadido en 1.4.0
Un único diálogo selector compartido se reutiliza en tres lugares: la barra lateral, el atajo `Ctrl+K` y el modal de conversación nueva.
:::

Los tres puntos de entrada abren el **mismo diálogo** con comportamiento idéntico. Los iconos de agente dentro de él están **codificados por color según el empleado**, para que en un workspace multi-empleado distingas quién es quién de un vistazo.

---

## Gestión de la ventana de contexto

En cada turno, AuraClaw arma el prompt que realmente va al LLM. Aproximadamente:

1. **Prompt de sistema** — las instrucciones del agente
2. **Inyección de archivos del workspace** — `AGENTS.md`, `SOUL.md`, `PROFILE.md`, `MEMORY.md` (solo archivos `enabled=true`)
3. **Resumen de conversación** — si turnos anteriores fueron comprimidos
4. **Turnos recientes** — tantos como quepan en el presupuesto de tokens
5. **Mensaje actual del usuario** — siempre al final

La ventana sale del propio modelo: primero el `maxInputTokens` de la config del modelo, luego una ventana sondeada desde un servidor de inferencia local, luego la tabla integrada de ventanas de modelos conocidos (DeepSeek V4, Gemini, Claude, Kimi K2, …). Solo cuando las tres salen vacías cae al `defaultMaxInputTokens` global.

Cuando el total excede `window × compactTriggerRatio` (por defecto global 128000 × 0.75 = 96000), el sistema llama al LLM para resumir los turnos anteriores, cachea el resultado por 30 minutos y envía una versión compacta. Si el LLM todavía devuelve un error `context_length_exceeded`, entra el recorte de emergencia: descarta mensajes más viejos sin llamar al LLM, conserva los dos últimos turnos.

Más detalle, y la razón de seguridad para inyectar resúmenes como `UserMessage` en lugar de `SystemMessage`, está en [Memoria](./memory).

---

## Multicanal: el mismo agente, en todas partes

Canales distintos usan transportes distintos, pero el agente debajo es el mismo. Mismo prompt de sistema. Mismas herramientas. Misma memoria.

| Canal | Transporte | Streaming |
|---------|-----------|-----------|
| Web | SSE | Sí |
| DingTalk | Stream (WebSocket) / Webhook | Sí (AI Card) |
| Feishu (Lark) | WebSocket / Webhook | No |
| WeChat Work (WeCom) | Conexión larga / Webhook | No |
| WeChat Personal | HTTP long polling | No |
| Telegram | Long-Polling / Webhook | Indicador de escribiendo |
| Discord | Gateway WebSocket | Indicador de escribiendo |
| QQ | WebSocket / Callback | No |
| Slack | Webhook / Socket mode | No |

Profundiza en [Canales](./channels).

---

## Referencia de API (para integradores)

### Enviar un mensaje

```bash
curl -X POST 'http://localhost:18088/api/v1/chat?agentId=1' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the current time in Tokyo?",
    "conversationId": "conv-abc123"
  }'
```

Omite `conversationId` para iniciar una conversación nueva. `agentId` es un parámetro de consulta, **no** un segmento de ruta.

### Streaming SSE

El endpoint SSE es `POST /api/v1/chat/stream` con `agentId` en el cuerpo JSON. El `EventSource` nativo del navegador solo soporta GET, así que los integradores deben usar `fetch()` y leer el flujo de respuesta:

```javascript
const resp = await fetch('/api/v1/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  },
  body: JSON.stringify({
    agentId: 1,
    message: 'What is the current time in Tokyo?',
    conversationId: 'conv-abc123',
  }),
});

const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  // Divide en los límites de evento SSE `\n\n` y despacha segmentos
}
```

Ver `mateclaw-ui/src/composables/chat/useChat.ts` para una implementación cliente completa.

### Tipos de eventos SSE

| Evento | Significado |
|-------|---------|
| `phase` | Cambio de fase — `thinking`, `action`, `observation`, `summarizing` |
| `message` | Un trozo de contenido — anexar al segmento de contenido actual |
| `thinking` | Un trozo de pensamiento — anexar al segmento de pensamiento |
| `tool_call_start` | El agente está invocando una herramienta (nombre + argumentos) |
| `tool_call_end` | La herramienta terminó (resumen del resultado) |
| `plan_created` | Plan-and-Execute generó un plan |
| `step_start` / `step_end` | Límites de paso de Plan-and-Execute |
| `approval_required` | Una llamada a herramienta custodiada necesita aprobación humana |
| `_usage_final` | Estadísticas de uso de tokens (fin del stream) |
| `done` | Stream completo |
| `error` | Algo salió mal |

### Gestión de conversaciones

```bash
# Listar
curl http://localhost:18088/api/v1/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Obtener mensajes
curl http://localhost:18088/api/v1/conversations/conv-abc123/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Borrar
curl -X DELETE http://localhost:18088/api/v1/conversations/conv-abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Visibilidad del pensamiento y trayectorias lineales (2.1.0+)

2.1.0 convierte el pensamiento de un bloque ambiguo en segmentos ordenados por ejecución:

- el contenido inline `<think>` se extrae en vivo y se mantiene separado de la respuesta final;
- cada iteración ReAct se queda donde ocurrió, para que las llamadas a herramientas y observaciones no deriven a la ronda siguiente;
- marcas de tiempo reales de inicio/fin producen retroalimentación real de duración y fase;
- los administradores de workspace usan "Mostrar pensamiento" para controlar el renderizado y "Mostrar todas las iteraciones" para alternar entre todas las rondas y solo la ronda que produce la respuesta;
- `mate.agent.reasoning.retention=all|terminal` controla la persistencia del lado del servidor;
- el dueño de una conversación puede pedir `GET /api/v1/conversations/{conversationId}/trajectory` para una exportación en texto plano de la entrada del usuario, el razonamiento, las llamadas a herramientas, las observaciones y la respuesta final en orden de ejecución. Las duraciones salen de los límites de los segmentos y aparecen en la UI; la exportación de texto actual no las incluye.

La narración provisional antes de una llamada a herramienta pasa a `superseded` cuando llega la salida real. La UI de chat actual la renderiza en línea, mientras que la salida de trayectoria la preserva con `content superseded="true"`. Los anuncios intermedios de Team Run se pliegan en la tarjeta de corrida en lugar de convertirse en respuestas finales repetidas.

### Borrado masivo de conversaciones

Las sesiones pueden borrar en lote hasta 200 conversaciones seleccionadas. El servidor deduplica los ids, verifica la propiedad por ítem y borra solo las conversaciones que el usuario actual puede operar. Las conversaciones `team_worker` quedan fuera de la barra lateral normal, así que no aparecen en la selección masiva de la barra lateral.

---

## Siguiente

- [Agentes](./agents) — qué es lo que realmente piensa
- [Memoria](./memory) — qué persiste entre conversaciones
- [Canales](./channels) — todos los demás lugares donde el chat puede ocurrir
- [LLM Wiki](./wiki) — qué puede leer el agente mientras responde
