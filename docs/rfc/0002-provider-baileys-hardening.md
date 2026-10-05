# RFC 0002 — `provider-baileys`: plan de hardening por fases

| Field | Value |
|---|---|
| Status | **Draft** (pendiente de aprobación) |
| Author | Engineering (agent-assisted) |
| Issue | — (auditoría interna) |
| Provenance | Revisión profunda de `packages/provider-baileys` vs `WhiskeySockets/Baileys` |
| Reviewers | Maintainer (`@leifermendez`), provider-baileys owner |
| Target version | `1.4.x` → `1.5.x` (mayoría de fases patch/minor; Fase 5 toca dependencia) |
| Risk | Medio (lifecycle + routing de mensajes). Todas las fases son revertibles por separado |
| Baseline | `provider-baileys@1.4.3-y.12`, `baileys@7.0.0-rc13`, 175/175 tests verdes |

---

## 1. Summary (PR-FAQ)

**Problem.** El provider funciona (175 tests pasan) pero arrastra deuda en tres frentes: (a) **ciclo de vida del proceso** — secuestra señales, puede levantar dos sockets, puede tumbar el proceso desde `GET /`, y filtra timers; (b) **semántica frente a Baileys 7** — `getMessage` devuelve `{}` en *miss* (Baileys cree que encontró el mensaje), los mensajes de grupo se descartan, y un LID sin `remoteJidAlt` se convierte en un número inventado; (c) **higiene de paquete** — 5 dependencias de runtime sin uso, tipos importados como valores, tipos públicos no exportados y un fallback de versión de WhatsApp obsoleto.

**Proposal.** Ejecutar **7 fases** independientes y verificables, empezando por el ciclo de vida (mayor impacto, menor riesgo funcional), siguiendo por semántica de mensajes, corrección de `lidCache`, higiene de tipos/paquete, upgrade a `baileys@7.0.0-rc14`, resiliencia de reconexión y cierre de docs/release.

**Impact.** El bot dejará de colgarse al reiniciar, dejará de reenviar mensajes vacíos, responderá al contacto correcto en cuentas migradas a LID y reducirá drásticamente el peso de instalación (`sharp` + `jimp` + ffmpeg salen del paquete). Cada fase es un PR con sus tests.

---

## 2. Motivación — hallazgos que originan el plan

Verificación sobre `accb3ec3` (revisión completa de `src/`):

