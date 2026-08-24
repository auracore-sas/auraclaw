# Inicio Rápido

Sesenta segundos hasta el primer mensaje. **Un solo camino. La app de escritorio.**

Si prefieres Docker o desarrollo local, eso vive en [Configuración](./config) y [Contribuir](./contributing). Esta página hace una sola cosa: llevarte de cero a un agente funcionando lo más rápido posible.

---

## 1. Descargar

Consigue el instalador más reciente en [GitHub Releases](https://github.com/mateaix/mateclaw/releases).

- **Windows** — `AuraClaw-Setup-x.y.z.exe`
- **macOS** — `AuraClaw-x.y.z.dmg`
- **Linux** — `AuraClaw-x.y.z.AppImage`

Sin instalar Java. Sin instalar Node. Sin Maven. La app de escritorio incluye JRE 21 y el JAR del servidor.

## 2. Iniciar e iniciar sesión

Doble clic. El primer arranque tarda de 10 a 30 segundos mientras el backend se inicia.

Inicia sesión. Usuario `admin`, contraseña `admin123`. Cambia la contraseña desde `Ajustes → Seguridad` en cuanto entres. Hazlo ahora. Tu yo del futuro te lo agradecerá.

## 3. Agregar un modelo

`Ajustes → Modelos → Agregar Proveedor`.

Elige uno. Solo uno:

- **DashScope** — el inicio en la nube más simple; pega tu clave de Alibaba Cloud
- **OpenAI** o **Anthropic** — si ya tienes una clave, pégala
- **Ollama** — para GPU local; AuraClaw auto-detecta `localhost:11434`
- **ChatGPT OAuth** — si tienes cuenta Plus o Pro, inicia sesión con el flujo del navegador y usa GPT-4o, o3 u o4-mini directamente

Guarda. El modelo aparece en el selector de modelos de la pantalla de chat.

## 4. Saluda

Haz clic en `Chat` en la navegación izquierda. Elige un agente. Elige el modelo que acabas de configurar. Escribe:

> *Hola. ¿Qué puedes hacer ahora mismo?*

Presiona enter. Observa el stream de tokens.

Si recibiste una respuesta, **el sistema está vivo y estás dentro del producto.** Todo lo demás consiste en hacerlo útil para ti, no en hacerlo funcionar.

---

## Primeros movimientos útiles

Ya tienes una instalación funcionando. ¿Y ahora?

**Prueba un prompt con herramientas.** Escribe *"Busca en la web la última versión de Spring Boot y resume los cambios importantes."* Observa cómo el agente toma la herramienta de búsqueda, ejecuta, observa el resultado y vuelve con una respuesta. Eso es ReAct en acción.

**Crea tu primer agente.** `Agentes → Nuevo Agente`. Empieza desde una plantilla: las plantillas ya vienen listas para trabajar. Renómbralo, ajusta el prompt del sistema, elige qué herramientas puede usar y guarda. Los agentes son cómo pasas de una ventana de chat a una fuerza laboral completa.

**Construye tu primera base de conocimientos.** `Wiki → Nueva Base de Conocimientos`. Arrastra un PDF o apunta a una carpeta local. Espera la digestión (verás la barra de progreso en cada fila de material crudo). Cuando termine, vincula la KB a un agente y haz una pregunta sobre el contenido. Consulta [LLM Wiki](./wiki) para entender qué pasa por debajo.

**Conecta un canal de chat.** `Canales` → elige Telegram, DingTalk o cualquiera de las ocho plataformas soportadas. Pega las credenciales del bot. El mismo agente empieza a responder en ese canal con la misma memoria que tiene en tu escritorio.

Cada uno de esos temas tiene su propia página en la barra lateral cuando quieras profundizar.

---

## ¿Algo se rompió?

El primer arranque debería funcionar. Si no fue así:

- **El instalador no abre** — En Windows, clic derecho → Propiedades → Desbloquear. En macOS, permite la app sin firmar en Ajustes del Sistema → Privacidad y Seguridad.
- **El backend nunca arranca** — Revisa el archivo de log (macOS: `~/Library/Application Support/AuraClaw/logs/mateclaw.log`; Windows: `%APPDATA%\AuraClaw\logs\mateclaw.log`). La app de escritorio elige un puerto dinámico: cualquier conflicto de puerto se reporta claramente en el log.
- **La llamada al modelo falla** — Clave API incorrecta o la red no alcanza al proveedor. Vuelve a Ajustes, re-verifica la clave o prueba otro proveedor.
- **La UI está en blanco** — Refresco forzado con Ctrl/Cmd+Shift+R. Electron cachea agresivamente.
- **Sigue roto** — Abre un issue en [GitHub](https://github.com/mateaix/mateclaw/issues) con el final de `app.log`. Los leemos.

---

## Otras formas de ejecutar AuraClaw

- **Docker** — `cp .env.example .env`, define las contraseñas y luego `docker compose up -d --build`. Requisitos completos, selección de mirror de Maven (China vs EE. UU.), auto-chequeo de la herramienta de navegador y el flujo de actualización viven en [Despliegue con Docker](./docker-deploy).
- **Desde el código fuente** — `mvn spring-boot:run` en `mateclaw-server/` y `npm run dev` en `mateclaw-ui/`. Consulta [Contribuir](./contributing).
- **Internals del escritorio** — empaquetado, firma de código, auto-actualización. Consulta [App de Escritorio](./desktop).

---

Siguiente: [Introducción](./intro) para el "por qué", o salta directo a [Agentes](./agents) para el producto en sí.
