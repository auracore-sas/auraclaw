# Despliegue con Docker

El único despliegue de producción recomendado fuera de la app de escritorio. Un solo `docker compose up -d` levanta tres contenedores: PostgreSQL, SearXNG y mateclaw-server.

> **⚠️ Actualizando desde el stack MySQL**: el stack Docker cambió de MySQL a PostgreSQL 16. Traer este cambio y correr `up -d` en un host existente arranca un **volumen PostgreSQL fresco y vacío** — el viejo volumen `mysql_data` no se lee (los datos no se pierden, pero el stack nuevo no puede verlos). Para llevar los datos, haz `mysqldump` del stack viejo primero e impórtalo en PostgreSQL con una herramienta multi-motor como pgloader; o quédate en un tag anterior al cambio para seguir con MySQL (el perfil Spring `mysql` sigue soportado).

Esta página cubre **requisitos, pasos, verificación y trampas comunes**. Para la referencia completa de variables de entorno, ver [Configuración](./config).

---

## Prerrequisitos

| Ítem | Mínimo | Recomendado | Notas |
|---|---|---|---|
| Docker Engine | 24.0+ | latest stable | `docker --version` |
| Docker Compose | v2.20+ | v2.30+ | `docker compose version` (el plugin v2, no el legacy `docker-compose`) |
| RAM del host | 4 GB | 8 GB+ | Chromium consume 1-2 GB cuando la herramienta de navegador está activa |
| Disco | 6 GB | 20 GB+ | ~2 GB de imagen + datos de PostgreSQL + archivos de workspace |
| /dev/shm | default | compose define 2 GB automáticamente | Chromium usa memoria compartida para renderizado; el default de 64 MB causa SIGBUS |
| Red | saliente | — | para traer imágenes y llamar APIs de LLM |

**No se requiere en el host**: Java, Node, Maven, Chrome o Python — todo vive dentro de la imagen.

---

## Los tres contenedores

| Servicio | Imagen | Rol | Puerto expuesto |
|---|---|---|---|
| `postgres` | `postgres:16` | Datos de negocio | solo red de compose (sin puerto de host por defecto) |
| `searxng` | Construida desde `./docker/searxng/` | Fallback de búsqueda sin clave | `8088` |
| `mateclaw-server` | Construida desde `mateclaw-server/Dockerfile` | Backend Spring Boot + navegador embebido | `18080` |

---

## Servicio de búsqueda SearXNG

### Por qué construimos una imagen propia

`docker/searxng/Dockerfile` deriva del upstream `searxng/searxng:latest` y **hornea nuestro propio `settings.yml` en `/etc/searxng/settings.yml`**. No es pulido — es obligatorio:

- **El upstream viene con solo la salida `html` habilitada**, mientras mateclaw llama `GET /search?q=...&format=json`. La imagen por defecto responde a las solicitudes JSON con una página de error HTML, `SearXNGSearchProvider` falla al parsearla, devuelve resultados vacíos y la UI muestra "búsqueda temporalmente no disponible".
- **El upstream habilita el plugin anti-bot Limiter por defecto**, que rechaza llamadas del lado del servidor (sin JS, sin cookies) con HTTP 429.

Nuestro `docker/searxng/settings.yml` cambia tres cosas:

1. `search.formats: [html, json]` — habilita la salida JSON
2. `server.limiter: false` — deshabilita el rate limiting anti-bot
3. Recorta la lista de motores a un subconjunto confiable (DuckDuckGo / Bing / Brave / Wikipedia / Google / Startpage), descartando las docenas de motores nicho que el upstream habilita

**No** cambies esto por un bind-mount de host. Una versión anterior lo hizo, y los despliegues donde el directorio del host no existía obtuvieron un directorio vacío auto-creado que sombreaba el archivo — SearXNG arrancaba sin config alguna. Para ajustar settings.yml, edita `docker/searxng/settings.yml` y luego:

```sh
docker compose build searxng
docker compose up -d searxng
```

### Cadena de fallback de proveedores de búsqueda

El `SearchProviderRegistry` del backend elige un proveedor en este orden:

1. Lo que el usuario haya definido explícitamente en `Ajustes → Búsqueda` (el ajuste `searchProvider`)
2. Recorre `autoDetectOrder`, **prefiriendo proveedores de pago cuya clave API esté configurada** (Serper order=1, Tavily order=2)
3. Cae a los sin clave — SearXNG (order=50) le gana a DuckDuckGo (order=100)

