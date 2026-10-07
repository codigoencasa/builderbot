# Fase A — Llamadas WhatsApp: análisis 3-POV (verificado contra código)

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Fase | **A — "Cerrar el producto inbound"** (del plan `docs/audits/voice-calls-plan-2026-10-06.md`) |
| Ítems | A1 Barge-in · A2 DTMF · A3 Eventos de estado · A4 Saludo al conectar |
| Paquetes afectados | `provider-voice` (core de llamadas), `provider-meta`, `provider-voice-whatsapp` (paridad) |
| POV | Consumidor API · Maintainer · Operador + Veredicto |
| Método | Cada afirmación verificada con lectura de `src/` (líneas citadas) o documentación de Meta/360dialog citada |
| Qué NO cubre | Prueba live con llamada real (requiere WABA elegible) — marcado como **NV** |

---

## 0. Verificación previa (hechos confirmados en código)

1. **El playback ya es cancelable**: `pushFramesPaced` guarda `session.playbackCancel` y `releaseSession` lo invoca (`packages/provider-voice/src/calls/core.ts:630-705`). Falta **quién lo llama** al hablar el usuario.
2. **`SilenceSegmenter` no expone "speech start"**: tiene `hasSpeech` privado; `push()` solo devuelve el utterance al detectar silencio final (`packages/provider-voice/src/audio.ts:149-228`). El punto de entrada de frames es `wireAudioSink` → `sink.ondata` (`core.ts:490-552`).
3. **DTMF NO llega por webhook**: Meta lo inyecta como **RFC 4733 telephone-events dentro del stream RTP** del WebRTC ("*Specifically there is no webhook for conveying DTMF digits*", docs 360dialog inbound-calls, que citan a Meta).
4. **`@roamhq/wrtc@0.10.0` no expone DTMF**: sin `RTCDTMFSender` ni manejo de telephone-event en `lib/`/`types/` (grep vacío). **El transporte está bloqueado** para DTMF saliente por esa vía.
5. **`statuses` (RINGING/ACCEPTED/REJECTED) solo existen para llamadas business-initiated** (docs Meta/360dialog outbound). El webhook handler de `provider-meta` solo procesa `value.calls[]` con `connect|terminate` e **ignora `value.statuses`** (`packages/provider-meta/src/meta/core.ts:232-246`).
6. **El core solo emite `notice` y `message`** (`core.ts`); `provider-meta` wirea ambos en `busEvents` (`packages/provider-meta/src/meta/provider.ts:150-155, 312-341`). No hay evento "llamada activa" hacia la app.
7. **La transición a `Active`** ocurre en `onConnectionStateChange` y en el chequeo post-accept (`core.ts:199-200, 367`) — ese es el punto correcto para el saludo (media path ya abierto).

---

## A1. Barge-in / interrupción (callar al bot cuando el usuario habla)

| POV | Análisis |
|---|---|
| **Consumidor API** | Nueva opción `bargeIn?: boolean` en `IMetaCallCoreConfig` (y propagada por `provider-meta`/`provider-voice-whatsapp`). DX deseada: encendido por defecto con guardas anti-ruido; `bargeIn: false` para volver al comportamiento actual (bot termina su frase). Evento opcional `playback_interrupted` para que el flujo sepa que la respuesta quedó cortada (afecta a memoria del LLM: el historial no debe afirmar que se dijo todo). |
| **Maintainer** | Implementación acotada: (a) añadir callback `onSpeechStart` a `SilenceSegmenter` (fuego en transición `hasSpeech: false→true`, con debounce de N frames consecutivos no-silenciosos, p. ej. ~100 ms); (b) en `wireAudioSink.ondata`, si `bargeIn && session.playbackCancel`, invocarlo. Reusar `frameRms` ya existente. `flowDynamic` resuelve antes (el `finish()` de `pushFramesPaced`) → el flujo continúa sin hang. Tests: unit del segmenter (speech-start + debounce) + core (playback cancelado al llegar voz). |
| **Operador** | Riesgo real: **falsos positivos por ruido** (calle, viento) que cortan al bot constantemente. Mitigaciones: umbral `silenceThreshold` configurable + `bargeInMinSpeechMs` (default ~120 ms) + no cancelar si el utterance no supera `minUtteranceMs`. AEC del lado del llamante la hace el cliente WhatsApp (nuestro inbound track es solo el mic del usuario), así que el eco del bot **no** debería colarse; en altavoz con AEC pobre puede colarse → el debounce lo absorbe. Observabilidad: emitir `notice` `[BARGE] playback interrupted` para medir tasa en producción. |
| **Veredicto** | ✅ Hacer. Esfuerzo **M** (2–4 días con tests). Riesgo medio (falsos positivos), mitigable. Es el ítem de mayor impacto percibido de la fase. |

**Sorpresa a evitar:** cortar el audio sin avisar al flujo deja el historial del LLM inconsistente ("dije X" pero el usuario solo oyó la mitad). Solución: truncar/anotar el turno del asistente cuando se emite `playback_interrupted` (responsabilidad del dev vía evento, o helper futuro).

