# Configuración

**Tres lugares para configurar AuraClaw: `application.yml`, variables de entorno y la base de datos.**

La mayoría de los ajustes viven en `application.yml` (el archivo de config por defecto de Spring Boot), con valores sensibles sobrescritos por variables de entorno. Cualquier cosa que quieras cambiar en runtime — proveedores de modelos, claves de búsqueda, feature toggles — vive en la tabla `mate_system_setting` y se edita a través de la página de Ajustes.

Los temas profundos tienen sus propias páginas — reglas de Tool Guard en [Seguridad y Aprobación](./security), proveedores de modelos en [Modelos](./models), ajuste de memoria en [Memoria](./memory).

---

## Perfiles

| Perfil | Base de datos | Activado por |
|---------|----------|--------------|
| `default` | Archivo H2 en `./data/mateclaw` | Sin acción necesaria |
| `mysql` | MySQL 8.0+ | `spring.profiles.active=mysql` o `SPRING_PROFILES_ACTIVE=mysql` |
| `postgres` | PostgreSQL 16+ | `SPRING_PROFILES_ACTIVE=postgres` |
| `kingbase` | KingbaseES | `SPRING_PROFILES_ACTIVE=kingbase` (driver opt-in requerido) |

El stack público de Docker Compose activa `postgres`. Los builds de escritorio usan `default`; el perfil `mysql` sigue soportado para despliegues existentes o auto-gestionados.

---

## Secciones centrales de `application.yml`

### Servidor

```yaml
server:
  port: 18088                    # Puerto HTTP
  servlet:
    context-path: /
```

### Base de datos — H2 (desarrollo)

```yaml
spring:
  datasource:
    url: jdbc:h2:file:./data/mateclaw;MODE=MYSQL
    username: sa
    password:
    driver-class-name: org.h2.Driver
  h2:
    console:
      enabled: true              # Disponible en /h2-console (deshabilitar en producción)
```

### Base de datos — MySQL (despliegue auto-gestionado soportado)

```yaml
spring:
  profiles:
    active: mysql
  datasource:
    url: jdbc:mysql://localhost:3306/mateclaw?useSSL=false&serverTimezone=UTC
    username: root
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
```

### Modelo de IA — gestionado en la UI, no en YAML

::: tip
**La configuración de modelos es 100% dirigida por la UI.** No pongas bloques `spring.ai.*` en `application.yml` — todo proveedor, clave y config de modelo vive en `Ajustes → Modelos`, respaldado por las tablas `mate_model_provider` y `mate_model_config`.
:::

**Las filas de proveedor, clave y modelo en la base de datos son la configuración primaria.** En una instalación fresca, inicia sesión y agrega el primer proveedor en `Ajustes → Modelos → Agregar Proveedor`. `DASHSCOPE_API_KEY` sigue siendo un fallback de compatibilidad para la auto-configuración de DashScope, pero no reemplaza la fila del proveedor; no asumas que se leen variables de entorno equivalentes para otros proveedores. Referencia completa en [Modelos](./models).

### Virtual threads (JDK 21)

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

Habilitado por defecto. Los hilos de solicitud de Tomcat, las tareas `@Scheduled` y los métodos `@Async` corren todos en virtual threads. Las conexiones largas SSE ya no retienen hilos de plataforma, y las tareas asíncronas ligadas a I/O (extracción de memoria, auditoría, instalación de skills, etc.) ya no hacen cola detrás de un pool de 16 hilos.

### Observabilidad Spring AI

```yaml
spring:
  ai:
    chat:
      observations:
        log-prompt: false       # no escribir contenido de prompt en los spans (seguridad)
        log-completion: false   # no escribir contenido de completado en los spans
```

Cuando está habilitado, `/actuator/metrics/gen_ai.client.operation` y `/actuator/metrics/gen_ai.client.token.usage` registran automáticamente latencia y uso de tokens de toda llamada al LLM. Requiere `spring-boot-starter-actuator` (ya incluido).

### Ventana de contexto

```yaml
mate:
  agent:
    conversation:
      window:
        default-max-input-tokens: 128000
        compact-trigger-ratio: 0.75
        preserve-recent-pairs: 2
        summary-max-tokens: 300
```

Detalles en [Memoria](./memory).

### Extracción y consolidación de memoria

```yaml
mate:
  memory:
    auto-summarize-enabled: true
    min-messages-for-summarize: 4
    min-user-message-length: 10
    skip-cron-conversations: true
    summary-max-tokens: 1000
    max-transcript-messages: 30
    cooldown-minutes: 5
    emergence-enabled: true
    emergence-day-range: 7
```

### LLM Wiki

```yaml
mate:
  wiki:
    enabled: true
    max-chunk-size: 30000
    max-context-chars: 10000
    max-pages-per-raw: 15
    max-parallel-raw-materials: 3
    max-parallel-phase-b-pages: 3
    auto-process-on-upload: true
    upload-dir: ./data/wiki-uploads
```

