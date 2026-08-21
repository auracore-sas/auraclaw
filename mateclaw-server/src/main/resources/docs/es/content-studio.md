# Content Studio

**Una frase entra. Un post publicable sale.**

Content Studio (内容工作室) es la primera *escena* insignia de AuraClaw — no una sola herramienta, sino un pipeline orquestado que convierte *"escríbeme algo sobre X"* en un artefacto terminado y en plataforma: un artículo de imagen-texto para **Cuenta Oficial de WeChat (公众号)** sentado en tu caja de borradores, o una nota de **Xiaohongshu (小红书 / RED)** empaquetada como tarjetas verticales listas para publicar.

Está construido enteramente desde las primitivas propias de AuraClaw — búsqueda web, fetch de páginas, generación de imágenes, renderizado de HTML-a-imagen, memoria estructurada, cron y el runtime de skills — cosidas en un SOP repetible. Todo lo de abajo llega en **v1.8.0+**.

---

## El empleado sembrado

Content Studio viene como un **empleado digital pre-sembrado** llamado *Content Studio* / *内容工作室*. Llega ligado a los skills y herramientas correctos, con un prompt de sistema que fija el flujo de trabajo de siete etapas y la disciplina de "confirmar antes del paso externo e irreversible". No lo ensamblas — le hablas:

> *"Escribe un artículo de 公众号 sobre despliegue local de LLMs, referenciando estos dos: `<url1>` `<url2>`"*
>
> *"Dame una nota de 小红书 sobre un recorrido de cafeterías de fin de semana."*

Desde el segundo post en adelante, ya conoce tu voz — persona, estilo, dirección de temas, palabras prohibidas — porque viven en **memoria estructurada**, no en tu prompt.

---

## El pipeline

```
① Tema → ② Investigación → ③ Borrador → ④ Ilustrar → ⑤ Des-IA → ⑥ Layout → ⑦ Entregar
```

| Etapa | Qué pasa | Impulsada por |
|---|---|---|
| **① Tema** | Lee tus intereses de largo plazo desde memoria + búsqueda web fresca; o viene de un "radar de temas" cron diario | `recall_structured`, `web_search`, cron |
| **② Investigación** | Trae los artículos de referencia, resume los ángulos para que diferencies en lugar de refritar | `wechat_article_extract`, `browser_use` |
| **③ Borrador** | Escribe en estructura nativa de plataforma, honrando tu memoria de persona y estilo | LLM + memoria |
| **④ Ilustrar** | Genera una portada e imágenes de sección | `image_generate` |
| **⑤ Des-IA** | Corre un bucle medible de detectar → reescribir → re-chequear (ver abajo) | skill `deai_humanize` |
| **⑥ Layout** | Produce el artefacto de plataforma (HTML de estilo inline / tarjetas verticales) | `render_html_image`, plantillas HTML |
| **⑦ Entregar** | Se detiene en el paso externo e irreversible para tu confirmación | `gzh_publish` (borrador) / `xhs_package` |

**Las plantillas son conversacionales.** Como el layout es solo HTML, el empleado puede crear y refinar plantillas chateando — renderiza una vista previa, mira el PNG, refina — y persiste plantillas personalizadas reutilizables en tu propio skill editable. Los skills integrados siguen siendo inmutables; tus personalizaciones viven en un skill `custom` (ver [Skills](./skills)).

---

## Dos plataformas, de primera clase

### Cuenta Oficial de WeChat (公众号) — `gzh_article`

- **HTML de estilo inline.** El editor de WeChat ignora los bloques `<style>`, así que todo estilo es inline. Vienen plantillas starter (`gzh_layout_minimal`, `gzh_layout_business`), y la IA puede escribir las suyas.
- **Estructura nativa de plataforma** — una intro de gancho, 3–5 secciones con título y casos/datos concretos, un remate y un llamado a la acción de cierre.
- **Portada** dimensionada para el encabezado (≈ 2.35:1), más imágenes de sección.
- **Auto-chequeo de cumplimiento** contra tus palabras prohibidas y términos sensibles de la plataforma.
- **Entrega** para pegar manualmente, o empuja directo a tu **caja de borradores** vía `gzh_publish`.

> Lee `references/gzh_platform_rules.md` dentro del skill para las reglas reales de la plataforma — dimensiones de portada, límites de título/resumen, layout del editor, líneas rojas de compartir/seguir inducidos, frecuencia de envío masivo y el mecanismo de originalidad.

<p align="center">
  <img src="/images/content-studio/ui-gzh-article.png" alt="Content Studio produciendo un artículo de Cuenta Oficial de WeChat" width="100%">
</p>
<p align="center"><sub><i>Content Studio produciendo un artículo de 公众号 en la consola — la estructura del artículo, una portada generada y una oferta de un toque para empujarlo directo a tu caja de borradores (`gzh_publish action=draft`). El panel Resumen de Ejecución (derecha) lista los archivos generados.</i></sub></p>

<p align="center">
  <img src="/images/content-studio/out-gzh-cover.png" alt="La portada de encabezado de 公众号 que produjo" width="88%">
