# Scorecard — `provider-baileys` (2026-10-05)

| Field | Value |
|---|---|
| Commit auditado | `c8d2ed59` (rama `fix/baileys-phase-1-lifecycle`) |
| Alcance | Fases 0–1 corregidas + contraste con 63 issues upstream (05-jul → 05-oct 2026) |
| Evidencia | 197/197 tests (7 suites), `--detectOpenHandles`, cobertura 81.24% líneas / 70.64% ramas |
| Reproducciones locales | `/tmp/baileys-score-repro.log`, `/tmp/baileys-media-stream-probe.log` |
| Grafo AST | 106 nodos / 211 aristas (`/tmp/builderbot-baileys-score-graph`) |
| Qué NO cubre | Emparejamiento real con WhatsApp (sin sesión real usada) |

## Método de puntuación

7 dimensiones × 5 checks. Cada check: **0** = ausente/fallo conocido · **0.5** = parcial o test limitado · **1** = verificado en contrato acotado. Pesos: lifecycle 20, QR 15, mensajes 20, LID 15, media 15, observabilidad 10, paquete 5. La aceptación con WhatsApp real va aparte como **NV** (no verificada), no como fallo.

## Resultado

| Dimensión | Subtotal | Peso | Puntos |
|---|---|---|---|
| 1. Lifecycle / shutdown | 4.5 / 5 | 20 | 18.0 |
| 2. QR / conexión | 2.0 / 5 | 15 | 6.0 |
| 3. Routing de mensajes | 1.5 / 5 | 20 | 6.0 |
| 4. Caché LID | 2.5 / 5 | 15 | 7.5 |
| 5. Media / descarga | 1.5 / 5 | 15 | 4.5 |
| 6. Observabilidad / tests | 1.0 / 5 | 10 | 2.0 |
| 7. Paquete / tipos / deps | 2.5 / 5 | 5 | 2.5 |
| **TOTAL** | | **100** | **≈ 46.5 / 100** |

> Interpretación: es madurez de evidencia, no probabilidad de fallo. Las fases 0–1 (lifecycle) están sólidas; las fases 2–5 del RFC 0002 concentran la deuda restante.

### Aceptación live (WhatsApp) — NV

- [ ] NV1 QR real escaneado → `connection: 'open'`
- [ ] NV2 Envío/recepción de texto
- [ ] NV3 Envío/recepción de media
- [ ] NV4 Reinicio con credenciales persistidas (sin re-escanear)
- [ ] NV5 Reconexión tras pérdida de red

## Detalle por dimensión

### 1. Lifecycle / shutdown — 4.5/5

- [x] 1.1 Sin `removeAllListeners` global; señales opt-in (`captureProcessSignals: false`)
- [x] 1.2 `destroy()` idempotente y concurrente (`cleanupPromise` compartida)
- [x] 1.3 Timers cancelables (reconnect, session cleanup, housekeeping) con `unref()`
- [x] 1.4 Espera de `initPromise`/`reconnectTask`/`vendor.end()`/flush LID/HTTP/log stream
- [ ] 1.5 Sin prueba contra `socket.end()` real de Baileys (mockeado)

### 2. QR / conexión — 2/5

- [x] 2.1 HTTP: headers tras `open`; 404 pre-headers; destroy post-headers; cierre real del listener
- [ ] 2.2 Sin cobertura de los handlers `qr`/`open`/`loggedOut` (bailey.ts:485–550 sin ejecutar)
- [ ] 2.3 Pairing: `requestPairingCode(rawPhone)` ignora `phoneNumberClean`; listeners se adjuntan tras el await
- [ ] 2.4 Fallback hardcodeado `[2,3000,1025190524]` obsoleto (upstream: 405/408 por versión)
- [ ] 2.5 `loggedOut` borra el directorio de auth y reintenta automáticamente

### 3. Routing de mensajes — 1.5/5

- [ ] 3.1 `getMessage` devuelve `{}` en miss (reproducido) — Baileys cree que encontró el mensaje
- [ ] 3.2 Solo se cachean mensajes entrantes; tras `sendMessage` propio, el miss devuelve `{}`
- [ ] 3.3 Dedupe roto: 3 mensajes idénticos emiten 2 eventos (resetea el array al detectar)
- [ ] 3.4 LID sin `remoteJidAlt` fabrica PN numérico (reproducido: `999000123456789@lid` → `999000123456789`)
- [ ] 3.5 `groupsIgnore:false` no habilita grupos (0 eventos con `@g.us`); gate §5.2 del RFC pendiente

### 4. Caché LID — 2.5/5

- [x] 4.1 HybridLidCache normaliza PN y persiste con permisos 0600
- [x] 4.2 Flush concurrente deduplicado; close espera load + flush final
- [ ] 4.3 `MemoryLidCache.set` no normaliza PN (reproducido: devuelve `+1 (555) 000-0001` crudo)
- [ ] 4.4 `MemoryLidCache.close()` es no-op y deja `checkTimeout` vivo (reproducido)
- [ ] 4.5 Flush re-sellado: escribir una entrada avanza el `ts` de todas (TTL de archivo inútil); `compact()` delega en `flushToDisk()` bajo `flushing=true`

### 5. Media / descarga — 1.5/5

