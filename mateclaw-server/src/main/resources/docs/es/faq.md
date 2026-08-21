# FAQ

Preguntas comunes y respuestas reales. Si tu pregunta no está aquí, revisa la página de la feature relevante o abre un [issue de GitHub](https://github.com/mateaix/mateclaw/issues).

---

## Instalación y configuración

### ¿Qué versión de Java necesito?

**Java 17 o superior.** AuraClaw usa features introducidas en Java 17 (sealed classes, text blocks, records, pattern matching). Verifica con `java -version`.

Si usas la app de escritorio, **no necesitas Java instalado en absoluto** — el instalador embebe el JRE 21.

### ¿Necesito una clave de API cloud para empezar?

No. Tres caminos sin clave:

- **Ollama** — inferencia GPU local; AuraClaw lo auto-detecta en `localhost:11434` al arrancar
- **ChatGPT OAuth** — si tienes una suscripción ChatGPT Plus o Pro, inicia sesión por el flujo de navegador — tu suscripción se usa directamente, sin clave API
- **Tier gratuito de OpenRouter** — 200+ modelos gratis, una clave de OpenRouter te da acceso

**Tampoco necesitas definir ninguna clave API como variable de entorno para arrancar AuraClaw.** Toda la configuración de proveedores se hace por la UI en `Ajustes → Modelos` tras el arranque.

### ¿Cómo obtengo una clave API de DashScope?

1. Ve a la [consola de DashScope de Alibaba Cloud](https://dashscope.console.aliyun.com/)
2. Regístrate o inicia sesión
3. Crea una clave API
4. En AuraClaw, ve a `Ajustes → Modelos → DashScope` y pégala

### El backend no arranca — el puerto 18088 está en uso

Detén el otro proceso o cambia el puerto:

```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=19090"
```

La **app de escritorio elige un puerto libre dinámicamente**, así no ves este error ahí.

### Error de lock de base de datos H2 al arrancar

```bash
rm -f data/mateclaw.mv.db.lock
```

O borra el directorio de datos para empezar fresco:

```bash
rm -rf data/
```

---

## Autenticación

### ¿Cuáles son las credenciales por defecto?

Usuario `admin`, contraseña `admin123`. **Cámbiala inmediatamente en cualquier despliegue real.**

### Mi token JWT no deja de expirar

AuraClaw implementa **renovación por ventana deslizante** — cuando un token está dentro del 25% de expiración, el servidor emite uno nuevo en el encabezado de respuesta `X-New-Token`. El frontend lo maneja automáticamente.

Si llamas a la API manualmente (curl, Postman), lee el encabezado `X-New-Token` y usa el valor nuevo para solicitudes posteriores.

### ¿Cómo cambio la contraseña del admin?

Por `Ajustes → Seguridad` en la UI es el camino más fácil. O directamente en la base de datos (codificada con BCrypt):

```sql
UPDATE mate_user SET password = '$2a$10$...' WHERE username = 'admin';
```

---

## Modelos

### ¿Cómo configuro modelos?

**Todo por la UI.** `Ajustes → Modelos → Agregar Proveedor`. Elige un proveedor, pega tu clave API (o haz OAuth para ChatGPT Plus, o sáltalo para Ollama), guarda, prueba. La configuración de modelos es 100% dirigida por UI — sin bloques YAML `spring.ai.*` que editar.

Las claves API de LLM no se leen de variables de entorno — definir `DASHSCOPE_API_KEY` y similares no tiene efecto. El contenedor arranca con cero proveedores; inicia sesión y agrega el primero en la UI.

### ¿Cómo uso GPT-4 con AuraClaw?

`Ajustes → Modelos → Agregar Proveedor`. Pega tu clave API de OpenAI, o usa **OpenAI OAuth** si tienes ChatGPT Plus/Pro — se abre una ventana del navegador para que inicies sesión. Tras guardar, elige `gpt-4o` (o el modelo que sea) desde el selector de modelos.

### Los modelos de Ollama son lentos

El rendimiento del modelo local depende del hardware:

- Usa modelos más pequeños (7B en lugar de 14B) con menos RAM
- Asegúrate de que Ollama tenga acceso a GPU (`ollama ps` debería mostrar GPU)
- Sube el límite de memoria de Ollama si está disponible
- `qwen2.5:7b` o `qwen3:latest` es un buen balance velocidad/calidad

### ¿Puedo usar múltiples proveedores a la vez?

Sí. Configura múltiples proveedores y asigna configs de modelo distintas a agentes distintos. Cada agente puede usar su propio modelo — o heredar el default global. Cambia el modelo activo global en runtime sin reiniciar.

### ¿Cómo elijo un modelo barato para unos agentes y uno de razonamiento para otros?

- Pon el **modelo activo global** en tu modelo barato de propósito general (p. ej., `qwen-plus`, `gpt-4o-mini`)
- Override por agente: en un agente con mucho razonamiento, lígalo a `o3` o `qwen-max` específicamente
- El selector de modelos agrupado en el chat te deja cambiar también por conversación

---

## Herramientas y búsqueda

### ¿Cómo cambio el proveedor de búsqueda?

`Ajustes → Sistema → Servicio de Búsqueda`. Elige entre Serper, Tavily, DuckDuckGo o SearXNG. Habilita **fallback** para que los fallos caigan por la cadena. Surte efecto de inmediato.

Las opciones sin clave (DuckDuckGo, SearXNG) te dejan tener búsqueda web funcionando sin ninguna clave API.

### ¿Cómo agrego una herramienta personalizada?

Escribe un `@Component` de Spring con métodos anotados con `@Tool`:

```java
@Component
public class MyCustomTool {

    @Tool(description = "Get weather information")
    public String getWeather(@ToolParam(description = "City name") String city) {
        return "Sunny, 25C";
    }
}
```

Auto-registrada al arrancar. Ver [Herramientas](./tools).

**Si la herramienta hace algo peligroso, agrega una regla de Tool Guard para ella.**

### WebSearchTool devuelve resultados vacíos

Configura un proveedor de búsqueda en `Ajustes → Sistema → Servicio de Búsqueda`. Las opciones sin clave (DuckDuckGo, SearXNG) funcionan sin claves API.

### Tool Guard no deja de bloquear mis llamadas a herramientas

Esto es **por diseño** — las herramientas peligrosas requieren aprobación. Tres formas de aflojarlo:

1. **Agrega una regla allow específica** para el patrón exacto que necesitas (`Ajustes → Seguridad y Aprobación → Reglas de Tool Guard`). Ejemplo: `ShellExecuteTool` con patrón de args `^(ls|cat|grep|find)\s` → `allow`.
2. **Baja la política por defecto** en `application.yml`:
   ```yaml
   mateclaw:
     tool:
       guard:
         default-policy: allow   # No recomendado en producción
   ```
3. **Deshabilita Tool Guard por completo** (solo para dev):
   ```yaml
   mateclaw:
     tool:
       guard:
         enabled: false
   ```

**Seguro en producción:** mantén `default-policy: require_approval` y agrega reglas allow dirigidas para patrones específicos que confíes.

### ¿Cómo configuro servidores MCP?

`Herramientas → Servidores MCP` en la UI. Tres modos de transporte: stdio, streamable_http, sse. Los cambios de config surten efecto sin reiniciar. Ver [MCP](./mcp).

---

## LLM Wiki

### ¿Cuál es la diferencia entre Wiki y Memoria?

**El Wiki es deliberado. La memoria es pasiva.**

- **Wiki** — sueltas documentos, el sistema los digiere en páginas estructuradas, los agentes leen esas páginas. Tú lo construyes. Tú lo editas. Tú lo revisas.
- **Memoria** — se construye automáticamente como subproducto de las conversaciones. El agente extrae lo que parece memorable, consolida patrones cada noche.

Wiki para **material fuente que quieres hacer consultable** (especificaciones de producto, documentos de diseño, decisiones pasadas). Memoria para **contexto que se acumula** (tus preferencias, en qué estás trabajando).

### ¿Por qué el agente sigue adivinando cosas cuando tiene una base de conocimiento?

Porque no has ligado el agente a la KB. `Agentes → [tu agente] → Conocimiento` — liga la KB ahí. Hasta entonces, las herramientas wiki no se inyectan.

### La digestión es lenta

Ajusta `mate.wiki.digestion-concurrency` en `application.yml`. El default es 2 — súbelo a 4 u 8 si tu cuota de LLM lo permite.

---

## Memoria

### La memoria no funciona

1. **Confirma que la auto-extracción esté habilitada** — revisa `mate.memory.auto-summarize-enabled` en config
2. **Verifica que la conversación cumpla los umbrales** — `min-messages-for-summarize` (default 4), `min-user-message-length` (default 10)
3. **Revisa el enfriamiento** — el mismo agente no puede disparar extracción más de una vez cada `cooldown-minutes` (default 5)
4. **Lee los logs** — `vip.mate.memory` a nivel DEBUG muestra cada intento

### Las tareas de consolidación de memoria no corren

La consolidación la impulsan los datos semilla en `mate_cron_job`, programada para las 2 AM diarias por agente. Revisa:

- ¿`enabled` está en `1`?
- ¿Están presentes los cron jobs semilla? (`SELECT * FROM mate_cron_job WHERE task_type = 'memory_emergence'`)

### No me gusta lo que el agente recordó sobre mí

Edita `PROFILE.md` o `MEMORY.md` directamente en la vista de workspace del agente. Bloquea las páginas que editaste. Ver [Memoria](./memory).

---

## Aprobaciones

### Aprobé una llamada a herramienta pero el agente no reanudó

1. ¿`AWAITING_APPROVAL` sigue definido? (`GET /api/v1/agents/{id}`)
2. ¿La conversación en espera todavía tiene una aprobación pendiente? (`GET /api/v1/chat/{conversationId}/pending-approvals`)
3. ¿Hay errores en el log del agente alrededor del intento de re-ejecución?
4. ¿El mensaje de aprobar/rechazar pasó por la misma conversación vía `POST /api/v1/chat/stream`?
5. Si la re-ejecución falló, el agente debería mostrar un error en el chat

### Quiero aprobar en lote las futuras llamadas a herramientas de este agente

Quieres una **regla allow**, no una aprobación general. `Ajustes → Seguridad y Aprobación → Reglas de Tool Guard → Agregar Regla`.

### ¿Cuánto tiempo se quedan pendientes las aprobaciones pendientes?

30 minutos por defecto, tras lo cual expiran y se vuelven `timeout` (el agente lo trata como una denegación). El timeout se define en la config de Tool Guard en la página de Seguridad del admin, no en application.yml.

---

## Agentes

### Agente atascado en estado RUNNING

Causas comunes:

1. **Timeout de llamada a herramienta** — una herramienta está esperando un servicio externo colgado
2. **Iteraciones máximas excedidas** — el manejador `MAX_ITERATIONS_REACHED` fuerza una respuesta de mejor esfuerzo
3. **Esperando aprobación** — Tool Guard pausó la ejecución
4. **Mira los logs**:
   ```bash
   mvn spring-boot:run -Dspring-boot.run.arguments="--logging.level.vip.mate.agent=DEBUG"
   ```

### ¿Cómo sé si mi agente está usando las herramientas correctas?

Expande el **panel de pensamiento** de la interfaz de chat. Ves cada llamada a herramienta, argumentos y resultado. Si el agente está llamando a la herramienta equivocada, aprieta el prompt de sistema.

---

## Canales

### El webhook de DingTalk / Feishu no recibe mensajes

1. El servidor no es públicamente alcanzable
2. Se requiere HTTPS
3. Verification token incorrecto
4. El bot no se agregó al grupo o le faltan permisos

**Más fácil:** usa **modo stream / conexión larga / WebSocket** en lugar de webhook. DingTalk Stream, Feishu WebSocket, Telegram Long-Polling, Discord Gateway, Slack Socket mode — ninguno necesita IP pública.

### ¿Puedo usar múltiples canales a la vez?

Sí. Cada canal es independiente y se liga a un agente. Corre una consola web, un bot de DingTalk y un bot de Telegram simultáneamente, todos con agentes distintos (o el mismo — tu decisión).

### Telegram / Discord no pueden alcanzar la API (red en China)

Configura `http_proxy` en la config del canal:

```json
{
  "bot_token": "...",
  "http_proxy": "http://127.0.0.1:7890"
}
```

---

## Respaldo de datos

### ¿Cómo respaldo mis datos?

**H2 (desarrollo / escritorio):** detén, copia `./data/mateclaw.mv.db`:

```bash
cp ./data/mateclaw.mv.db ./backup/mateclaw-$(date +%Y%m%d).mv.db
```

**MySQL (despliegue auto-gestionado soportado):**

```bash
mysqldump -u root -p mateclaw > mateclaw-backup-$(date +%Y%m%d).sql
```

**Docker:**

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Los datos de **escritorio** viven en el directorio por usuario:

- macOS: `~/Library/Application Support/MateClaw/`
- Windows: `%APPDATA%/MateClaw/`
- Linux: `~/.local/share/MateClaw/`

---

## App de escritorio

### La app de escritorio no arranca

El instalador embebe el JRE 21. Revisa los logs:

- macOS: `~/Library/Logs/MateClaw/`
- Windows: `%APPDATA%/MateClaw/logs/`
- Linux: `~/.local/share/MateClaw/logs/`

Intenta lanzar desde una terminal. En Windows, clic derecho → Desbloquear. En macOS, permite la app sin firmar en Ajustes del Sistema → Privacidad.

### ¿Cómo actualizo la app de escritorio?

**Auto-actualizaciones** vía electron-updater. Al arrancar, revisa GitHub Releases y te avisa cuando hay una versión nueva. La descarga manual también está disponible en [Releases](https://github.com/mateaix/mateclaw/releases).

---

## Docker

### Los contenedores Docker no arrancan

```bash
docker compose logs mateclaw-server
docker compose logs postgres
```

Común:

- PostgreSQL aún no está listo
- El puerto público 18080 ya está en uso
- Falta `.env`, `DB_PASSWORD` o `DB_ADMIN_PASSWORD`

### ¿Cómo accedo a la base de datos en Docker?

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

---

## Depuración

### ¿Cómo habilito logging DEBUG?

```yaml
logging:
  level:
    vip.mate: DEBUG
    vip.mate.agent: DEBUG
    vip.mate.agent.graph: DEBUG
    org.springframework.ai: DEBUG
```

O:

```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--logging.level.vip.mate=DEBUG"
```

### ¿Cómo accedo a la consola H2?

1. Visita `http://localhost:18088/h2-console`
2. JDBC URL: `jdbc:h2:file:./data/mateclaw`
3. Usuario: `sa`
4. Contraseña: (vacía)

**Deshabilítala en producción.**

### ¿Cómo inspecciono los eventos de streaming SSE?

DevTools del navegador → Red → filtra `EventStream`. O:

```bash
curl -N -X POST 'http://localhost:18088/api/v1/chat/stream' \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"agentId":1, "message":"test", "conversationId":"1"}'
```

---

## Frontend

### El frontend muestra una página en blanco tras el build

```bash
cd mateclaw-ui
npm run build
ls ../mateclaw-server/src/main/resources/static/
# Debería contener index.html y archivos de assets
```

### El modo oscuro no persiste

Se almacena en `localStorage`. Limpiar los datos del navegador lo borra.

### La UI se siente lenta

- Vuelve los logs a INFO
- Revisa los ajustes de `java -Xmx`
- Haz clic en **Limpiar mensajes** en conversaciones viejas

---

## Siguiente

- [Inicio Rápido](./quickstart) — walkthrough de configuración
- [Configuración](./config) — referencia completa de configuración
- [Contribuir](./contributing) — cómo reportar bugs y solicitar features
- [Issues de GitHub](https://github.com/mateaix/mateclaw/issues) — cuando los docs no responden tu pregunta