En un contenedor fresco sin claves API configuradas en absoluto, **SearXNG maneja toda llamada de búsqueda**.

### Verificando el camino de SearXNG

```sh
# 1. Golpea el contenedor directamente
curl -s 'http://localhost:8088/search?q=test&format=json' | head -5
# Espera: {"query": ..., "results": [...]}
# Si recibes HTML de vuelta, settings.yml no surtió efecto.

# 2. Golpéalo desde dentro del contenedor mateclaw-server
docker exec mateclaw-server wget -qO- 'http://searxng:8080/search?q=test&format=json' | head -5
# Si esto falla, el problema es el networking de compose.

# 3. Pídele a un agente que busque y mira la cola de logs del backend
docker compose logs -f mateclaw-server | grep "搜索 provider"
# Espera: 搜索 provider 解析: searxng (source=keyless-fallback)
```

### Usando una instancia SearXNG externa

Si ya estás corriendo SearXNG en otro lado, apunta mateclaw a ella vía `.env`:

```properties
SEARXNG_BASE_URL=https://tu-searxng.example.com
```

Luego comenta el bloque de servicio `searxng` en `docker-compose.yml`. Asegúrate de que **tu instancia externa tenga los mismos ajustes de JSON + Limiter** — si no, chocarás con el mismo modo de fallo silencioso.

---

## Automatización de navegador

### Qué contiene realmente la imagen

La etapa de runtime del backend (`mateclaw-server/Dockerfile` etapa 3) se basa en `mcr.microsoft.com/playwright:v1.62.0-noble` (Ubuntu Noble 24.04, glibc) e instala encima:

- `openjdk-21-jre-headless` — corre el JAR de Spring Boot
- `fonts-noto-cjk` — renderizado de chino/japonés/coreano en screenshots
- `fonts-noto-color-emoji` — glifos de emoji
- `tzdata` — zona horaria `Asia/Shanghai`

La imagen base de Microsoft ya trae los tres navegadores en `/ms-playwright/`:

- `chromium-XXXX/chrome-linux/chrome` — el primario
- `firefox-XXXX/firefox/firefox`
- `webkit-XXXX/pw_run.sh`

Más toda librería de sistema que Chromium necesita (`libnss3`, `libgbm1`, `libasound2`, `libx11-xcb1`, `libxkbcommon`, …). **No se requiere `playwright install`, y la incompatibilidad Alpine-vs-musl que bloquea la mayoría de los despliegues de Playwright se evita por completo.**

El Dockerfile define una variable de entorno explícitamente:

```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

Esto le dice a Playwright Java que use los navegadores pre-instalados y **no** intente descargar a `$HOME/.cache/ms-playwright` en runtime.

### El fallback de 7 estrategias de BrowserLauncher

`vip.mate.tool.browser.BrowserLauncher` prueba cada estrategia en orden hasta que una tiene éxito:

1. `CONFIG_CDP` — si `MATECLAW_BROWSER_CDP_URL` está definida, adjúntate a ese Chrome corriendo
2. `CONFIG_PATH` — si `MATECLAW_BROWSER_CHROME_PATH` o `CHROME_PATH` está definida, usa ese ejecutable
3. `CONFIG_CHANNEL` — si `MATECLAW_BROWSER_CHANNEL=chrome|msedge`, usa el canal de Playwright
4. `AUTO_CHANNEL` — prueba el canal `chrome` y luego `msedge` (este paso siempre gana dentro de la imagen Docker)
5. `AUTO_PATH` — escanea rutas de instalación estándar (`/usr/bin/google-chrome`, `chromium-browser`, `/snap/bin/chromium`, `microsoft-edge`, `brave-browser`)
6. `BUNDLED` — Chromium empaquetado de Playwright (también garantizado dentro de la imagen)
7. `EXTERNAL_CDP` — último recurso: fork de un Chrome del sistema con `--remote-debugging-port=0`, parsea stderr por la URL de DevTools, se adjunta vía `connectOverCDP` (el patrón openfang)

Dentro de la imagen Docker, **la estrategia 4 o 6 siempre acierta** y no se necesita configuración. Si necesitas adjuntarte a un Chrome externo, usa la estrategia 1. Si quieres un Chrome específico instalado en el host, usa la estrategia 2.

### `/dev/shm` debe ser de 2 GB

`docker-compose.yml` define `shm_size: 2gb` para `mateclaw-server`. Docker por defecto asigna 64 MB por contenedor — Chromium usa memoria compartida para compositing de GPU y renderizado de páginas, y tres pestañas son suficientes para causar SIGBUS en el navegador. Playwright lo muestra como `TargetClosedError: Target page, context or browser has been closed`. **No reduzcas este valor.**

### Protección SSRF

Antes de cualquier llamada `navigate`, `BrowserUseTool` pasa la URL por `UrlSafetyChecker`, que **bloquea duramente** estos hosts:

- `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- `169.254.169.254` (IMDS de AWS / GCP / Azure), `100.100.100.200` (IMDS de Alibaba Cloud), `192.0.0.192` (alternativa de IMDS de Azure)
- Todos los rangos IP link-local / privados / multicast