- [ ] 5.1 `saveFile` llama `downloadMediaMessage(ctx,'buffer',{})` sin `ctx` → reupload 410/404 nunca se dispara (upstream #2767)
- [ ] 5.2 Stream cortado: reproducido en rc13 instalado — `uncaughtException: TypeError: terminated` y consumidor colgado (upstream #2750)
- [x] 5.3 `sendImage/sendVideo/sendAudio/sendFile` cubiertos por tests unitarios
- [ ] 5.4 Sin `waitForSocketOpen()` antes de enviar media (carrera en socket CONNECTING, upstream #2821)
- [ ] 5.5 Sin reintentos/timeout propios en descarga

### 6. Observabilidad / tests — 1/5

- [x] 6.1 197 tests verdes, suites aisladas en cwd temporal, sin `--forceExit`
- [ ] 6.2 Logger de Baileys en `fatal`: errores de descifrado (Bad MAC, No session) invisibles en producción
- [ ] 6.3 Sin métricas/contadores de eventos (reconnects, acks, errores por código)
- [ ] 6.4 Sin healthcheck del socket ni del buffer offline (upstream #2810)
- [ ] 6.5 Sin alerta de versión WA obsoleta en runtime

### 7. Paquete / tipos / deps — 2.5/5

- [x] 7.1 Build cjs+mjs+d.ts verde; `jest-environment-node` con lockfile mínimo (3 líneas)
- [ ] 7.2 Tipos re-exportados como valores (`proto`, `WAVersion`, `WABrowserDescription`) — rompe `verbatimModuleSyntax`
- [ ] 7.3 5 deps de runtime sin uso (`keyed-db`, `cheerio`, `fluent-ffmpeg`, `jimp`, `sharp`)
- [ ] 7.4 `BaileyGlobalVendorArgs` no exportado desde `index.ts`
- [x] 7.5 `import type` usado en código nuevo; `isolatedModules` aún no forzado

## To-do priorizado

### P0 — bloquea confianza en producción

- [x] **T1** `getMessage` → `undefined` en miss + cachear mensajes salientes (Fase 2, H3) — *hecho en `fix/baileys-phase-2-messaging`*
- [x] **T2** Dedupe con `Map` + TTL 5 min / 5k entradas; sin reset completo (Fase 2, H8) — *hecho*
- [x] **T3** LID sin alt: conserva `@lid`, nunca fabrica PN; se emite con `from=@lid` (Fase 2, H7; default de RFC §9.3) — *hecho*
- [x] **T4** `sendMessage` con `options` undefined: `{ ...(options ?? {}), ...(options?.options ?? {}) }` (H12) — *hecho*
- [x] **T5** Media: `saveFile` pasa `ctx` con `reuploadRequest` (upstream #2767) — *hecho*; el stream roto de rc13 (#2750) es upstream, sin parche en `node_modules`

### P1 — riesgo alto, esfuerzo medio

- [x] **T6** Pairing: número digits-only en `requestPairingCode`; listeners antes del await; guards de shutdown — *hecho en `fix/baileys-phase-6-resilience`*
- [x] **T7** `loggedOut` preserva auth y emite `auth_failure`; wipe solo con `clearAuthOnLogout: true` — *hecho*
- [x] **T8** 440 → `auth_failure` sin reconexión; backoff con jitter ±20% (Fase 6, H11) — *hecho*
- [x] **T9** Fallback hardcodeado actualizado a `[2,3000,1043857760]` (rc14); cadena live→repo→hardcode (H21) — *hecho*
- [x] **T10** `baileysLogLevel` configurable, default `'error'` (Bad MAC visible) — *hecho*; contadores por código quedan para Fase 7

### P2 — deuda estructural

- [x] **T11** `lidCache`: PN normalizado en `MemoryLidCache`, `close()` libera el timer, TTL real por entrada (`entryTs`), `compact()` reescribe de verdad (Fase 3, H13–H16) — *hecho en `fix/baileys-phase-3-4-hygiene`*
- [x] **T12** Tipos: `import type`/`export type` en wrapper/type, `isLidUser` fuera de bailey.ts, `BaileyGlobalVendorArgs` exportado (H17–H20) — *hecho*
- [x] **T13** Deps retiradas (`keyed-db`, `cheerio`, `jimp`, `@ffmpeg-installer/ffmpeg`); `@types/polka` a dev — *hecho*.
  **Corrección posterior:** `sharp` y `fluent-ffmpeg` se **conservan**: `dist/index.cjs`
  incluye `@builderbot/bot` y los requiere en runtime; quitarlos rompía la carga
  del paquete (detectado con el probe fuera del workspace, POV consumidor)
- [x] **T14** Handlers `qr`/`open`/`loggedOut`/440 cubiertos; cobertura total 81.24→85.58 líneas, bailey.ts 79→84.89 — *hecho*
- [x] **T15** Gate de grupos: **opción C** elegida — `allowGroups` (default `false`), `from` = JID del grupo, `participant`/`sender` con el autor, precedencia sobre `groupsIgnore` solo para grupos — *hecho en `fix/baileys-phase-2-groups`*

### P3 — validación externa

- [ ] **T16** Smoke live NV1–NV5 con sesión aislada (requiere escaneo del usuario)
- [ ] **T17** Upgrade a `rc14` + evaluar PR upstream #2765 (companion_reg_refresh) cuando se fusione
- [ ] **T18** Evaluar mitigación para fuga ALS upstream (#2806/#2807) en despliegues multi-sesión

## Vinculación con RFC 0002

| To-do | Fase RFC | Hallazgos |
|---|---|---|
| T1–T4 | Fase 2 | H3, H7, H8, H12 |
| T5 | Fase 2/5 | upstream #2750, #2767 |
| T6–T8 | Fase 6 | H11 + revisión pairing |
| T9, T17 | Fase 5 | H21, H23 |
| T11 | Fase 3 | H13–H16 |
| T12–T13 | Fase 4 | H17–H20 |
| T15 | Gate §5.2 | H6 |
| T16, T18 | Fase 5/6 | aceptación live |
