# Contribuir

**El código que escribas aquí corre en las máquinas de otras personas.**

Esa es la única cosa que recordar. AuraClaw es Apache 2.0, auto-alojado, y se envía como un solo JAR. Cada línea que agregues se descarga, se desempaqueta y se ejecuta por alguien que nunca conocerás. Escribe el código que te gustaría encontrar, seis meses después, en los logs de alguien más a las 2 AM.

---

## Empezando

### 1. Fork y clon

```bash
git clone https://github.com/TU_USUARIO/mateclaw.git
cd mateclaw
```

### 2. Arranca el backend

```bash
cd mateclaw-server
mvn spring-boot:run
```

El backend arranca en el puerto 18088. Consola H2 en `/h2-console`, Swagger UI en `/swagger-ui.html`.

::: tip
La configuración de modelos es **dirigida por UI** — no necesitas definir `DASHSCOPE_API_KEY` como env var para arrancar. Inicia sesión, ve a `Ajustes → Modelos`, agrega un proveedor ahí.
:::

### 3. Arranca el frontend

```bash
cd mateclaw-ui
npm install
npm run dev
```

Frontend en el puerto 5173, proxyea `/api` al backend.

### 4. Verifica

Abre [http://localhost:5173](http://localhost:5173). Inicia sesión con `admin` / `admin123`. Agrega un modelo en `Ajustes → Modelos`. Envía un mensaje de prueba. Si los tokens fluyen de vuelta, estás listo.

---

## Flujo de trabajo de desarrollo

```bash
# 1. Haz una rama de feature desde main
git checkout -b feat/tu-nombre-de-feature

# 2. Trabaja en commits pequeños y con significado
git add <archivos específicos>
git commit -m "feat(scope): qué cambiaste"

# 3. Mantente al día con upstream
git fetch upstream
git rebase upstream/main

# 4. Empuja y abre un PR
git push origin feat/tu-nombre-de-feature
```

---

## Nombrado de ramas

| Prefijo | Propósito | Ejemplo |
|--------|---------|---------|
| `feat/` | Feature nueva | `feat/voice-input` |
| `fix/` | Arreglo de bug | `fix/sse-reconnect` |
| `docs/` | Documentación | `docs/api-reference` |
| `refactor/` | Refactorización | `refactor/agent-state` |
| `chore/` | Build, dependencias, tooling | `chore/upgrade-spring-boot` |
| `test/` | Cambios solo de tests | `test/add-approval-coverage` |

---

## Mensajes de commit

Formato [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): descripción breve

Descripción más larga opcional explicando qué y por qué.
```

Ejemplos:

```
feat(agent): add max iteration limit to ReAct loop
fix(channel): handle DingTalk message encoding correctly
docs(tools): add examples for WebSearchTool
chore(deps): upgrade Spring Boot to 3.5.1
```

**Escribe mensajes de commit sobre el cambio, no sobre el código.** "agregar lógica de reintento a WebSearchTool" es útil. "actualizar WebSearchTool.java" no lo es.

---

## Convenciones del backend

### Layout de paquetes

Pon el código nuevo en el paquete `vip.mate.*` correcto:

| Estás agregando... | Paquete |
|------------------|---------|
| Una herramienta nueva | `vip.mate.tool` |
| Un adaptador de canal nuevo | `vip.mate.channel` |
| Un nodo de grafo de agente nuevo | `vip.mate.agent.graph.node` |
| Un proveedor de memoria | `vip.mate.memory.spi` |
| Una feature de Wiki nueva | `vip.mate.wiki` |
| Código utilitario | `vip.mate.common` |

### Estilo de código

- **Features de Java 17+ incentivadas** — records, sealed classes, text blocks, pattern matching, `var` para tipos locales obvios
- **Inyección por constructor**, no por campo
- **Nombrado**: `XxxService`, `XxxController`, `XxxMapper`, `XxxEntity`
- **Base de datos**: MyBatis Plus, no JPA. Prefijo `mate_`. Campos Java camelCase → columnas snake_case.
- **Borrado lógico** vía columna `deleted`
- **Toda tabla** necesita `create_time`, `update_time`, `deleted`

### El grafo del agente es un StateGraph

No busques una jerarquía de clases `BaseAgent` — el runtime del agente es un **StateGraph** de nodos y aristas. Al agregar comportamiento de agente, piensa en términos de:

- **Un nodo** (razonamiento, acción, observación, generación de plan) — en `vip.mate.agent.graph.node` o `vip.mate.agent.graph.plan.node`
- **Una arista** o **dispatcher** — en `vip.mate.agent.graph.edge` o `vip.mate.agent.graph.plan.edge`
- **Una clave de estado** — en `vip.mate.agent.graph.state.AuraClawStateKeys`

El builder que lo cablea es `AgentGraphBuilder`. Los eventos de streaming desde nodos pasan por `GraphEventPublisher` y `NodeStreamingChatHelper`.

### Agregando una herramienta nueva

```java
@Component
public class MyNewTool {

    @Tool(description = "Clear description for the LLM")
    public String myMethod(
            @ToolParam(description = "What this parameter controls") String input) {
        // Implementación
        return "result";
    }
}
```

- Spring `@Component`
- Todo método `@Tool` se vuelve una herramienta llamable
- Usa `@ToolParam` en cada parámetro — esta es la descripción para el LLM
- **Si la herramienta es peligrosa, agrega una regla de Tool Guard para ella**

### Agregando un canal nuevo

1. Crea una clase en `vip.mate.channel` implementando `ChannelAdapter` (o `StreamingChannelAdapter` para streaming)
2. Registra el endpoint de webhook en `ChannelWebhookController`
3. Agrega propiedades de config
4. Actualiza `docs/en/channels.md` y `docs/zh/channels.md` con los pasos de integración

### Agregando un proveedor de memoria nuevo

1. Crea una clase en `vip.mate.memory.spi` implementando `MemoryProvider`
2. Regístrala como Spring bean
3. Agrega configuración bajo `mate.memory.providers.{name}`
4. Agrega tests

### Cambios de esquema SQL

El esquema lo gestiona **Flyway**. El DDL nuevo va en un archivo fresco `V{siguiente}__descripcion.sql` bajo **ambos** directorios `db/migration/h2/` y `db/migration/mysql/`. Cada archivo debe ser compatible con su dialecto (MySQL no soporta `ADD COLUMN IF NOT EXISTS` — usa una guarda de `INFORMATION_SCHEMA`; H2 lo soporta nativamente).

Los datos semilla los carga `DatabaseBootstrapRunner` desde `db/data-*.sql` — idempotente (`INSERT ... ON DUPLICATE KEY UPDATE` / `MERGE INTO`).

---

## Convenciones del frontend

### Estilo de código

- **Composition API con `<script setup>`** para todos los componentes nuevos
- **TypeScript requerido** — sin `any` salvo necesidad absoluta
- **Stores Pinia** para estado compartido, `ref`/`reactive` locales para estado de componente
- **Element Plus** preferido sobre implementaciones personalizadas
- **Clases utilitarias TailwindCSS**; evita estilos inline
- **Alias de ruta** `@` → `src/`
- **Tokens de diseño** en `src/assets/main.css` (variables CSS `--mc-*`) — no hardcodees colores

### Propiedad del estado

Cada store Pinia posee el estado de su dominio **exclusivamente**. El código externo llama las acciones del store — no muta el estado directamente.

```typescript
// Correcto
agentStore.fetchAgents()
themeStore.setMode('dark')

// Incorrecto
agentStore.agents = []         // No
```

### Agregando una página nueva

1. Crea la vista en `src/views/`
2. Registra la ruta en `src/router/index.ts`
3. Agrega traducciones en `src/i18n/zh-CN.ts` y `src/i18n/en-US.ts`
4. Crea un store Pinia en `src/stores/` si necesitas estado compartido
5. Agrega la página a la barra lateral en `src/views/layout/MainLayout.vue`

### Estructura de componente

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAgentStore } from '@/stores/useAgentStore'

const agentStore = useAgentStore()
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  await agentStore.fetchAgents()
  loading.value = false
})
</script>

<template>
  <div class="p-4">
    <el-table :data="agentStore.agents" v-loading="loading">
      <!-- columnas -->
    </el-table>
  </div>
</template>
```

---

## Testing

### Tests del backend

```bash
cd mateclaw-server
mvn test                                  # Todos los tests
mvn test -Dtest=StateGraphReActAgentTest  # Una sola clase
mvn test -Dtest=StateGraphReActAgentTest#testChat  # Un solo método
```

### Chequeo de tipos y lint del frontend

```bash
cd mateclaw-ui
npm run build       # chequeo de tipos vue-tsc + vite build
npm run lint        # ESLint con auto-fix
```

### Checklist de prueba manual

- [ ] El backend arranca sin errores
- [ ] El frontend compila sin errores de tipo (`npm run build`)
- [ ] El login funciona con las credenciales por defecto
- [ ] Modelo configurado vía UI
- [ ] El chat transmite una respuesta de vuelta
- [ ] La feature nueva funciona como se describe
- [ ] Sin errores de consola
- [ ] Docs actualizados si el comportamiento de cara al usuario cambió

---

## Cambios de documentación

Si tu PR cambia comportamiento de cara al usuario — una feature nueva, un endpoint renombrado, una clave de config cambiada — **actualiza los docs en el mismo PR**.

Los docs viven en `docs/`. Elige la página relevante y actualiza tanto `docs/en/` como `docs/zh/`. Las versiones en chino e inglés se **escriben de forma independiente**, no son traducciones — iguala el tono y estilo con la página existente.

```bash
cd docs
npm run build
```

El build debe tener éxito con cero errores antes de abrir el PR.

---

## Proceso de pull request

1. **Título** — formato de commit convencional
2. **Descripción** — qué, por qué, cómo; enlaza issues
3. **Screenshots** — para cambios de UI, antes/después
4. **Testing** — describe cómo probaste
5. **Breaking changes** — anótalos claramente arriba

### Plantilla de PR

```markdown
## Qué

Descripción breve del cambio.

## Por qué

Por qué se necesita este cambio (enlaza el issue).

## Cómo

Enfoque técnico.

## Testing

Cómo se probó.

## Screenshots (si hay cambios de UI)

Antes / Después.
```

---

## Reportar issues

Al reportar un bug:

- Versión de AuraClaw (o hash de commit)
- Versión de Java y SO
- Pasos exactos para reproducir
- Comportamiento esperado vs. real
- Salida de log relevante

Los buenos reportes de bugs obtienen buenos arreglos.

---

## Siguiente

- [Inicio Rápido](./quickstart) — walkthrough de configuración
- [Introducción](./intro) — panorama de arquitectura
- [Arquitectura](./architecture) — inmersión en StateGraph para desarrolladores
- [Roadmap](./roadmap) — en qué trabajamos después