Un LLM generando una URL maliciosa para volcar credenciales cloud es por lo tanto un bucle cerrado. Si genuinamente necesitas raspar infraestructura interna desde un host específico, deshabilítalo vía `mateclaw.browser.ssrf-check-enabled` o edita la allowlist de `UrlSafetyChecker`. **Piénsalo dos veces antes de hacerlo en producción.**

### Verificando el camino del navegador

```sh
# 1. Diagnóstico pre-vuelo (no lanza realmente un navegador)
curl -s http://localhost:18080/api/v1/system/browser-health | jq .
# Espera: overall: "healthy", system.browsers encontrado con ruta de chromium

# 2. Manéjalo desde un agente
#    browser_use(action="diagnose")  # devuelve la traza de la cadena de estrategias
#    browser_use(action="start")     # realmente lanza
#    browser_use(action="open", url="https://example.com")
#    browser_use(action="screenshot") # devuelve un PNG base64
```

---

## Primer despliegue

```sh
git clone https://github.com/mateaix/mateclaw.git
cd mateclaw

# 1. Llena los valores requeridos
cp .env.example .env
vi .env   # ver tabla abajo
```

**Requeridas** (compose se niega a arrancar sin estas, así no puedes enviar contraseñas por defecto por accidente):

| Variable | Notas |
|---|---|
| `DB_PASSWORD` | Contraseña de la BD de app — 16+ caracteres, mayúsculas/minúsculas, dígitos, símbolos |
| `DB_ADMIN_PASSWORD` | Contraseña de superusuario de bootstrap de PostgreSQL (solo init + admin) — **debe diferir de la de arriba** |

**Fuertemente recomendadas** (no forzadas, pero el log de arranque WARN si faltan):

| Variable | Notas |
|---|---|
| `JWT_SECRET` | Clave de firma JWT — genera con `openssl rand -base64 48` |
| `MATECLAW_CORS_ALLOWED_ORIGINS` | Allowlist de producción, p. ej. `https://mateclaw.example.com` |

Luego levanta el stack:

```sh
docker compose up -d --build   # el primer build toma 3-10 minutos
docker compose logs -f mateclaw-server
```

El primer arranque corre las migraciones de Flyway (~5 s) y siembra los datos por defecto (~3 s), luego se liga a `0.0.0.0:18080`.

Abre `http://localhost:18080`, inicia sesión como `admin / admin123`, y **cambia la contraseña inmediatamente** en `Ajustes → Seguridad`.

---

## Rendimiento del build

### Servidores US / EU

**Ya óptimo.** `mateclaw-server/pom.xml` lista los repositorios en el orden `Maven Central → Google CDN → Aliyun`; Central directo es lo más rápido sobre backbones US/EU.

### Servidores en China

Cambia a Aliyun-primero. Edita las líneas `mvn` en `mateclaw-server/Dockerfile` para agregar `-Paliyun-first`, o (más fácil) exponlo como build arg:

```dockerfile
# de
RUN mvn dependency:go-offline -q
RUN mvn package -DskipTests -q

# a
ARG MAVEN_PROFILE=
RUN mvn dependency:go-offline -q ${MAVEN_PROFILE:+-P${MAVEN_PROFILE}}
RUN mvn package -DskipTests -q ${MAVEN_PROFILE:+-P${MAVEN_PROFILE}}
```

Luego:

```sh
docker compose build --build-arg MAVEN_PROFILE=aliyun-first mateclaw-server
```

