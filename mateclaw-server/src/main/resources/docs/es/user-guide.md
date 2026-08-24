# Guía de Usuario

Abriste AuraClaw porque quieres que la IA haga trabajo por ti. No porque quieras aprender software nuevo.

Esta guía hace una sola cosa: **llevarte de "instalado" a "funcionando para mí" lo más rápido posible.**

---

## Lanzamiento en 60 Segundos

| Paso | Qué | Tiempo |
|------|------|------|
| 1 | Doble clic, inicia sesión con `admin` / `admin123` | 10s |
| 2 | Ajustes → Modelos → Agregar Proveedor, **habilita uno**, pega tu clave | 30s |
| 3 | Chat → elige un Agente → di "Hola" | 10s |
| 4 | Observa el stream de la respuesta → **el sistema está vivo** | — |

En el momento en que ves una respuesta, estás dentro del producto. Todo lo demás consiste en hacerlo **útil para ti**.

---

## Modelos: conecta uno

**Una instalación nueva de AuraClaw tiene la lista de proveedores vacía. Es deliberado — no necesitas ver 16 proveedores, necesitas uno que funcione.**

`Ajustes → Modelos → Agregar Proveedor` abre un panel con el catálogo completo.

| Tu situación | Recomendación |
|---------------|----------------|
| Nada configurado, quieres el camino más rápido | **DashScope** — pega tu clave de Alibaba Cloud |
| Ya tienes una clave de OpenAI / Anthropic | Pégala |
| Tienes una cuenta de ChatGPT Plus / Pro | **ChatGPT OAuth** — login por navegador, sin clave API |
| Quieres que los datos se queden en tu máquina | **Ollama** — auto-detecta `localhost:11434` |

En el panel, **haz clic en Habilitar** en el proveedor que quieras, completa la URL base (pre-llenada para proveedores conocidos), pega tu clave API y guarda. El modelo aparece de inmediato en el selector de modelos del chat.

::: tip Habilitar y configurar son cosas separadas
**Habilitar** muestra el proveedor en todas partes; **deshabilitar** lo quita del selector pero conserva la configuración — cambiar temporalmente de proveedor ya no significa borrar la configuración.
:::

**Uno es suficiente.** No pierdas tiempo configurando cinco proveedores: primero pon el sistema en marcha, agrega más después.

---

## Chat: el corazón del producto

Haz clic en "Chat" en la barra lateral. Elige un agente. Elige un modelo. Escribe. Presiona enter.

Esa es toda la interacción. No hay otro punto de entrada.

### Tres cosas para probar ahora mismo

**1. Haz una pregunta directa**

> Explica la diferencia entre virtual threads de Java y platform threads

El agente responde directamente — sin herramientas. Estás viendo razonamiento puro.

**2. Haz que use herramientas**

> Busca en la web la última versión de Spring Boot y resume los cambios importantes

El agente toma la herramienta de búsqueda, lee los resultados y compone una respuesta. Ves el ciclo completo "pensar → actuar → observar → responder" — eso es ReAct en acción.

**3. Dale una tarea de varios pasos**

> Primero revisa nuestras decisiones de diseño de autenticación en el Wiki, luego compáralas con las mejores prácticas de Spring Security 6 y dame un análisis de brechas

El agente descompone esto en pasos, ejecuta cada uno y consolida. Ves el plan y el progreso de cada paso.

Si las tres funcionan, **entiendes el 90% del producto.**

---

## Agentes: cómo se comporta la IA

`Agentes → Nuevo Agente`

Un agente define exactamente cinco cosas:

| Configuración | En una línea |
|--------|----------|
| **Prompt del sistema** | Quién es, cómo habla, qué actitud tiene |
| **Modelo** | Qué modelo usar |
| **Herramientas** | Qué herramientas puede llamar |
| **Habilidades** | Qué paquetes de habilidades puede invocar |
| **Wiki** | Qué bases de conocimientos puede leer |

Empieza desde una plantilla. Las plantillas vienen listas para trabajar: renómbrala, ajusta el prompt del sistema, marca las herramientas que quieras y guarda. 30 segundos para un agente nuevo.

::: tip Cuándo crear un agente nuevo
Cuando notes que repites las mismas instrucciones de configuración en cada conversación — esa es la señal. Pon esas instrucciones en el prompt del sistema para no tener que decirlas nunca más.
:::

---

## Memoria: te recuerda