| ID | Hallazgo | Evidencia | Fase |
|---|---|---|---|
| H1 | `removeAllListeners('SIGINT'\|'SIGTERM'\|...)` sin `process.exit` → Ctrl+C deja de matar el proceso y se borran handlers ajenos | `src/bailey.ts:168-190` | 1 |
| H2 | `initVendor` en `catch` se vuelve a llamar y luego continúa → dos sockets/listeners | `src/bailey.ts:318-325` | 1 |
| H3 | `getMessage` devuelve `{}` en miss; el contrato Baileys es `undefined` (`messages-recv.js:1061`) | `src/bailey.ts:292-301` | 2 |
| H4 | `indexHome` hace `createReadStream` sin handler de error → uncaught → `process.exit(1)` | `src/bailey.ts:265-283` | 1 |
| H5 | `releaseSessionFiles()` llama `releaseTmp(name, 0)` y `clearInterval` inmediato → no-op | `src/bailey.ts:251-256` | 1 |
| H6 | Mensajes de grupo descartados aunque `groupsIgnore:false` | `src/bailey.ts:696`, `src/utils.ts:68` | 2 |
| H7 | LID sin `remoteJidAlt` fabrica PN con `split('@')[0]` | `src/bailey.ts:619` | 2 |
| H8 | Dedupe roto: limpia el array completo al detectar duplicado; ventana de 10 | `src/bailey.ts:706-723` | 2 |
| H9 | `cleanup()` cierra `logStream` antes del log final y no cierra el socket | `src/bailey.ts:210-249` | 1 |
| H10 | `setInterval` sin handle ni `.unref()` | `src/bailey.ts:195` | 1 |
| H11 | Reconecta en `connectionReplaced`, timers apilables, se rinde sin reset | `src/bailey.ts:1180-1246` | 6 |
| H12 | `options['options']` sin guard cuando `options` es `undefined` | `src/bailey.ts:1047` | 2 |
| H13 | `compact()` no compacta (recursión bloqueada por `flushing`) | `src/lidCache.ts:702,747` | 3 |
| H14 | `MemoryLidCache.set` no normaliza PN; `HybridLidCache.set` sí | `src/lidCache.ts:943+` | 3 |
| H15 | TTL de archivo con `ts: now` en cada flush → nunca expira | `src/lidCache.ts:747+` | 3 |
| H16 | `clear()` escribe `entries:{}`; `compact()` borra el archivo | `src/lidCache.ts:640,702` | 3 |
| H17 | Tipos re-exportados como valores (`WAVersion`, `WABrowserDescription`) | `src/type.ts`, `src/baileyWrapper.ts` | 4 |
| H18 | `isLidUser` importado sin usar; reglas lint en `off` lo ocultan | `src/bailey.ts:36` | 4 |
| H19 | 5 deps de runtime sin uso + 2 duplicadas con `@builderbot/bot` | `package.json` | 4 |
| H20 | `BaileyGlobalVendorArgs` y `baileyWrapper` no exportados | `src/index.ts` | 4 |
| H21 | Fallback hardcodeado `[2,3000,1025190524]` obsoleto | `src/bailey.ts:339` | 5 |
| H22 | `...globalVendorArgs` inyectado entero en `makeWASocket` | `src/bailey.ts:370` | 5 |
| H23 | Versión Baileys `rc13` vs `latest` `rc14` | `package.json` | 5 |
| H24 | Tests dejan cientos de `*_sessions` y logs en el cwd (gitignored, pero ruido local) | `packages/provider-baileys/` | 0 |

---

## 3. Goals / Non-goals

### Goals
1. Ninguna operación del provider puede terminar el proceso del host de forma inesperada.
2. El ciclo de vida (arranque, reconexión, shutdown) es idempotente y sin fugas de handles.
3. `getMessage`, dedupe y resolución LID cumplen el contrato de Baileys 7.
4. `lidCache` cumple lo que documenta (compactación, TTL, normalización consistente).
5. El paquete no arrastra dependencias muertas y expone sus tipos públicos.
6. Alineado con `baileys@7.0.0-rc14` y con versión de WhatsApp resuelta en runtime.
7. Cada fase entra con tests y sale verde sin regresiones.

### Non-goals
1. Reescribir el provider (se mantiene la estructura actual).
2. Migrar de `useMultiFileAuthState` a un store externo (se documenta, no se implementa).
3. Soportar mensajes de grupo **salvo que el decision gate de Fase 2 lo apruebe**.
4. Cambiar la API pública de `BaileyGlobalVendorArgs` más allá de exportarla.
5. Resolver issues upstream de Baileys (se aíslan/mitigan, no se parchea `node_modules`).

---

## 4. Estrategia de ejecución

- **Una rama y un PR por fase** (`fix/baileys-phase-N-...`), merge a `builderbot` tras revisión.
- **Orden obligatorio** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7; las fases 3 y 4 pueden paralelizarse con 5.
- **Puerta de calidad por fase** (ver §6). No se abre la siguiente sin la anterior verde.
- **Sin `dist/` editado a mano.** `pnpm --filter @builderbot/provider-baileys build`.
- **Compatibilidad**: ninguna fase rompe la firma pública salvo que se documente explícitamente.

---

## 5. Fases

### Fase 0 — Baseline y guardarraíles

