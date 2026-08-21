# Multimodal

Voz, música, imágenes, video — todo de primera clase en AuraClaw, no pegado con cinta.

La mayoría de los productos de IA tratan la generación multimodal como un plugin que atornillas después. AuraClaw la trae como infraestructura central: **seis proveedores de imágenes, seis de video, tres backends TTS, dos backends STT y dos proveedores de música**, todo unificado detrás de una sola interfaz de herramienta para que los agentes puedan llamar a cualquiera sin saber qué proveedor hay debajo.

Configura una vez. Úsalo en todas partes.

---

## Qué hay en la caja

### Generación de imágenes — seis proveedores

| Proveedor | Familia de modelos | Notas |
|----------|--------------|-------|
| **DashScope** | Wanxiang | El modelo de imágenes de Alibaba, opción cloud por defecto |
| **OpenAI** | DALL-E 3 | Endpoint DALL-E estándar |
| **fal.ai** | Flux | Inferencia Flux rápida vía fal.ai |
| **Google (Nano Banana)** | gemini-3-pro-image-preview, gemini-2.5-flash-image | Vía el camino nativo de Gemini; **soporta edición de imágenes** — ver [Nano Banana](#nano-banana) abajo |
| **Zhipu** | CogView | Soporte nativo de prompts en chino |
| **MiniMax** | — | Síncrono y asíncrono soportados |

La herramienta de generación de imágenes auto-elige el proveedor configurado como default, o puedes forzar uno específico por llamada. La generación asíncrona devuelve un id de job que el agente consulta; cuando la imagen aterriza, se adjunta al **mensaje original del asistente**, no a uno nuevo.

::: tip Nuevo en 1.3.0
DashScope Wanxiang se enchufó al **endpoint unificado de generación multimodal** (`multimodal-generation/generation`) en v1.3.0, agregando 14 modelos de imagen — 6 de los cuales **soportan edición de imágenes**. Ver **Edición de imágenes** abajo.
:::

#### Edición de imágenes

::: tip Nuevo en 1.3.0
La edición de imágenes (imagen-a-imagen) está soportada desde v1.3.0. En v1.2.0 y antes, `image_generate` era solo texto-a-imagen.
:::

La herramienta `image_generate` gana dos parámetros: `image` e `images`:

| Parámetro | Forma | Descripción |
|---|---|---|
| `image` | Una sola imagen de referencia | String: ruta / `file://` / `data:image/...` / `http(s)://` / `msg:<id>:<idx>` |
| `images` | Múltiples imágenes de referencia (hasta 5) | Arreglo de las mismas formas |

La herramienta normaliza las cinco formas de referencia en buffers en memoria internamente antes de reenviar al proveedor. **Cinco formas de referencia**:

1. **Ruta local** — `/abs/path.png` / `~/x.png` / `./rel.png`
2. **URL `file://`** — variante de ruta absoluta
3. **`data:image/png;base64,...`** — cuerpo base64 inline / codificado en porcentaje
4. **`http(s)://...`** — con guarda SSRF (rechaza hosts internos)
5. **`msg:<messageId>[:<partIdx>]`** — referencia un adjunto de imagen de un mensaje en la misma conversación. **Funciona también para modelos sin visión** — el agente no necesita "ver" los bytes; con solo haber visto el messageId en el historial de conversación es suficiente

```text
Usuario: (sube una imagen de atardecer, messageId=12345) Reemplaza el fondo con un bosque.
Agente: image_generate(prompt="replace background with forest",
                     image="msg:12345:0",
                     model="qwen-image-edit")
```

**Modelos que soportan edición de imágenes** (DashScope Wanxiang):
- `wan2.7-image` / `wan2.7-image-pro` (**T2I + edición**)
- `qwen-image-edit` / `qwen-image-edit-plus` / `qwen-image-edit-max` (**solo edición**)

Un catálogo de modelos más completo vive en [Modelos](./models#two-dashscope-variants).

#### Nano Banana

::: tip Nuevo en 1.4.0
La generación de imágenes de Google corre a través de **Nano Banana Pro** (`gemini-3-pro-image-preview`) vía el [camino nativo de Gemini](./models), no un shim de compatibilidad OpenAI.
:::

Como usa el endpoint nativo `generateContent`, la herramienta de imágenes pasa las imágenes de entrada como **partes inline** directo al modelo — así que Nano Banana no es solo texto-a-imagen, **también soporta edición de imágenes** (imagen-a-imagen). Funciona exactamente como **Edición de imágenes** arriba: pasa el parámetro `image` / `images` para referenciar una o más imágenes fuente.

- **Nano Banana Pro** — `gemini-3-pro-image-preview` (default)
- **Nano Banana** — `gemini-2.5-flash-image` (otro modelo de imagen de Google)

### Generación de video — seis proveedores

- **DashScope** — video Tongyi Wanxiang
- **Runway** — Gen-2 / Gen-3 vía API
- **MiniMax (Hailuo)** — texto-a-video e imagen-a-video
- **Fal** — pipeline de inferencia rápida
- **CogVideo** — Zhipu CogVideoX
- **Kling** — generación de video Kuaishou Kling

Mismo modelo de adjunto asíncrono que la generación de imágenes. Los videos aparecen en línea en el chat una vez que el renderizado termina — en la misma burbuja donde el agente primero dijo "trabajando en ello".

### Generación de música — dos proveedores

- **Google Lyria** — generación de música de alta calidad
- **MiniMax** — generación de música con letras + prompts de estilo

La herramienta de generación de música toma un prompt, una etiqueta de estilo opcional y letras opcionales. La salida es un MP3 adjunto al mensaje.

### Generación de modelos 3D — un proveedor

- **Tencent Hunyuan 3D** — `HY-3D-3.1` / `HY-3D-3.0` (Pro, soporta PBR / multi-vista / modelo blanco) / `HY-3D-Express` (rápido)

Texto-a-3D e imagen-a-3D funcionan ambos; la salida es un `.glb` renderizado en línea por `<model-viewer>` para vista previa de arrastrar-para-rotar. Walkthrough completo de configuración: **[Generación de Modelos 3D](./model3d)**.

### Texto-a-voz (TTS) — tres proveedores

- **DashScope CosyVoice** — chino + inglés, prosodia natural
- **OpenAI TTS** — alloy, echo, fable, onyx, nova, shimmer
- **Edge TTS** — gratis, sin clave API requerida; amplia selección de voces

Haz clic en el icono de altavoz en cualquier mensaje del asistente para leerlo en voz alta. La voz es la del proveedor TTS que esté activo en Ajustes.

### Voz-a-texto (STT) — dos proveedores

- **DashScope Qwen3-ASR Flash** — transcripción multilingüe con fuerte soporte de chino y dialectos
- **OpenAI Whisper** — el estándar multilingüe de referencia

Mantén presionado el botón de micrófono en el input del chat para hablar. Suelta para transcribir. Edita el resultado antes de enviar si quieres.

---

## Configuración

Todos los proveedores multimodales viven bajo `Ajustes → Modelos → [categoría]`. Agrega un proveedor una vez con su clave API, luego márcalo como default para su categoría.

```yaml
# application.yml — ejemplo mínimo
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

Hay overrides por agente disponibles si quieres que un agente específico use siempre, digamos, Flux para imágenes y CosyVoice para voz.

---

## Cómo lo usan los agentes

Cada capacidad multimodal se expone como una herramienta:

| Herramienta | Firma |
|------|-----------|
| `image_generate` | `(prompt, style?, size?)` |
| `video_generate` | `(prompt, duration?)` |
| `music_generate` | `(prompt, style?, lyrics?)` |

Los agentes las llaman exactamente como cualquier otra herramienta. La capa de herramientas maneja la selección de proveedor, reintentos, polling asíncrono y ligadura de adjuntos.

---

## Generación asíncrona y ligadura de mensajes

La generación de imágenes y video a menudo toma más que un turno normal de agente. AuraClaw lo maneja limpiamente:

1. El agente llama a la herramienta de generación.
2. La herramienta devuelve de inmediato con un id de job y un adjunto placeholder.
3. El backend consulta al proveedor en segundo plano.
4. Cuando el resultado aterriza, se adjunta al **mensaje original del asistente** — no a uno nuevo.

Funciona como esperarías: la imagen aparece dentro de la misma burbuja donde el agente primero dijo "trabajando en ello" — no flotando en un mensaje nuevo.

---

## Dónde aparece en el producto

- **Chat** — arrastra una imagen al input para modelos de visión; mantén presionado el micrófono para dictar; haz clic en el altavoz de cualquier respuesta para leerla en voz alta; los medios generados aparecen en línea.
- **Agentes** — habilita o deshabilita herramientas multimodales específicas por agente.
- **Página de Herramientas** — todo proveedor tiene un botón de prueba para que verifiques una clave antes de usarla en producción.
- **App de escritorio** — todo lo anterior, más acceso al filesystem local para operaciones en lote.

---

## Cuándo usar qué

- **Imagen** — ilustraciones de documentación, gráficos de diapositivas, visualización de conceptos, marketing. Empieza con DashScope o Flux; DALL-E 3 cuando necesites renderizado de texto ajustado.
- **Video** — demos de formato corto, contenido social, animaciones de producto. Runway para calidad, MiniMax para escenarios chinos, DashScope para cloud-local.
- **Música** — pistas de fondo, jingles de demo, exploración creativa. Dos proveedores hoy; espera que la superficie evolucione.
- **TTS** — accesibilidad, lectura estilo audiolibro, contenido multilingüe. CosyVoice para chino, OpenAI para variedad en inglés.
- **STT** — entrada voz-primero, transcripción de reuniones, flujos de dictado. Qwen3-ASR para grabaciones en chino y multilingües, endpoints compatibles con Whisper como alternativa.

---

## Entrada multimodal: ¿el primario no la habla? Usa un sidecar

::: tip Añadido en 1.3.0
Esta página trata sobre **generación (salida)**. El lado de la **entrada** — subir una imagen a un modelo principal solo-texto — corre por un camino separado de "sidecar multimodal". Ver [Chat → ¿El modelo principal no ve imágenes?](./chat) y [Modelos → Sidecar multimodal (a nivel de sistema)](./models).
:::

En resumen: configura un modelo de visión bajo **Ajustes → Modelos → Sidecar multimodal**. Cuando el modelo principal no puede manejar una imagen subida, el runtime la describe vía el sidecar primero y alimenta la descripción al chat principal. El primario se mantiene barato; la decisión de enrutamiento es totalmente visible en la UI de chat (insignia en la burbuja, pista sobre la caja de entrada).

---

## Siguiente

- [Chat y Mensajería](./chat) — entrada de adjuntos, enrutamiento de sidecar multimodal, cómo se adjuntan los medios generados a los mensajes
- [Modelos](./models) — UI de configuración de proveedores, ajustes de sidecar multimodal
- [Herramientas](./tools) — el sistema de herramientas que aloja la generación multimodal