La memoria de AuraClaw no requiere gestión manual. Después de cada conversación, el sistema extrae automáticamente la información clave y la escribe en la memoria. La próxima vez, el agente trabaja con ese contexto.

Lo que puedes moldear:

- **PROFILE.md** — quién eres, tus preferencias, cómo trabajas
- **MEMORY.md** — hechos y notas de largo plazo que se acumulan con el tiempo
- **Memoria diaria** — resúmenes de conversación generados por el sistema

La memoria se comparte entre todos los canales. Lo que discutiste en el escritorio, el agente de DingTalk también lo recuerda.

---

## Wiki: haz que lea tus documentos

`Wiki → Nueva Base de Conocimientos`

Arrastra PDFs, DOCX, TXT, o apunta a una carpeta completa. Espera la digestión — cada material crudo muestra una barra de progreso, sin adivinanzas.

Una vez digerido:

1. Vincula la base de conocimientos a un agente
2. Pregunta sobre el contenido
3. El agente recupera automáticamente las páginas relevantes y responde con conocimiento

::: tip
El Wiki no es búsqueda de texto completo. Es **recuperación semántica** — pregunta "¿qué decidimos sobre autenticación?" y obtén la decisión, no todas las páginas que contienen la palabra "auth".
:::

---

## Habilidades y MCP: extiende la frontera

**Habilidades** — `Agentes → elige uno → Habilidades`. Instala desde el mercado de habilidades, o escribe un `SKILL.md` a mano.

**MCP** — `Ajustes → Servidores MCP`. Conecta servidores de herramientas externos (sistema de archivos, bases de datos, APIs personalizadas). Las herramientas MCP aparecen automáticamente en la lista de herramientas — el agente no sabe ni necesita saber que son externas.

Cuando las 20 herramientas integradas no son suficientes, estas dos puertas se abren.

---

## Canales: encuéntralo donde ya estás

`Canales → elige una plataforma → pega credenciales`

Ocho canales: DingTalk, Feishu, WeCom, WeChat Personal, Telegram, Discord, QQ, Slack.

::: tip DingTalk y Feishu: solo escanea un QR (v1.1.0+)
Se acabó el rodeo de "ir a la plataforma abierta → crear app → copiar ID y Secret". En el formulario de canal nuevo, haz clic en **Vincular con QR**, escanea con la app de DingTalk / Feishu, confirma — **client_id / app_id y el secret se auto-completan**. Menos de 30 segundos de principio a fin.
:::

Mismo agente. Misma memoria. Todos los canales.

---

## Seguridad: potente pero no fuera de control

La página de **Seguridad** te da tres controles:

1. **Tool Guard** — qué herramientas requieren tu aprobación antes de ejecutarse (shell, SQL, escrituras de archivos)
2. **File Guard** — qué directorios no puede tocar el agente
3. **Registro de auditoría** — ve todo lo que ha hecho el agente

Los valores por defecto ya son seguros. Si lo usas en producción, endurece las reglas de aprobación de shell y SQL.

---

## Tres configuraciones iniciales

### A. Asistente personal (lo más rápido)

Configura un modelo → usa el agente por defecto → empieza a chatear. La memoria se acumula automáticamente.

### B. Asistente de conocimiento

Crea un agente → crea una KB en Wiki → importa tus documentos → vincula el Wiki al agente.

### C. Trabajador automatizado

Crea un agente con rol específico → instala habilidades → conecta servidores MCP → configura reglas de aprobación en Seguridad.

---

## Algo se rompió

| Síntoma | Causa más probable |
|---------|-------------------|
| El backend no arranca | El puerto 18088 está ocupado. Revisa `<userData>/logs/mateclaw.log` (macOS: `~/Library/Application Support/AuraClaw/logs/mateclaw.log`) |
| La llamada al modelo falla | Clave API incorrecta o problema de red. Vuelve a Ajustes |
| La UI está en blanco | Ctrl+Shift+R para refresco forzado |
| Ollama dice "does not support tools" | Cambia a un modelo con function calling (qwen3, llama3.1:8b+) |
| Sigue roto | [GitHub Issues](https://github.com/mateaix/mateclaw/issues) con el final de `app.log` |

---

## Qué sigue

| Quieres... | Ve a... |
|----------------|----------|
| Entender por qué el producto está construido así | [Introducción](./intro) |
| Ver la arquitectura técnica | [Arquitectura](./architecture) |
| Configurar más opciones | [Configuración](./config) |
| Conectar más canales | [Canales](./channels) |
| Profundizar en el motor de agentes | [Agentes](./agents) |