| Campo | Detalle |
|---|---|
| Objetivo | Congelar el estado actual y crear la red de seguridad |
| Archivos | `packages/provider-baileys/jest.config.ts`, `.gitignore`, `__tests__/**` |
| Cambios | (1) Registrar baseline: 175 tests, hash de `pnpm-lock.yaml`, tamaño de `dist`. (2) Añadir script `test:baileys` que limpie `*_sessions` y `*.log` al terminar. (3) Marcar con `// BUG(H3)` los tests que *consagran* comportamiento incorrecto (p. ej. `getMessage` → `{}`). (4) `git clean` local de `*_sessions`/logs. |
| Aceptación | Suite verde reproducible; sin artefactos residuales tras `test`; baseline documentado en el PR. |
| Pruebas | `pnpm --filter @builderbot/provider-baileys test` 2× seguidas. |
| Riesgo | Nulo |
| Rollback | Revertir PR |

---

### Fase 1 — Lifecycle hardening (crítico)

| Campo | Detalle |
|---|---|
| Objetivo | Que el provider no secuestre ni mate el proceso, y que arranque/apague limpio |
| Cubre | H1, H2, H4, H5, H9, H10 |
| Archivos | `src/bailey.ts`, `src/releaseTmp.ts`, `__tests__/baileysReliability.test.ts` |
| Cambios | **1.1 Señales**: no `removeAllListeners` global; guardar referencias propias y `off` solo las propias; en `SIGINT/SIGTERM` → `cleanup()` + `process.exit()` (o cerrar server y dejar salir). Exponer `captureProcessSignals: false` por defecto para apps embebidas. **1.2 `uncaughtException`**: no `process.exit` desde librería; re-lanzar o delegar si ya hay handler. **1.3 `setupPeriodicCleanup`**: guardar `interval`, `.unref()`, `clearInterval` en `cleanup`. **1.4 `cleanup()`**: idempotente (`isCleaned`), cerrar socket (`vendor.end`) antes de caches, log **antes** de `logStream.end()`. **1.5 `indexHome`**: `existsSync` + `stream.on('error')` + 404 real. **1.6 `initVendor` catch**: quitar la recursión; devolver/emitir error sin crear segundo socket. **1.7 `releaseSessionFiles`**: reemplazar `releaseTmp(…,0)` por una limpieza directa de una pasada. |
| Aceptación | Jest sin "worker failed to exit"/open handles. Test que simula `GET /` sin QR → 404 sin `uncaughtException`. Test que verifica que un `SIGINT` previo del host sigue registrado. Un solo `makeWASocket` cuando `releaseTmp` falla. |
| Pruebas | Ampliar `baileysReliability.test.ts` (signals, cleanup idempotente, indexHome error, doble-socket). |
| Riesgo | Medio (lifecycle). Mitigación: flag `captureProcessSignals` para no romper hosts existentes. |
| Rollback | Revertir PR; el flag permite convivencia si algo se detecta tarde |

---

### Fase 2 — Semántica de mensajes (routing)

| Campo | Detalle |
|---|---|
| Objetivo | Cumplir el contrato Baileys y enrutar bien en cuentas LID |
| Cubre | H3, H6, H7, H8, H12 |
| Archivos | `src/bailey.ts`, `__tests__/baileysProvider.test.ts` |
| Cambios | **2.1 `getMessage` → `undefined`** en miss (y actualizar el test que espera `{}`). **2.2 LID sin alt**: no fabricar PN; conservar `@lid` y resolver vía `lidCache`/`signalRepository`; si no resuelve, decidir fallback (emitir con `from=@lid` o descartar). **2.3 Dedupe**: `Set`/`Map` acotado con TTL (p. ej. 5 min, 5k entradas) en vez del array con resets. **2.4 `sendMessage`**: `options = { ...(options ?? {}), ...(options?.options ?? {}) }`. **2.5 Decision gate (grupos)** — ver §5.2. |
| Aceptación | `getMessage` devuelve `undefined` en miss. Un mensaje LID sin alt **no** genera `from` numérico inventado. Duplicados consecutivos y alternos se filtran de forma consistente. |
| Pruebas | Nuevos casos: miss de `getMessage`; LID sin alt; dedupe con 3 repeticiones; `sendMessage` sin options. |
| Riesgo | Medio-alto (afecta entrega). Mitigación: tests unitarios + smoke manual en un número de prueba antes de merge |
| Rollback | Revertir PR (cambios localizados) |

