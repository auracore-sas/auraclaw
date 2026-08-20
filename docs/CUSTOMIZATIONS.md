# AuraClaw — Customization Registry & Sync Procedure

> Documento de control para el fork comercial **AuraClaw** (Auracore SAS) sobre **MateClaw** (Apache-2.0, https://github.com/mateaix/mateclaw).

## 1. Estrategia de ramas y remotes

```
origin   → git@github.com-auracore-sas:auracore-sas/auraclaw.git   (fork privado — NUESTRO repo)
upstream → https://github.com/mateaix/mateclaw.git                 (repo oficial, solo lectura)

main     → línea comercial estable (base: tag v2.1.0 del upstream)
dev      → referencia local de la rama de desarrollo del upstream (no trabajamos aquí)
```

**Reglas:**
- ⛔ NUNCA usar el botón **"Sync fork"** de GitHub en `main` (el `main` del upstream es una línea
  curada/aplanada que no contiene los tags; mezclarlo rompería nuestra historia).
- ⛔ Nunca hacer `rebase` de `main` — solo `merge` (historia compartida con deploys/tags).
- ✅ La sincronización SIEMPRE es por CLI con tags estables (ver sección 3).
- ✅ `git rerere` está habilitado (`git config rerere.enabled true`): memoriza cómo resolvimos
  conflictos de branding y los re-aplica automáticamente en merges futuros.

## 2. Registro de personalizaciones (archivos tocados)

| Archivo | Cambio | Manejo de conflicto en merge |
|---|---|---|
| `README.md` | Marca renombrada: `MateClaw` → `AuraClaw` (solo prosa); aviso de fork agregado arriba | Tomar nuestra versión y re-aplicar: `sed -i 's/MateClaw/AuraClaw/g' README.md` |
| Logo / branding visual | Imagen maestra `assets/branding/auraclaw.png` → derivados `auraclaw_logo*.png`, `favicon.ico`, `build/icon.*` (UI + desktop); archivos `mateclaw_logo*` eliminados; referencias actualizadas en UI, desktop y README | Sin conflicto (archivos renombrados a `auraclaw_*` = superficie ajena al upstream) |
| `mateclaw-ui/index.html`, i18n `en-US.ts`/`zh-CN.ts`, vistas (Login, About, MainLayout, chat), `types/index.ts`, `WorkflowJsonEditor.vue` | Textos visibles: `MateClaw` → `AuraClaw` | Re-aplicar `sed 's/MateClaw/AuraClaw/g'` sobre estos archivos si upstream los toca |
| `mateclaw-desktop/branding.config.json` | Nombre/appId/equipo/copyright → AuraClaw (appId: `com.auracore.auraclaw`) | Tomar nuestra versión |
| `AGENTS.md` | Contexto para agentes de codificación (nuestro, no existe en upstream) | Sin conflicto (archivo nuevo). Si upstream crea el suyo: conservar NUESTRO |
| `docs/CUSTOMIZATIONS.md` | Este archivo (nuestro, no existe en upstream) | Sin conflicto (archivo nuevo) |
| *(futuro)* `mateclaw-ui/...` | Título, i18n `es-ES`, textos visibles | Archivos aditivos (`es-ES.ts`) = sin conflicto; textos en `en-US.ts`/`zh-CN.ts` = re-aplicar |

### Sustituciones de branding (apply después de cada merge si hace falta)

```bash
# Prosa de marca en README (NO toca rutas lowercase ni nombres de módulos)
sed -i 's/MateClaw/AuraClaw/g' README.md
```

> ⚠️ **No renombrar** por ahora: paquetes Java (`vip.mate.*`), nombres de módulos Maven,
> artefactos/JARs, esquema de BD, contenedores docker, variables de entorno (`MATECLAW_*`).
> Son identificadores internos invisibles al usuario final y cambiarlos genera conflictos
> masivos en cada merge sin beneficio visible.

## 3. Procedimiento de actualización (cuando upstream publique una versión estable)

```bash
# 1. Traer lo nuevo del oficial (tags + ramas)
git fetch upstream --tags

# 2. Ver qué versión estable nueva existe
git tag | sort -V | tail -5          # ej: v2.2.0

# 3. Integrar en nuestra línea comercial (MERGE, nunca rebase)
git checkout main
git merge v2.2.0

# 4. Resolver conflictos (rerere re-aplica los de branding automáticamente;
#    para README.md: conservar nuestra versión y re-aplicar la sustitución)
sed -i 's/MateClaw/AuraClaw/g' README.md

# 5. Verificar build y tests
mvn -q compile -DskipTests -pl mateclaw-server -am
mvn test -pl mateclaw-server -Dtest='...'   # suite completa en CI

# 6. Publicar
git add -A && git commit -m "merge: integrate upstream v2.2.0"
git tag v2.2.0-mc.1                        # tag propio por versión integrada
git push origin main --tags
```

## 4. Checklist pre-release comercial

- [ ] Merge del tag estable más reciente (sección 3)
- [ ] Branding re-aplicado (README, UI, logos)
- [ ] `mvn test` (server) + `npm run test` (ui) verdes
- [ ] `git tag vX.Y.Z-mc.N` creado y pusheado
- [ ] Upgrade probado desde la versión anterior (migraciones Flyway `V9xx+` propias si las hay)
