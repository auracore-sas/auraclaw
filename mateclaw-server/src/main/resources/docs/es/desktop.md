# App de Escritorio

**Doble clic. Espera treinta segundos. Inicia sesión. Úsala.**

Esa es la app de escritorio en cuatro frases. Sin Java que instalar. Sin navegador que abrir. Sin archivo docker compose. Sin puerto que recordar. La edición de escritorio de AuraClaw agrupa Electron, un runtime JRE 21 y el JAR del servidor Spring Boot empaquetado en un solo instalador. **Tus usuarios nunca saben que Java está debajo.**

Esta página es para quienes quieren correrla, construirla o depurarla.

---

## Arquitectura

```
┌──────────────────────────────────────────┐
│            Electron Shell                 │
│  ┌────────────────────────────────────┐  │
│  │      BrowserWindow (Chromium)      │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │   Frontend Vue 3 (dist/)     │  │  │
│  │  │   Element Plus + Tailwind    │  │  │
│  │  └────────────┬─────────────────┘  │  │
│  └───────────────┼────────────────────┘  │
│                  │ HTTP / SSE             │
│  ┌───────────────▼────────────────────┐  │
│  │   Backend Spring Boot (proc hijo)  │  │
│  │   puerto dinámico en 127.0.0.1     │  │
│  │   JRE 21 embebido + BD H2          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   electron-updater Auto Update      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

Tres cosas viviendo dentro de un solo árbol de procesos:

1. **Proceso principal de Electron** — ventana, bandeja, IPC, ciclo de vida del backend
2. **BrowserWindow (Chromium)** — renderiza el frontend Vue 3 (el mismo código que la versión web)
3. **Backend Spring Boot** — lanzado como proceso hijo, escucha solo en localhost

El backend elige un **puerto libre dinámicamente** al arrancar para que no colisiones con nada más en tu máquina. El frontend consulta al proceso principal el puerto real antes de la primera llamada de API.

### Características clave

- Ventana nativa, sin dependencia de navegador
- Integración con bandeja del sistema para operación en segundo plano
- **JRE 21 embebido** — los usuarios nunca instalan Java
- **Auto-actualización** vía electron-updater (GitHub Releases)
- **Datos local-primero** — todo en un directorio de usuario
- **Puerto de backend dinámico** — sin colisiones de puerto
- **Actualización caliente de UI** — los assets del frontend pueden actualizarse sin re-empaquetar el instalador
- **Modo de conexión dual local / remoto** — corre la JVM embebida localmente, o conéctate a un servidor remoto desplegado centralmente
- Multiplataforma (macOS, Windows, Linux)

---

## Modo de conexión (local / remoto)

> Para el escenario de "un equipo colaborando contra un solo servidor desplegado centralmente" — sin necesidad de que cada quien corra su propio backend local.

El desktop alcanza su backend de una de dos formas:

- **Local (`local`)** — lanza el JRE 21 embebido + el JAR del servidor y corre un backend completo en esta máquina (default, funciona de fábrica).
- **Remoto (`remote`)** — se salta el backend local y se conecta directo a tu servidor remoto desplegado centralmente; toda API / SSE apunta a él.

**Selector de conexión del primer arranque.** El primer lanzamiento (sin modo elegido aún) muestra un selector de conexión; elegir "remoto" te deja ingresar la URL del servidor, que se normaliza (auto-prefija `https://`, quita la barra final, valida http(s)). La elección se recuerda para la próxima vez.

**Multi-servidor y cambio.** Un servidor remoto conectado con éxito se registra en una lista de "usados recientemente" (deduplicada por URL, hasta 8). El menú **"Cambiar Servidor"** re-abre el selector en cualquier momento para moverse a otro servidor.

**Certs intranet auto-firmados.** Los certificados auto-firmados se aceptan solo para hosts que el usuario **confía explícitamente** — acotado a la dirección remota activa (`trustedCertHosts`), no un bypass general; los hosts desconocidos se rechazan. Esto encaja con los certs auto-firmados comunes en intranets empresariales.

**Chequeo de salud.** El modo remoto sondea con un timeout corto (~15s) ya que el servidor debería estar arriba, y reporta fallos claramente; el modo local espera a que el backend embebido arranque.