#### 5.2 Decision gate — mensajes de grupo (bloqueante)

Hoy `groupsIgnore:false` no habilita nada porque `baileyIsValidNumber('…@g.us')` filtra al final. Hay que **elegir** antes de tocar código:

| Opción | Descripción | Coste | Recomendación |
|---|---|---|---|
| **A. Soportar grupos** | `from` = JID del grupo; añadir `participant`/`sender` al payload; exención del filtro para `@g.us` | Medio | Si hay demanda real |
| **B. No soportar (explícito)** | Mantener descarte, documentar y **deprecar** `groupsIgnore` o renombrarlo | Bajo | ✅ Por defecto |
| **C. Configurable** | `allowGroups: boolean` con `from` = grupo, default `false` | Medio | Si se quiere A sin breaking |

> **Gate**: sin decisión del maintainer, la Fase 2 aplica **B** (no cambia comportamiento, solo documenta y limpia).

---

### Fase 3 — `lidCache` correctness

| Campo | Detalle |
|---|---|
| Objetivo | Que el cache haga lo que su documentación promete |
| Cubre | H13, H14, H15, H16 |
| Archivos | `src/lidCache.ts`, `__tests__/lidCache.critical.test.ts`, `__tests__/lidCache.edges.test.ts` |
| Cambios | **3.1 `compact()`**: separar la escritura del guard `flushing` (método interno `writeSnapshot()`); compactar de verdad. **3.2 `MemoryLidCache.set`**: normalizar PN igual que el híbrido. **3.3 TTL real**: persistir `lastAccess` por entrada (actualizado en `get`/`set`) en vez de `now` global. **3.4 `clear()` vs `compact()`**: unificar (vacío ⇒ borrar archivo). |
| Aceptación | Test: con >`COMPACT_AT_ENTRIES` entradas, el archivo tras `compact()` contiene solo las válidas. Test: `MemoryLidCache` y `HybridLidCache` devuelven el mismo PN para la misma entrada. Test: entrada no accedida > TTL se descarta al recargar. |
| Pruebas | `lidCache.critical` + `lidCache.edges` extendidos. |
| Riesgo | Bajo (aislado, sin red) |
| Rollback | Revertir PR |

---

### Fase 4 — Tipos y paquete

| Campo | Detalle |
|---|---|
| Objetivo | Eliminar deuda de tipos y peso muerto; exponer API pública |
| Cubre | H17, H18, H19, H20 |
| Archivos | `src/type.ts`, `src/baileyWrapper.ts`, `src/index.ts`, `package.json` |
| Cambios | **4.1** `import type` / `export type` para `proto`, `WAVersion`, `WABrowserDescription` (compat `isolatedModules`/`verbatimModuleSyntax`). **4.2** Quitar `isLidUser` sin usar. **4.3** Quitar deps sin uso (`@adiwajshing/keyed-db`, `cheerio`, `fluent-ffmpeg`, `jimp`, `sharp`); mover `@types/polka` a `devDependencies`. **4.4** Exportar `BaileyGlobalVendorArgs` y (si aplica) tipos de `lidCache`. **4.5** Reactivar `@typescript-eslint/no-unused-vars` y `consistent-type-imports` **solo** para este paquete vía override en `eslint.config.js`. |
| Aceptación | `pnpm --filter @builderbot/provider-baileys build` OK (cjs+mjs+d.ts). `pnpm lint:check` OK con las reglas reactivadas. `npm ls` sin deps huérfanas. Consumidor puede `import type { BaileyGlobalVendorArgs }`. |
| Pruebas | Build + lint + `test` del paquete. Verificación de tamaño de `node_modules` antes/después. |
| Riesgo | Bajo. Ojo: confirmar que ninguna dep removida la usa `@builderbot/bot` en runtime (ya declaradas allí). |
| Rollback | Revertir PR |

---

