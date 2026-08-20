---
title: Introducción a AuraClaw — Sistema Operativo Multiagente de IA Autoalojado
description: AuraClaw es un sistema operativo de IA multiagente de código abierto construido sobre Spring AI Alibaba. Motores ReAct + Plan-and-Execute, base de conocimientos LLM Wiki, ciclo de memoria de 4 capas, protocolo de herramientas MCP, integración con 8 canales. Un JAR autoalojado con datos e integraciones salientes controlados por el operador.
head:
  - - meta
    - name: keywords
      content: AuraClaw,IA multiagente,IA autoalojada,sistema operativo IA,Spring AI Alibaba,ReAct,Plan-and-Execute,MCP,LLM Wiki,ciclo de memoria,Tool Guard,código abierto
---

# AuraClaw — Sistema Operativo Multiagente de IA Autoalojado

**Tu IA multiagente. En tu hardware. Bajo tus reglas.**

AuraClaw es un sistema operativo de IA completo que despliegas tú mismo. Un JAR. Un inicio de sesión. Tú controlas los datos persistidos y las integraciones salientes.

**Tres cosas que hace que otros productos de IA no pueden:**

**Proactivo** — Aparece cuando se le necesita. Envía el resumen matutino a Feishu a las 9 AM. Alerta a tu DingTalk cuando un competidor lanza algo. **No espera en una pestaña del navegador.** → [IA Ambiental](./ambient-ai)

**Sueña** — Mientras duermes, una pasada de Sueño consolida las conversaciones dispersas del día en una comprensión coherente de ti, escribiéndola en `MEMORY.md`. A la mañana siguiente **retoma donde terminó ayer** — no desde cero. → [Memoria](./memory)

**Pregunta antes de actuar** — Cuando el agente quiere eliminar un archivo, enviar un correo o escribir en la base de datos — las reglas de Tool Guard **pausan el turno en pleno vuelo** y envían una aprobación a tu IM. Tú apruebas y el agente continúa. **Agentico, pero no autónomo.** → [Seguridad](./security)

Vive en tu escritorio, en tu navegador y dentro de las apps de chat que tu equipo ya usa — mismo cerebro, misma memoria, dondequiera que vayas.

Trae cualquier modelo. DashScope. OpenAI. Anthropic. Gemini. DeepSeek. Kimi. MiniMax. Zhipu. OpenRouter. Ollama para una GPU local. Inicia sesión en tu cuenta de ChatGPT Plus vía OAuth si tienes una. Elige uno. Agrega más después.

---

## El problema que combate AuraClaw

La mayoría de los productos de IA se quedan en una sola capa.

Tienes una caja de chat, pero la memoria se reinicia cada mañana. Tienes un runtime de herramientas, pero sin forma de pausarlo cuando está a punto de hacer algo estúpido. Tienes una base de conocimientos que recupera fragmentos pero no puede decirte qué sabe realmente. Tienes una app de escritorio, pero no los canales donde vive tu equipo. O lo tienes todo — alquilado en la nube de otro, con tus datos pagando el alquiler también.

AuraClaw pelea otra batalla. Es **todo eso, bajo un mismo techo, en hardware que tú controlas.**

---

## Lo que hace realmente

**Completa trabajo.** Plan-and-Execute descompone tareas complejas en pasos ordenados, los ejecuta uno a la vez y se adapta en pleno vuelo cuando algo falla. ReAct maneja los bucles más pequeños: pensar, actuar, observar, continuar. Ves el plan actualizarse mientras el agente trabaja. Ves las llamadas a herramientas. Ves el razonamiento. Lo ves terminar.

**Recuerda.** Contexto de sesión, extracción post-chat, archivos de memoria del workspace, consolidación programada y una pasada de "sueño" que conecta los hilos de ayer con la comprensión de hoy. La memoria no es una función añadida al chat: es cómo el sistema mejora en conocerte.

**Da forma al conocimiento.** Suelta un PDF. Suelta una carpeta. Suelta mil notas markdown. El LLM Wiki las digiere en páginas estructuradas y enlazadas con resúmenes y backlinks — no un almacén de vectores que consultas, sino una biblioteca que puedes leer. Los agentes inyectan automáticamente resúmenes de páginas y obtienen cuerpos completos bajo demanda.

**Sostiene herramientas reales.** Herramientas integradas para búsqueda, E/S de archivos, hora, shell, imagen, música, video, STT y TTS. Servidores MCP para todo lo demás. Paquetes de habilidades que escribes en un `SKILL.md` y sueltas en un workspace. Todo con las puertas de Tool Guard y aprobación humana opcional — manos fuertes, límites firmes.

**Aparece en todas partes.** Consola web, una app de escritorio que incluye JRE 21 para que tus usuarios no instalen Java, y ocho canales de chat: DingTalk, Feishu, WeCom, WeChat, Telegram, Discord, QQ, Slack. El mismo agente responde un hilo de Slack, un DM de Feishu y un chat web — misma memoria, mismas habilidades, misma personalidad.

---

## Por qué el autoalojamiento cambia el producto

Ejecutar AuraClaw en tu propio hardware no es una casilla de cumplimiento. Cambia lo que el producto **es**.

**Controlas los datos y el límite de egreso.** Conversaciones, registros, documentos y memoria persisten en tu despliegue. Solo el contenido de tareas que necesitan los modelos en la nube, canales IM, servidores MCP u otros servicios de herramientas se envía a integraciones que configuras explícitamente. Para procesamiento totalmente local, combina modelos y herramientas locales y deja las integraciones externas deshabilitadas.

**Eres dueño del roadmap.** ¿No te gusta cómo funciona el consolidador de memoria? Cámbialo. ¿Necesitas una herramienta que tu proveedor no construirá? Agrégala. AuraClaw es Apache 2.0 — no "source-available", no "open core", no esperando una revisión trimestral de producto.