La elección de conexión se persiste en `connection.json` bajo el directorio de datos de usuario (ver "Almacenamiento de datos" abajo).

---

## Plataformas soportadas

| Plataforma | Arquitectura | Estado |
|----------|-------------|--------|
| macOS | Intel (x64) | Estable |
| macOS | Apple Silicon (ARM64) | Estable |
| Windows | x64 | Estable |
| Linux | x64 | Estable |

---

## Prerrequisitos (para construir, no para correr)

Si vas a **correr** la app: descarga e instala. Punto.

Si vas a **construir** la app:

| Herramienta | Versión | Propósito |
|------|---------|---------|
| Node.js | 18+ | Build del frontend + Electron |
| pnpm / npm | 8+ / 9+ | Gestor de paquetes |
| Java | 21+ | Compilación del backend + modo dev (los builds de producción embeben el JRE) |
| Maven | 3.8+ | Build del backend |

---

## Estructura de módulos

```
mateclaw-desktop/
├── electron/
│   ├── main/index.ts           # Proceso principal — ciclo de vida del backend, auto-update, bandeja
│   └── preload/index.ts        # Puente IPC
├── src/                         # Fuente del renderer Vue 3
├── resources/
│   ├── jre/                     # JRE embebido (por plataforma/arquitectura)
│   └── app.jar                  # JAR del backend Spring Boot empaquetado
├── build/                       # Iconos de la app
├── electron-builder.json        # Config de empaquetado
├── package.json
└── vite.config.ts
```

---

## Modo de desarrollo

```bash
cd mateclaw-desktop
pnpm install
pnpm dev
```

En modo dev:

1. Vite arranca el servidor de dev del frontend (HMR habilitado)
2. El proceso principal de Electron se lanza y carga la URL de dev de Vite
3. El proceso principal lanza el JAR de Spring Boot como proceso hijo en un puerto libre
4. El frontend habla con el backend vía HTTP/SSE

Los cambios del frontend disparan HMR. Los cambios del proceso principal reinician Electron.

---

## Build de producción

```bash
cd mateclaw-desktop
pnpm build && npx electron-builder --mac     # macOS
pnpm build && npx electron-builder --win     # Windows
pnpm build && npx electron-builder --linux   # Linux
```

La salida aterriza en `release/`:

| Plataforma | Artefacto | Notas |
|----------|----------|-------|
| macOS | `.dmg` + `.zip` | Arrastrar a Applications |
| Windows | `.exe` (NSIS) | Directorio de instalación personalizado |
| Linux | `.AppImage` | Agregar permiso de ejecución y correr |

### Prerrequisitos de build — la secuencia completa

```bash
# 1. Construir assets estáticos del frontend
cd mateclaw-ui
pnpm install && pnpm build

# 2. Construir el JAR del backend (incluye los assets del frontend en static/)
cd ../mateclaw-server
mvn clean package -DskipTests

# 3. Copiar el JAR a los resources del desktop
JAR_FILE=$(ls -1 target/mateclaw-server-*.jar | grep -v sources | head -n 1)
cp "$JAR_FILE" ../mateclaw-desktop/resources/app.jar

# 4. Descargar el JRE específico de plataforma
cd ../mateclaw-desktop
bash scripts/download-jre.sh

# 5. Construir el instalador
pnpm build && npx electron-builder
```

---

## Ciclo de vida del backend Java

El proceso principal de Electron gestiona el backend Spring Boot a través de `child_process` de Node.js:

1. **Arranque** — lanza el JAR con el JRE embebido, le pasa un puerto dinámico, espera a que esté listo
2. **Chequeo de listo** — sondea `http://127.0.0.1:{port}` hasta que el backend responde, luego carga el frontend
3. **Runtime** — el frontend se comunica vía REST + SSE
4. **Apagado** — señal de apagado elegante (SIGTERM / taskkill), espera la salida, cierra la ventana

Si el backend crashea a mitad de sesión, el proceso principal lo nota y muestra un diálogo de error con la cola del log. **Sin ventana blanca vacía.**

---

## Auto-actualización

Integración de electron-updater con GitHub Releases.

### Flujo