</p>
<p align="center"><sub><i>La portada de encabezado que produjo para ese artículo — un artefacto de salida real.</i></sub></p>

### Xiaohongshu (小红书 / RED) — `xhs_note`

Xiaohongshu es una plataforma **imagen-primero** — los lectores deslizan imágenes primero, texto segundo.

- **Al menos 3 tarjetas verticales 3:4** (portada + contenido + cierre), renderizadas desde plantillas HTML: `xhs_card_cover`, `xhs_card_content`, `xhs_card_end`, más una tarjeta de cita `xhs_card_quote`. `xhs_package` **valida duramente** la regla de ≥3 imágenes y se niega a empaquetar menos.
- **El título de cuatro partes** (número / suspenso / emoción / contraste, ≤ 20 caracteres) + cuerpo de frases cortas con cortes de emoji + 3–8 etiquetas de tema (amplia + media + long-tail).
- **Vista previa en línea** — los PNGs de tarjetas renderizadas son la vista previa; mira, luego finaliza.

<p align="center">
  <img src="/images/content-studio/ui-xhs-note.png" alt="Content Studio produciendo una nota de Xiaohongshu" width="100%">
</p>
<p align="center"><sub><i>Content Studio produciendo una nota de 小红书 — la puntuación medible de des-IA (10/100 → parecido a humano), el ítem auto-registrado en el calendario de contenido y los pasos de publicación por subida manual. El panel Resumen de Ejecución (derecha) lista las tarjetas verticales generadas.</i></sub></p>

<p align="center">
  <img src="/images/content-studio/out-xhs-01-cover.png" alt="Tarjeta de portada de Xiaohongshu" width="30%">
  <img src="/images/content-studio/out-xhs-02-steps.png" alt="Tarjeta de contenido de Xiaohongshu — pasos" width="30%">
  <img src="/images/content-studio/out-xhs-03-tips.png" alt="Tarjeta de contenido de Xiaohongshu — consejos" width="30%">
</p>
<p align="center"><sub><i>Las tarjetas verticales 3:4 que produjo — portada (título de cuatro partes) + tarjetas de contenido con puntos estructurados renderizados como imagen.</i></sub></p>

---

## Des-IA-ificación, medida

El diferenciador de toda la escena es que "des-IA" (`deai_humanize`) no es una vibra — es un **bucle medible**.

Un script heurístico (`ai_trace_score`, Python puro, sin LLM, determinista y regresible) puntúa el texto **0–100** y devuelve las señales y spans específicos:

| Señal | Qué atrapa |
|---|---|
| **Burstiness** | Varianza de longitud de frases demasiado baja → uniforme = máquina |
| **Densidad de conectores** | Cadencia de plantilla ("首先/其次/然后/综上所述/值得注意的是…") |
| **Frases de relleno** | Clichés ("在…的今天/让我们/随着…的发展/赋能…") |
| **Abuso de listas / guiones** | Layout sobre-estructurado, con pinta de generado |
| **Uniformidad de párrafos** | Longitudes de párrafo mecánicamente iguales |
| **Brecha de concreción** | Demasiado pocos números, nombres, primera persona, tiempo/lugar = vago |

El empleado reescribe **contra las señales** — coloquial, primera persona, detalle concreto, longitud de frase variada, relleno cortado, tono afinado por plataforma (公众号 medido, 小红书 vivaz) — y **re-puntúa**, iterando hasta pasar la barra o golpear **`max_rounds = 3`** (entonces conserva la mejor versión y reporta la puntuación).

> **La des-IA-ificación es una mejora heurística de calidad, no una garantía de evadir ningún detector de IA.** El skill y la salida lo dicen ambos.

---

## La cadena de publicación, endurecida

Sacar un borrador una vez es fácil; correrlo todos los días durante tres meses es donde viven los problemas reales. La cadena de publicación v1.8.0 los cierra:

- **Las imágenes del cuerpo no se rompen.** WeChat no trae imágenes externas en los cuerpos de artículo, así que la cadena parsea el HTML, **sube cada imagen del cuerpo a WeChat** y reescribe su `src`. Una subida fallida conserva su `src` original y se reporta, en lugar de bloquear todo el artículo.
- **Secretos cifrados en reposo.** `weixinoa.app_secret` y otros ajustes sensibles están **cifrados con AES-GCM** (clave desde `MATECLAW_SETTING_KEY`, fallback derivado de la máquina), el ciphertext lleva un prefijo `enc:v1:` y el texto plano legacy se lee de forma transparente y se actualiza en la siguiente escritura.
- **Un servicio, un token.** La instancia del servicio de WeChat se **cachea por appId** con un **access token persistido**, así las llamadas repetidas y los despliegues multi-instancia no chocan con el límite de un-token-por-appId de WeChat. Cambiar el secreto invalida la caché.
- **Reintento + errores en lenguaje claro.** Los códigos de error transitorios de WeChat reintentan con backoff; los códigos conocidos se traducen a pistas accionables — p. ej. *"agrega la IP pública del servidor a la whitelist de la Cuenta Oficial"*.
- **Un borrador siempre tiene portada.** Si la portada no puede resolverse, se renderiza una **portada placeholder integrada** para que el borrador igual aterrice, y la respuesta dice que se usó un placeholder.

