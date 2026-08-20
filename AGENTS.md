# AGENTS.md — AuraClaw

> Contexto obligatorio para agentes de codificación que trabajen en este repositorio.
> Léelo completo antes de empezar cualquier tarea. Mantenlo actualizado.

## 1. ¿Qué es este repositorio?

**AuraClaw** — fork comercial de [MateClaw](https://github.com/mateaix/mateclaw) (Apache-2.0),
mantenido por **Auracore SAS**. Plataforma de "empleados digitales" (agentes IA) multi-usuario:
Spring Boot 3.5 + Spring AI Alibaba (runtime StateGraph) + Vue 3 + Electron.

Base: tag estable **v2.1.0** del upstream. El renombrado de marca es parcial (solo nivel visible).

## 2. Topología de git (CRÍTICO — leer antes de tocar nada)

```
origin   → git@github.com-auracore-sas:auracore-sas/auraclaw.git   (fork PRIVADO — nuestro repo)
upstream → https://github.com/mateaix/mateclaw.git                 (repo oficial — solo lectura)
```

| Rama | Propósito | ¿Se trabaja aquí? |
|---|---|---|
| `main` | Línea comercial estable (v2.1.0 + cambios nuestros) | ✅ SÍ — única rama de trabajo |
| `dev` | Espejo local de la rama de desarrollo del upstream | ⛔ NO — solo referencia |

## 3. Reglas de oro (inmutables)

1. **Actualizaciones del upstream SOLO vía tags estables**: `git fetch upstream --tags` + `git merge vX.Y.Z`. Nunca mergear `upstream/dev` ni `upstream/main` directamente.
2. **NUNCA** hacer `rebase` sobre `main` — solo `merge` (historia compartida: deploys, tags propios).
3. **NUNCA** usar el botón "Sync fork" de GitHub (el `main` del upstream es una línea curada/aplanada sin los tags; rompería nuestra historia).
4. **NUNCA** forzar push a `origin/main` (el setup inicial ya está hecho).
5. **No renombrar identificadores internos** — invisibles al usuario final y crean conflictos masivos en cada merge:
   - Paquetes Java (`vip.mate.*`), nombres de módulos Maven (`mateclaw-server`, `mateclaw-ui`, …)
   - Artefactos/JARs, esquema de BD, contenedores docker, variables de entorno (`MATECLAW_*`)
   - Rutas de archivos/recursos existentes (ej. `mateclaw-ui/public/logo/auraclaw_logo_s.png`)
6. **Branding visible SÍ se cambia** a AuraClaw: README, títulos de UI/desktop, textos visibles, i18n. Todo cambio debe registrarse en `docs/CUSTOMIZATIONS.md`.
7. **Código nuevo propio va en zonas aisladas** (superficie de conflicto mínima):
   - Paquetes nuevos (`com.auracore.*` o `vip.mate.<dominio-nuevo>`), no editar clases existentes salvo necesidad real
   - Migraciones Flyway propias con numeración **V900+** (nunca V<900, colisionan con upstream)
   - Config propia en profiles overlay (`application-prod.yml`, `application-auracore.yml`), no en `application.yml`
8. **`git rerere` está habilitado** — no desactivarlo (re-aplica resoluciones de conflictos de branding automáticamente).

## 4. Flujo de trabajo diario

```bash
git checkout main && git pull origin main        # empezar sesión siempre en main actualizado
# Tareas medianas: branch corta feature/xxx → merge a main (sin rebase)
# Tareas pequeñas: commit directo en main
```

Convención de commits (convencional): `feat(scope): …` · `fix(scope): …` · `chore(scope): …` · `docs: …` · `refactor(scope): …` · `test(scope): …`

**Verificar ANTES de pushear** (no hay CI/CD todavía):
```bash
mvn -q compile -DskipTests -pl mateclaw-server -am          # server compila
mvn test -pl mateclaw-server -Dtest='<TestsAfectados>'      # tests del área tocada
cd mateclaw-ui && npm run test                              # si se tocó UI
```

## 5. Adopción de actualizaciones del upstream (cuando salga una versión estable)

```bash
git fetch upstream --tags
git tag | sort -V | tail -5                 # identificar nueva versión estable (ej. v2.2.0)
git checkout main
git merge v2.2.0                            # MERGE, nunca rebase

# Resolver conflictos:
#  - README.md (branding): conservar nuestra versión y re-aplicar:
sed -i 's/MateClaw/AuraClaw/g' README.md
#  - Otros archivos que hayamos personalizado: ver docs/CUSTOMIZATIONS.md (registro)
#  - Migraciones nuevas del upstream: NO renumerar; las nuestras ya son V900+

# Verificar y publicar:
mvn -q compile -DskipTests -pl mateclaw-server -am && mvn test -pl mateclaw-server
git add -A && git commit -m "merge: integrate upstream vX.Y.Z"
git tag vX.Y.Z-mc.1 && git push origin main --tags
```

## 6. Mapa del código (orientación rápida)

```
mateclaw-server/        Backend Spring Boot 3.5 (TODO el negocio)
  src/main/java/vip/mate/
    agent/              Runtime de agentes: StateGraph, ReAct + Plan-and-Execute, delegación
    tool/               Registry + 238 tools (browser, documentos, código, imagen, 3D, música, búsqueda…)
    skill/              SKILL.md packages, evolución cerrada de skills
    wiki/               LLM Wiki: digestión de documentos, [[links]], citas, hot cache
    memory/             Memoria de workspace (MEMORY.md, SOUL.md, AGENTS.md, sueños)
    channel/            Canales IM: dingtalk, feishu, wecom, weixin, telegram, discord, qq, slack + webchat
    approval/           Approval gates para acciones sensibles
    audit/              Audit trail
    auth/               RBAC + JWT
    workspace/          Multi-tenant: workspaces, conversaciones, archivos
    team/               Team Runs + task board compartido
    cron/               Cron distribuido con lock
    workflow/           Workflow DSL (Pebble), triggers
    acp/                Bridge ACP (Claude Code / Codex)
    plugin/             SDK de plugins
    llm/                Modelos, proveedores, failover multi-vendor
  src/main/resources/db/migration/{h2,postgres,mysql}/   Flyway (V1..V179 upstream; V900+ NUESTRAS)
mateclaw-ui/            SPA Vue 3 + TS + Element Plus (consola admin) — i18n en src/i18n/locales/{en-US,zh-CN}.ts
mateclaw-desktop/       Electron (JRE 21 embebido, modos local/remoto)
mateclaw-webchat/       Widget chat embebible (UMD/ES)
mateclaw-plugin-api/    SDK Java para plugins de terceros
docs/CUSTOMIZATIONS.md  ⚠️ REGISTRO de personalizaciones — actualizar en cada cambio de marca
```

## 7. Notas de entorno

- Java 21+ (local: JDK 25), Maven, Node 26. `mvn spring-boot:run` en `mateclaw-server` (puerto 18088); `npm run dev` en `mateclaw-ui` (puerto 5173). Login dev: `admin` / `admin123`.
- BD: H2 en dev; PostgreSQL 16 en Docker (`docker compose up -d`).
- El código fuente del upstream tiene comentarios en chino — normal, no traducir (evita diffs inútiles).
- Ids son Snowflake de 64 bits: no truncar a 32 bits en UI/JSON (hay scripts de verificación).

## 8. Checklist de fin de sesión

- [ ] ¿Tocaste algo del registro (`docs/CUSTOMIZATIONS.md`)? → actualizarlo
- [ ] ¿Commit con formato convencional y mensaje claro?
- [ ] ¿Compiló (`mvn compile`)? ¿Tests del área afectada pasan?
- [ ] ¿Pusheado a `origin/main` (o branch feature mergeada)?
- [ ] ¿No tocaste `upstream` ni ramas ajenas?