---

## A2. DTMF / IVR (tonos del teclado)

| POV | Análisis |
|---|---|
| **Consumidor API** | DX ideal: evento `dtmf` al bus (`adapterProvider.on('dtmf', ({ from, digit }) => ...)`) o como `message` con `body: '_event_dtmf_5'`. Con eso se arman menús IVR con flujos normales. **Pero hoy no es implementable sin spike.** |
| **Maintainer** | **Hallazgo bloqueante (verificado)**: DTMF llega como RFC 4733 *dentro* del RTP y **no hay webhook**; `@roamhq/wrtc@0.10.0` **no expone** telephone-events entrantes. Vías: (a) **in-band**: no negociar telephone-event en el SDP answer y detectar tonos en PCM con Goertzel (JS puro, duración 500 ms / gap 100 ms según Meta) — **depende de que Meta haga fallback a in-band cuando no se negocia telephone-event, lo cual NO está garantizado por la doc**; (b) **patchear/sustituir wrtc** para surfar telephone-events — esfuerzo alto y frágil; (c) **ruta SIP** (Fase B, P1.3): los stacks SIP manejan DTMF nativamente (RFC 4733 / SIP INFO). |
| **Operador** | Sin llamada real no se puede confirmar (a). Si el fallback in-band no existe, todo el trabajo de Goertzel es inútil. El riesgo NO es de código sino de **supuesto sobre el comportamiento de Meta**. |
| **Veredicto** | 🟡 **Spike primero (A2.0)**: prueba live de 1 día — ¿Meta envía in-band si no negociamos telephone-event? Si sí → **M** (Goertzel + evento). Si no → **diferir DTMF a Fase B** (vía SIP). **No comprometer DTMF en Fase A sin ese spike.** |

**Sorpresa a evitar:** asumir DTMF "porque Meta lo soporta" — lo soporta por RTP, y nuestro transporte (wrtc) no lo expone. Este es exactamente el tipo de sorpresa que este análisis busca eliminar.

---

## A3. Eventos de estado de llamada al flujo (`ringing/accepted/rejected/terminate`)

| POV | Análisis |
|---|---|
| **Consumidor API** | `adapterProvider.on('call_status', e => ...)` con `{ callId, from, status: 'RINGING'\|'ACCEPTED'\|'REJECTED'\|'TERMINATED', timestamp }`. Permite logging, UI de "llamando…", y lógica de negocio (p. ej. reintentar si REJECTED). |
| **Maintainer** | Implementación barata: (a) extender `WhatsAppCallValue` con `statuses?: WhatsAppCallStatus[]` (tipos en `calls/types.ts`); (b) en `provider-meta/core.ts:232` parsear `value.statuses` y re-emitir; (c) wirear en `busEvents` (provider.ts) + paridad en `provider-voice-whatsapp`. **Limitación honesta (verificada en doc Meta): los `statuses` solo llegan en llamadas business-initiated**; para inbound solo hay `connect`/`terminate`. Es decir, A3 tiene **poco valor standalone hoy** y su valor real se desbloquea con Fase B (salientes). El `terminate` de inbound sí puede mapearse a `TERMINATED` para cerrar el ciclo. |
| **Operador** | Aditivo puro; eventos ignorable. Cuidado de no romper el "siempre 200" del webhook. |
| **Veredicto** | ✅ Hacer como **plomería** (esfuerzo **S**), con la nota de que su payload completo llega con Fase B. Considerar **mover la parte `statuses` a Fase B** si queremos Fase A mínima; dejar ahora solo el evento `call_ended` (terminate). |

---

## A4. Saludo al conectar (greeting; el bot habla primero)

| POV | Análisis |
|---|---|
| **Consumidor API** | Patrón idiomático BuilderBot: el provider emite `call_active` → la app hace `bot.dispatch('CALL_GREETING', { from })` → un flujo `addKeyword(utils.setEvent('CALL_GREETING'))` saluda con `flowDynamic`. Alternativa más simple para el 80 %: opción de config `greetingMessage?: string` que el core sintetiza solo al activarse (sin flujo). |
| **Maintainer** | (a) El core emite `call_active` **en la transición a `Active`** (`core.ts:199-200, 367`), NO en `accept OK`: si se habla antes de que el media path esté abierto, el audio se pierde (el `source` ya existe ahí, verificado). Payload: `{ callId, from, to, direction }`. (b) Wirear en `busEvents` de ambos providers. (c) Race a vigilar: `publishAudio` exige `session.source` — en `Active` ya existe, OK. `greetingMessage` es un atajo de una línea que llama a `publishAudio`. |
| **Operador** | Sin greeting, el llamante oye silencio hasta que habla — se percibe como llamada rota. Con greeting, primer audio ≈ latencia TTS (~0,5–1,5 s). Medir con `notice` de timings. |
| **Veredicto** | ✅ Hacer. Esfuerzo **S** (1 día). Hacer **ambos**: evento `call_active` (flexible) + `greetingMessage` (DX). |