Detalles en [LLM Wiki](./wiki).

### Tool Guard (basado en reglas)

El interruptor global de Tool Guard, la política por defecto y las reglas **no se configuran en application.yml** — viven en la base de datos (`mate_tool_guard_config` / `mate_tool_guard_rule`) y se editan desde la página de **Seguridad** del admin o vía REST:

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` / `PUT` | `/api/v1/security/guard/config` | Interruptor global + política por defecto (`allow` / `deny` / `require_approval`) |
| `GET` | `/api/v1/security/guard/rules/builtin` | Reglas integradas |
| `GET` / `POST` | `/api/v1/security/guard/rules` | Listar / crear reglas personalizadas |
| `PUT` | `/api/v1/security/guard/rules/{ruleId}` | Actualizar una regla |
| `PUT` | `/api/v1/security/guard/rules/{ruleId}/toggle` | Habilitar/deshabilitar una sola regla |

Cada regla coincide sobre nombre de herramienta + patrón de argumentos y produce una acción `allow` / `deny` / `require_approval`, ordenada por prioridad. Detalles en [Seguridad y Aprobación](./security).

### File Guard

File Guard tiene dos capas:

1. **Reglas de rutas permitidas / denegadas** — como Tool Guard, almacenadas en la base de datos y editadas desde la página de **Seguridad** del admin; REST es `GET` / `PUT /api/v1/security/guard/config/file-guard`. **No en application.yml.**
2. **Raíz de sandbox global de respaldo** — la única pieza que vive en application.yml. Cuando una conversación no tiene ruta base por workspace configurada, las herramientas de archivo/shell se confinan a esta raíz (default fail-closed):

```yaml
mateclaw:
  workspace:
    sandbox:
      enabled: true                       # pon false para restaurar el comportamiento legacy sin restricciones
      root: ${user.dir}/data/workspace    # raíz de sandbox de respaldo, creada al arrancar
```

Overrides de entorno: `MATECLAW_WORKSPACE_SANDBOX_ENABLED` / `MATECLAW_WORKSPACE_SANDBOX_ROOT`.

### Autenticación JWT

```yaml
mateclaw:
  jwt:
    secret: ${JWT_SECRET:tu-clave-secreta-de-al-menos-32-caracteres}
    expiration: 86400000
```

::: warning
Cambia el secreto JWT por defecto en producción. Debe tener al menos 32 caracteres. Usa una variable de entorno; nunca lo commitees.
:::

### Workspace de skills

```yaml
mateclaw:
  skill:
    workspace:
      root: ${user.home}/.mateclaw/skills
      auto-init: true
      delete-policy: archive
      bundled-skills-path: skills
```

### Proveedores por defecto de multimodal

```yaml
mate:
  image:
    default-provider: dashscope
  video:
    default-provider: dashscope
  tts:
    default-provider: cosyvoice
  stt:
    default-provider: paraformer
  music:
    default-provider: dashscope
```

Detalles en [Multimodal](./multimodal).

---

## Variables de entorno

::: warning Gestiona las claves LLM en la consola
Las filas de proveedor, clave y modelo en `Ajustes → Modelos` son primarias. `DASHSCOPE_API_KEY` queda solo como fallback de compatibilidad para la auto-configuración de DashScope; no asumas que se leen variables de entorno equivalentes para otros proveedores.
:::

| Variable | Requerida | Propósito |
|----------|----------|---------|
| `SERPER_API_KEY` | — | Clave de búsqueda Google Serper (las herramientas de búsqueda aún no se gestionan en UI) |
| `TAVILY_API_KEY` | — | Clave de búsqueda Tavily (igual que arriba) |
| `JWT_SECRET` | — | Secreto de firma JWT (recomendado en producción) |
| `MATECLAW_CORS_ALLOWED_ORIGINS` | — | Allowlist CORS (recomendada en producción) |
| `DB_PASSWORD` / `DB_ADMIN_PASSWORD` | Docker | Contraseñas de aplicación / bootstrap-admin de PostgreSQL (deben diferir) |
| `DB_USERNAME` / `DB_ADMIN_USERNAME` | — | Usuarios de aplicación / bootstrap-admin de PostgreSQL |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | — | Dirección, puerto y nombre de la base de datos |
| `SPRING_PROFILES_ACTIVE` | — | Docker Compose define `postgres`; los despliegues auto-gestionados pueden usar `mysql` / `kingbase` |

### Cómo definirlas

**Linux / macOS:**

```bash
export JWT_SECRET=tu-secreto-de-produccion-al-menos-32-caracteres
export SERPER_API_KEY=tu-clave-serper   # opcional
```

**Windows (PowerShell):**

```powershell
$env:JWT_SECRET = "tu-secreto-de-produccion-al-menos-32-caracteres"
```

**Docker (archivo `.env`):**

```properties
DB_PASSWORD=contraseña-segura-aqui
DB_ADMIN_PASSWORD=otra-contraseña-segura-aqui
JWT_SECRET=tu-secreto-de-produccion-al-menos-32-caracteres
```

Tras el arranque, abre `http://localhost:18080`, inicia sesión como `admin / admin123`, y agrega tu primer proveedor LLM en `Ajustes → Modelos → Agregar Proveedor`.