### Fase 5 — Upgrade a `baileys@7.0.0-rc14`

| Campo | Detalle |
|---|---|
| Objetivo | Alinear con upstream y quitar el fallback obsoleto |
| Cubre | H21, H22, H23 |
| Archivos | `package.json`, `pnpm-lock.yaml`, `src/bailey.ts` |
| Cambios | **5.1** Bump `baileys` → `7.0.0-rc14` (sin breaking de API; trae WA version nueva, `Browsers.android`, fix tc-token). **5.2** Fallback hardcodeado → `[2,3000,1043857760]` **o** eliminarlo usando `fetchLatestBaileysVersion` como único fallback. **5.3** Sustituir `...globalVendorArgs` por una **allowlist** de opciones de socket. **5.4** (Opcional) exponer `Browsers.android` como opción documentada (experimental, habilita view-once). |
| Aceptación | `pnpm install` limpio, build y tests verdes. Smoke manual: conexión por QR **y** por pairing code; envío texto/imagen/documento; recepción DM; reinicio tras `loggedOut`. |
| Pruebas | Suite del paquete + `pnpm run build` raíz. Smoke manual documentado en el PR. |
| Riesgo | Medio (dependencia de red/protocolo). Mitigación: fase aislada y revertible; rc14 es patch sobre rc13. |
| Rollback | Volver a `rc13` en `package.json` + lock |

---

### Fase 6 — Resiliencia de reconexión

| Campo | Detalle |
|---|---|
| Objetivo | Reconexión robusta y sin peleas entre instancias |
| Cubre | H11 |
| Archivos | `src/bailey.ts`, `__tests__/baileysReliability.test.ts` |
| Cambios | **6.1** Guard `reconnecting` para no apilar timers. **6.2** No reconectar en `connectionReplaced` (dos instancias) — emitir `auth_failure` accionable. **6.3** Backoff con **jitter** y `maxReconnectAttempts`/`reconnectBaseDelayMs` configurables. **6.4** Reset de contadores también tras `connection: 'open'` estable (ya existe) y tras reconexión exitosa. **6.5** Detección de `device_removed` (patrón de `provider-sherpa`) para limpiar sesión. **6.6** (Opcional) health-check con `setInterval` + `unref` y cierre limpio. |
| Aceptación | Tests: no se programan dos reconexiones simultáneas; `connectionReplaced` no reintenta; backoff acotado con jitter determinista (mock de `Math.random`). Smoke: matar red y recuperar. |
| Pruebas | `baileysReliability.test.ts` extendido. |
| Riesgo | Medio. Mitigación: parámetros configurables con defaults conservadores. |
| Rollback | Revertir PR |

---

### Fase 7 — Observabilidad, docs y release

| Campo | Detalle |
|---|---|
| Objetivo | Cerrar con documentación y publicación |
| Cubre | H24 (limpieza), DX |
| Archivos | `README.md`, `CHANGELOG.md`, `package.json`, `docs/releases/*` |
| Cambios | **7.1** README: opciones (`captureProcessSignals`, `lidCache`, `reconnect*`), matriz de grupos, requisitos Node/pnpm. **7.2** CHANGELOG con las fases. **7.3** Notas de release en `docs/releases/`. **7.4** Limpiar `*_sessions`/logs locales y asegurar `.gitignore`. **7.5** Bump de versión y tag. |
| Aceptación | Docs revisadas; release notes publicadas; `pnpm run build:full` verde. |
| Pruebas | Checklist manual de docs + suite completa raíz. |
| Riesgo | Bajo |
| Rollback | N/A (documentación) |

---

## 5.3 Correcciones tras la revisión de Fases 0–1

Los commits iniciales `a750a1a5` y `b22c6cc8` no bastaban para aceptar las fases.
La revisión reprodujo eliminación de sesiones/claves, reinicio tras shutdown,
retorno prematuro de cierres concurrentes y respuestas QR sin finalizar.

Correcciones aplicadas, limitadas a estas fases:

- Workspace temporal propio por suite (`jest.environment.cjs`), sin glob de borrado en el cwd de la aplicación.
- Limpieza positiva de archivos `builderbot-temp-<id>.tmp`; todo el material de autenticación y los archivos desconocidos se preservan.
- `cleanupPromise` compartida; cancelación de timers de reconexión y limpieza de sesiones.
- Guards de cierre en arranque/eventos; espera de inicialización y reconexiones ya en curso.
- Espera del cierre asíncrono del socket, del servidor HTTP y del stream de logs.
- QR: headers después de `open`; error previo devuelve 404, error posterior destruye la respuesta.
- Tests de regresión con socket mockeado y servidor HTTP local real; suite sin `--forceExit`.

Esto no modifica el routing de Fase 2 ni actualiza Baileys. La validación local
no sustituye una prueba de conexión real con WhatsApp, prevista para Fase 5.

## 6. Puerta de calidad por fase (Definition of Done)

Una fase se considera cerrada cuando **todo** lo siguiente es cierto:

- [ ] Cambios limitados a los archivos declarados en la fase.
- [ ] `pnpm --filter @builderbot/provider-baileys test` verde (sin warnings de handles).
- [ ] Nuevos tests cubren cada hallazgo de la fase (uno por hallazgo como mínimo).
- [ ] `pnpm lint:check` y `pnpm format:check` verdes.
- [ ] `pnpm --filter @builderbot/provider-baileys build` OK si se tocó `src/`.
- [ ] PR con: hallazgo(s) cubierto(s), evidencia antes/después, riesgo y rollback.
- [ ] Sin cambios en `dist/**` a mano.

## 7. Matriz de trazabilidad

| Fase | Hallazgos | Tipo | Riesgo | Revertible |
|---|---|---|---|---|
| 0 | H24 | chore | Nulo | Sí |
| 1 | H1, H2, H4, H5, H9, H10 | fix | Medio | Sí |
| 2 | H3, H6, H7, H8, H12 | fix | Medio-alto | Sí |
| 3 | H13, H14, H15, H16 | fix | Bajo | Sí |
| 4 | H17, H18, H19, H20 | chore | Bajo | Sí |
| 5 | H21, H22, H23 | chore/feat | Medio | Sí |
| 6 | H11 | fix | Medio | Sí |
| 7 | H24, DX | docs | Bajo | N/A |

## 8. Riesgos globales y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Regresión en entrega de mensajes por Fase 2 | Media | Alto | Smoke manual en número de prueba + tests de dedupe/routing antes de merge |
| Romper apps embebidas por cambio de señales | Media | Alto | Flag `captureProcessSignals` (default conservador) + nota de migración |
| `rc14` introduce regresión upstream | Baja | Medio | Fase aislada; rollback a `rc13` en un commit |
| Cambios de lint rompen otros paquetes | Baja | Medio | Override acotado al paquete en `eslint.config.js` |
| Tests que consagran bugs (`getMessage {}`) | Alta | Bajo | Fase 0 los marca; Fase 2 los corrige |

## 9. Preguntas abiertas

1. **Grupos (bloqueante Fase 2)**: ¿opción A, B o C de §5.2?
2. **`captureProcessSignals`**: ¿default `false` (no tocar señales del host) o mantener comportamiento actual con flag para desactivar?
3. **LID sin resolución**: si un `@lid` no se puede mapear a PN, ¿emitir con `from=@lid` o descartar el mensaje?
4. **Alcance de Fase 4**: ¿se acepta quitar `sharp`/`jimp` del paquete (posible dependencia transitiva de consumidores que las importen de aquí)?

## 10. Aprobación

| Fase | Aprobada | Fecha | Notas |
|---|---|---|---|
| 0 | ☐ | | |
| 1 | ☐ | | |
| 2 | ☐ | | requiere §9.1 |
| 3 | ☐ | | |
| 4 | ☐ | | requiere §9.4 |
| 5 | ☐ | | |
| 6 | ☐ | | |
| 7 | ☐ | | |