Los mirrors públicos + de Spring de Aliyun se promueven al tope de la cadena de búsqueda, manteniendo el tráfico dentro de China.

---

## Overrides opcionales

Todos pueden definirse en `.env` y se leen como variables de entorno. **Déjalos vacíos para aceptar los defaults del contenedor.**

| Variable | Default | Propósito |
|---|---|---|
| `SERPER_API_KEY` | — | API de búsqueda Google Serper (de pago, mejor calidad) |
| `SEARXNG_SECRET` | secreto de dev integrado | Solo llénalo al exponer el puerto 8088 al internet público |
| `SEARXNG_BASE_URL` | `http://searxng:8080` | Apunta a una instancia SearXNG externa |
| `MATECLAW_BROWSER_CDP_URL` | — | Adjúntate a un sidecar CDP de Chrome externo |
| `MATECLAW_BROWSER_CHROME_PATH` | — | Sobrescribe el Chromium empaquetado con un navegador instalado en el host |
| `MATECLAW_BROWSER_CHANNEL` | — | Fuerza un canal de Playwright (`chrome`, `msedge`, ...) |

**Las claves API de LLM (DashScope, OpenAI, Anthropic, DeepSeek, Kimi, etc.) no se leen de `.env`** — agrégalas tras el arranque en la UI bajo `Ajustes → Modelos → Agregar Proveedor`. Hot-reload soportado. El contenedor arranca con **cero claves LLM configuradas**; solo inicia sesión y agrega tu primer proveedor en la página de Modelos.

---

## Verificación

Corre estos en orden tras `docker compose up -d`:

```sh
# 1. Los tres contenedores saludables
docker compose ps

# 2. Chequeo de salud base
curl -s http://localhost:18080/api/v1/system/health | jq .

# 3. Auto-diagnóstico de la herramienta de navegador (el punto de fallo más común en hosts Linux)
curl -s http://localhost:18080/api/v1/system/browser-health | jq .
# Espera overall: "healthy"

# 4. SearXNG devuelve JSON (no una página de error HTML)
curl -s 'http://localhost:8088/search?q=hello&format=json' | head -5
```

Si cualquiera de estos falla, salta a la siguiente sección.

---

## Trampas comunes

**La etapa de build `mvn dependency:go-offline` se cuelga**
Los servidores US que pasan por Aliyun son lentos. El `pom.xml` por defecto pone Maven Central primero, así debería ser rápido. Si sigue lento, el contenedor no tiene acceso saliente — revisa tu firewall de egreso.

**`mateclaw-server` se queda unhealthy al arrancar**
`docker compose logs mateclaw-server` y busca errores de migración de Flyway. Nueve de cada diez veces, un carácter especial en `DB_PASSWORD` se lo comió el shell — envuelve el valor en comillas dobles en `.env`.

**La herramienta de navegador reporta "Target page closed" o SIGBUS**
`shm_size: 2gb` no surtió efecto. Revisa el valor real con `docker inspect mateclaw-server | grep ShmSize`. Actualiza Docker Engine a 24.0+ si sigue mostrando 64 MB.

**La búsqueda devuelve "Búsqueda temporalmente no disponible"**
SearXNG no está arriba o los defaults de la imagen deshabilitaron la salida JSON. Nuestro propio build `./docker/searxng/` lo parchea; si estás reutilizando un named volume viejo, resetea: `docker compose down -v searxng && docker compose up -d searxng`.

**Las respuestas del LLM muestran cajas tofu (□) para chino**
La imagen ya instala `fonts-noto-cjk` y `fonts-noto-color-emoji`, así que esto no es un problema de fuentes del lado del servidor. Revisa los ajustes de locale / fuentes del navegador de tu frontend.

---

## Actualización

```sh
git pull
docker compose build mateclaw-server   # solo reconstruye el backend
docker compose up -d mateclaw-server
```

El volumen `postgres_data` persiste entre rebuilds. Flyway corre migraciones incrementales automáticamente y auto-cura los cambios de checksum al reiniciar. **La versión está fijada en `mateclaw-server/pom.xml` y el git tag** — prefiere fijarte a un tag en producción, no seguir `dev`.

---

## Siguientes pasos

- [Configuración](./config) — toda variable de entorno y toggle de runtime
- [Chequeo de Salud Doctor](./doctor) — la página de diagnósticos dentro de la app
- [Seguridad y Aprobación](./security) — checklist de endurecimiento pre-producción