---

## Inicialización del esquema de base de datos

AuraClaw usa **Flyway** para las migraciones de esquema:

1. `db/migration/h2/V*__*.sql` — scripts de migración con dialecto H2
2. `db/migration/mysql/V*__*.sql` — scripts de migración con dialecto MySQL
3. Tras las migraciones, los datos semilla se cargan desde `db/data-*.sql` — idempotente

Flyway auto-selecciona la ruta de dialecto correcta según el perfil Spring activo. Cada arranque corre un `repair` antes de `migrate`, auto-curando el desvío de checksums y las migraciones parcialmente fallidas (especialmente importante para usuarios de escritorio actualizando offline).

### Convenciones de tablas

- Todas las tablas con prefijo `mate_`
- Columnas `snake_case`, campos Java `camelCase` (auto-mapeados por MyBatis Plus)
- Toda tabla tiene `create_time`, `update_time`, `deleted`
- Borrado lógico: `deleted = 0` activo, `deleted = 1` borrado suave

### Consola H2 en dev

[http://localhost:18088/h2-console](http://localhost:18088/h2-console):

| Campo | Valor |
|-------|-------|
| JDBC URL | `jdbc:h2:file:./data/mateclaw` |
| Usuario | `sa` |
| Contraseña | *(vacía)* |

### Cambiar a MySQL

```sql
CREATE DATABASE mateclaw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
export SPRING_PROFILES_ACTIVE=mysql
export DB_PASSWORD=tu-contraseña
mvn spring-boot:run
```

---

## Ajustes de runtime (`mate_system_setting`)

Cosas que quieres cambiar sin reiniciar:

| Clave | Tipo | Propósito |
|-----|------|---------|
| `default_agent_id` | Long | Agente usado cuando no se especifica ninguno |
| `default_model_config_id` | Long | Configuración de modelo por defecto |
| `max_conversation_turns` | Integer | Máximo de turnos por conversación |
| `enable_memory` | Boolean | Habilita la extracción de memoria |
| `search_enabled` | Boolean | Toggle global de búsqueda web |
| `search_provider` | String | `serper` / `tavily` / `duckduckgo` / `searxng` |
| `search_fallback_enabled` | Boolean | Cae al siguiente proveedor ante fallo |
| `serper_api_key` | String | Clave Serper (enmascarada en UI) |
| `tavily_api_key` | String | Clave Tavily (enmascarada en UI) |
| `language` | String | Idioma de UI por defecto `zh-CN` / `en-US` / `es-ES` |
| `stream_enabled` | Boolean | Salida en streaming SSE |
| `debug_mode` | Boolean | Muestra info extra de debug en la UI |

Todo editable desde `Ajustes → Sistema`. Los cambios surten efecto de inmediato.

### Configuración del servicio de búsqueda

La config de búsqueda web se migró de `application.yml` a la página de **Ajustes del Sistema**. Los cambios surten efecto de inmediato sin reiniciar.

::: tip
Las claves API se muestran enmascaradas. Al guardar, las claves solo se sobrescriben cuando se ingresa un valor nuevo. Entrada en blanco significa "conservar la clave existente".
:::

---

## Logging

```yaml
logging:
  level:
    vip.mate: INFO
    vip.mate.agent: DEBUG
    vip.mate.agent.graph: DEBUG
    org.springframework.ai: INFO
    root: INFO
```

Para depuración profunda, pon `vip.mate: TRACE`. El volumen de logs es alto — no lo dejes encendido en producción.

---

## CORS

Desarrollo: el servidor de dev de Vite maneja CORS vía su proxy. Producción: el frontend está embebido en el JAR, no se necesita CORS.

Si despliegas el frontend por separado:

```yaml
mateclaw:
  cors:
    allowed-origins:
      - http://localhost:5173
      - https://tu-dominio.com
```

---

## Precedencia de configuración

Los ajustes se resuelven en este orden (mayor prioridad primero):

1. **Variables de entorno**
2. **Argumentos de línea de comandos** (`--server.port=9090`)
3. **`application-{profile}.yml`**
4. **`application.yml`**
5. **Base de datos `mate_system_setting`** (para valores configurables en runtime)

---

## Siguiente

- [Modelos](./models) — config de proveedores y modelos en detalle
- [Seguridad y Aprobación](./security) — JWT, Tool Guard, File Guard, log de auditoría
- [Memoria](./memory) — parámetros de ajuste de memoria
- [LLM Wiki](./wiki) — el bloque `mate.wiki` explicado
- [Canales](./channels) — configuración específica de canales