1. Al arrancar, revisa GitHub Releases por una versión nueva
2. Cuando encuentra una, una notificación en la UI muestra versión + changelog
3. Al confirmar, descarga con una barra de progreso
4. Una vez descargada, instalar ahora / instalar en el próximo lanzamiento
5. La app sale, reemplaza archivos, reinicia

### Configuración

```json
{
  "publish": [
    {
      "provider": "github",
      "owner": "matevip",
      "repo": "mateclaw"
    }
  ]
}
```

### Actualización caliente de UI (sin re-empaquetar)

Los assets del frontend pueden **actualizarse en caliente de forma independiente** — un arreglo solo-frontend no requiere un instalador nuevo. Ver `mateclaw-desktop/scripts/` y `desktop-ui-hot-update.md` para el flujo de build de hot-update.

---

## Almacenamiento de datos

| SO | Ruta |
|-----|------|
| macOS | `~/Library/Application Support/AuraClaw/data/` |
| Windows | `%APPDATA%/AuraClaw/data/` |
| Linux | `~/.config/AuraClaw/data/` |

Logs, archivos de workspace, scripts de skills, contenido wiki — todo vive junto a la base de datos en el mismo directorio de usuario. Respáldalo antes de cambios mayores.

---

## Referencia de `electron-builder.json`

| Ajuste | Propósito |
|---------|---------|
| `appId` | `vip.mate.mateclaw` — registro del sistema y firma de código |
| `productName` | Nombre de la app en la barra de título y el instalador |
| `publish` | Fuente de auto-actualización (GitHub Releases) |
| `extraResources` | JRE y `app.jar` |
| `mac.target` | `dmg` + `zip`, `arm64` y `x64` |
| `win.target` | Instalador `nsis` |
| `linux.target` | `AppImage` |
| `mac.hardenedRuntime` | Requerido para firma + notarización |
| `nsis.oneClick` | `false` — deja que los usuarios elijan el directorio de instalación |

---

## Variables de entorno

La app de escritorio lee las variables de entorno igual que el backend independiente. Pero hay una forma más fácil: **configura todo a través de la página de Ajustes** tras el lanzamiento. Las claves API van a la tabla cifrada `mate_model_provider` y se quedan ahí.

---

## Resolución de problemas

### Ventana en blanco

1. El backend falló al arrancar — revisa los logs por detalles del crash
2. Conflicto de puerto — el selector de puerto dinámico maneja la mayoría de los casos, los firewalls restrictivos pueden romperlo
3. JRE embebido corrupto — reinstala
4. Revisa los logs de abajo

### Advertencias de firma de código

- **macOS** — clic derecho → **Abrir** para evadir Gatekeeper (primer lanzamiento). Producción: certificado Apple Developer + notarización. Ver `mateclaw-desktop/CODESIGNING.md`.
- **Windows** — advertencia de SmartScreen → **Más info → Ejecutar de todos modos**. Producción: certificado EV de firma de código.

### La app de escritorio no arranca

1. La app instalada embebe el JRE — no necesitas Java. Build de dev desde fuente: verifica que `java -version` muestre 21+.
2. Revisa los logs:
   - macOS: `~/Library/Application Support/AuraClaw/logs/`
   - Windows: `%APPDATA%/AuraClaw/logs/`
   - Linux: `~/.config/AuraClaw/logs/`
3. Lanza desde la terminal para ver la salida de consola
4. Confirma que el puerto del backend no esté bloqueado

### Popup de auth de WeCom

El flujo de autorización por QR de WeCom **debe abrirse en un popup dentro de la app** (no el navegador del sistema) para que el callback `postMessage` funcione. AuraClaw lo maneja en `setWindowOpenHandler` — el dominio `work.weixin.qq.com` se abre como ventana popup dentro de la app.

---

## Notas

- El primer lanzamiento toma 10–30 segundos (inicialización de BD)
- Cerrar la ventana no detiene el servicio en segundo plano — usa el menú de la bandeja del sistema para salir por completo
- Respaldar el directorio de datos de usuario regularmente
- El JRE embebido hace el instalador de 80–120 MB

---

## Siguiente

- [Inicio Rápido](./quickstart) — el camino más rápido por la experiencia de escritorio
- [Configuración](./config) — ajustes de runtime
- [Consola de Administración](./console) — la UI dentro de la ventana de Electron