---

## Plan Fase A alineado (orden por valor/riesgo)

| Ola | Contenido | Paquetes | Riesgo | Esfuerzo |
|---|---|---|---|---|
| **A-W1** | A4 saludo (`call_active` + `greetingMessage`) + A3 plomería (`call_ended`/`call_status`) | `provider-voice`, `provider-meta`, `provider-voice-whatsapp` | Bajo | S |
| **A-W2** | A1 barge-in (`onSpeechStart` + `playbackCancel` + guardas anti-ruido) | `provider-voice` | Medio | M |
| **A-W3** | A2.0 **spike DTMF in-band** (prueba live) → Go/No-Go Goertzel | `provider-voice` | Alto (supuesto externo) | S |
| **A-W4** (condicional) | A2 DTMF Goertzel (solo si A-W3 = Go) | `provider-voice` | Medio | M |

## Registro de sorpresas eliminadas

1. ~~"DTMF es un webhook más"~~ → **No**: es RFC 4733 en RTP y wrtc no lo expone. → Spike obligatorio o SIP (Fase B).
2. ~~"Los eventos de estado llegan siempre"~~ → `statuses` solo en salientes; inbound solo `connect/terminate`.
3. ~~"Saludar al aceptar"~~ → debe ser al pasar a `Active` (media path abierto), si no el audio se pierde.
4. ~~"Barge-in = cancelar y ya"~~ → requiere debounce anti-ruido y evento `playback_interrupted` para coherencia del historial del LLM.

## Estado de implementación (A-W1 — ✅ 2026-10-07)

Implementado A4 + la plomería de A3 en `provider-voice`, `provider-meta` y `provider-voice-whatsapp`:

- **A4 — evento `call_active`**: se emite en la transición `Accepted → Active` (un único `activateCall()` invocado desde el handler de ICE y desde el chequeo post-accept, de modo que dispara **una sola vez** y sólo cuando el media path está abierto). Payload: `{ callId, from, to, direction }`.
- **A4 — `greetingMessage`**: opción de config nueva; si está presente, el core sintetiza y envía el saludo al activarse la llamada (fire-and-forget con `notice` si falla el TTS). Disponible en `provider-meta` y en `provider-voice-whatsapp`.
- **A3 — evento `call_ended`**: se emite en `onTerminate` con `{ callId, from }` (idempotente: no se repite si `terminate` llega dos veces).
- **A3 — evento `call_status`**: parseo de `value.statuses` (`RINGING`/`ACCEPTED`/`REJECTED`) en el webhook de ambos providers, con el tipo `WhatsAppCallStatus` añadido al modelo del webhook. *(Su valor completo llega con Fase B: en inbound solo hay `connect`/`terminate`.)*

**Bug encontrado por los tests**: en `provider-voice-whatsapp` el handler hacía `continue` cuando `calls` venía vacío, así que los `statuses` nunca se procesaban. Corregido (guard sobre `change.value` + `calls ?? []`).

**Tests**: +8 en `provider-voice` (activación por ICE, por chequeo post-accept, no-duplicado, saludo configurado/no configurado, `call_ended` presente/desconocido/no-duplicado), +1 en `provider-meta`, +2 en `provider-voice-whatsapp`. Mutation-check verificado en el saludo (falla si se desactiva).

**Uso desde la app**:

```ts
adapterProvider.on('call_active', ({ from }) => bot.dispatch('CALL_GREETING', { from }))
adapterProvider.on('call_ended', ({ callId }) => console.info('call ended', callId))
```

## Aceptación live — NV (pendiente)

- [ ] NV1: barge-in en llamada real (hablar encima del bot → se calla y escucha). *(A-W2, no implementado aún)*
- [ ] NV2: saludo audible al atender (latencia medida).
- [ ] NV3: spike DTMF in-band (presionar dígitos → ¿llegan en PCM?). *(A-W3, no implementado aún)*
- [ ] NV4: `call_active` dispara una sola vez en llamada real y `call_ended` al colgar.

---

## Fuentes

- Repo: `packages/provider-voice/src/calls/{core,sdp,webrtc,types,meta-call-client}.ts`, `src/audio.ts`, `packages/provider-meta/src/meta/{core,provider}.ts`, `packages/provider-voice-whatsapp/src/whatsapp-voice/provider.ts`.
- Meta/360dialog — DTMF por RFC 4733 sin webhook: `https://docs.360dialog.com/docs/messaging/calling/inbound-calls` ("DTMF Support (Optional)").
- Meta/360dialog — `statuses` solo business-initiated: `https://docs.360dialog.com/docs/messaging/calling/outbound-calls`.
- Plan madre: `docs/audits/voice-calls-plan-2026-10-06.md` (Fase A = P0.2 + P0.4 + P1.1 + P1.2).