**Caja-de-borradores-primero.** El envío masivo y la publicación son externos, irreversibles y rate-limiteados, así que AuraClaw redacta el borrador y tú presionas "publicar" en el backstage de la Cuenta Oficial. La acción opcional `publish` está controlada por el flujo de [aprobación](./security).

---

## Calendario de Contenido — entregar = escanear + registrar

El punto débil de cualquier diseño de "el modelo también debería registrar esto" es que el modelo olvida. El cumplimiento y la contabilidad están **soldados a las herramientas de entrega** mismas:

- **Entregar = escanear + registrar.** `gzh_package` y `xhs_package` corren un **escaneo de cumplimiento del lado del servidor** (términos de afirmación extrema / inducción / retorno garantizado) y **auto-registran** el ítem al calendario al entregar con éxito — sin llamada separada que saltarse. Los hits de alto riesgo aparecen en la respuesta; una publicación de alto riesgo se bloquea por defecto.
- **Dedup por huella de tema.** Cada ítem lleva una **huella de tema** normalizada; `content_item check_recent` mira hacia atrás sobre ítems `packaged`/`published` (ignorando `draft`/`failed`, excluyendo el ítem recién registrado) para que el cron diario no re-elija un tema que ya cubriste.
- **Tus palabras prohibidas se fusionan.** El escáner toma tu `banned_words` de memoria estructurada como una categoría extra junto al léxico integrado.
- **Una página de Calendario de Contenido de solo lectura.** Lista cada ítem — plataforma, título, estado, tema, enlace de vista previa, hora de creación/publicación — con tarjetas de conteo por estado arriba.

<p align="center">
  <img src="/images/content-studio/ui-content-calendar.png" alt="La página de Calendario de Contenido" width="100%">
</p>
<p align="center"><sub><i>El Calendario de Contenido de solo lectura — cada entrega de 公众号 / 小红书 auto-registrada con plataforma, título, estado, tema y hora.</i></sub></p>

---

## Referencia de herramientas

| Herramienta | Qué hace |
|---|---|
| `wechat_article_extract` | Limpia un artículo de `mp.weixin.qq.com` a `{title, author, time, body, images}` (SSRF limitado a ese host) |
| `gzh_package` | Empaqueta un artículo de 公众号 (HTML inline + portada); corre escaneo de cumplimiento + registra al calendario |
| `gzh_publish` | Empuja el artículo a la **caja de borradores** de WeChat (`draft`); el `publish` opcional está controlado por aprobación |
| `xhs_package` | Empaqueta una nota de 小红书; valida duramente ≥3 tarjetas verticales; escanea + registra |
| `xhs_publish` | Subida asistida por navegador de mejor esfuerzo (controlada por aprobación) — ver limitaciones abajo |
| `content_item` | Calendario de contenido: `check_recent` (dedup), `record`, `mark_published` |
| `compliance_scan` | Escaneo de léxico del lado del servidor; `extraBannedWords` opcional fusiona tus términos personales |

Más los skills: **`gzh_article`**, **`xhs_note`**, **`deai_humanize`**. Ver [Skills](./skills) y [Herramientas](./tools).

---

## Configuración

Para publicar en Cuenta Oficial de WeChat:

1. Configura el `app_id` / `app_secret` de la Cuenta Oficial en **Ajustes** (almacenados cifrados con AES-GCM).
2. Pon **`MATECLAW_SETTING_KEY`** en un secreto estable y **respáldalo** — descifra el ciphertext existente; perderlo significa re-ingresar los secretos.
3. Agrega la **IP pública** del servidor a la whitelist del backstage de la Cuenta Oficial. La cadena de publicación te lo dirá si falta.

Xiaohongshu no necesita clave API — Content Studio produce un paquete de tarjetas descargable por defecto.

---

## Limitaciones y no-objetivos

- **Sin envío masivo / push de un clic a todos los seguidores.** Rate-limiteado e irreversible hacia afuera; AuraClaw redacta el borrador, tú publicas desde el backstage.
- **Sin API oficial de publicación de Xiaohongshu.** No existe. Content Studio produce un paquete de tarjetas listo para publicar (default); la subida asistida por navegador es opcional, controlada por aprobación, y **no evade ningún control de riesgo o verificación humana**.
- **La des-IA-ificación es heurística**, no una garantía adversarial contra detectores.
- **Sin lavado de contenido.** El fetch de referencias es para entender ángulos existentes y diferenciar — la salida debe ser original y citar sus referencias. La responsabilidad de cumplimiento recae en ti.

---

## Qué leer a continuación

- [Skills](./skills) — el protocolo SKILL.md detrás de `gzh_article` / `xhs_note` / `deai_humanize`
- [Herramientas](./tools) — el registry de herramientas integradas
- [Canales](./channels) — el transporte de Cuenta Oficial de WeChat
- [Seguridad y Aprobación](./security) — la compuerta de aprobación en acciones de publicación externas
