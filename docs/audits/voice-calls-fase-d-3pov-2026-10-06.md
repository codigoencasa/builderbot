# Fase D — Llamadas WhatsApp: análisis 3-POV (verificado contra código)

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Fase | **D — "Operación y confianza"** (del plan `docs/audits/voice-calls-plan-2026-10-06.md`) |
| Ítems | D1 Grabación + transcripción persistida · D2 Concurrencia + métricas/observabilidad · D3 Simulador de llamadas · D4 Analytics (resumen/sentimiento/KPIs) |
| Paquetes afectados | `provider-voice` (core), `provider-meta`, posible `manager` (rate-limit), DB adapters |
| POV | Consumidor API · Maintainer · Operador + Veredicto |
| Qué NO cubre | Cumplimiento legal específico por jurisdicción (se señala, no se resuelve) |

---

## 0. Verificación previa (hechos confirmados en código)

1. **El audio ya llega al flujo**: cada utterance emite `message` con `ctx.audio` (PCM 16-bit mono) + `ctx.sampleRate` + transcript en `ctx.body` (`calls/core.ts:567-598`, `WhatsAppVoicePayload` en `calls/types.ts:180-193`). **Nada se persiste automáticamente**.
2. **`saveFile` existe pero es manual**: `provider-voice-whatsapp` guarda WAV desde `ctx.audio` (provider.ts:~250); `provider-meta` tiene `saveFile` para media de mensajes (`provider.ts:234`) — no cableado a llamadas.
3. **Cero métricas**: grep `metrics|prometheus|counter|histogram` en `provider-voice/src` y `bot/src` → **vacío**. Solo hay `notice` con timings sueltos.
4. **Cero límites de concurrencia propios**: el core acepta sesiones sin tope (`sessions: Map`, `core.ts:93`). El límite de Meta (1.000/WABA) se descubriría a las malas (llamada rechazada sin webhook específico).
5. **Tests 100% mockeados**: `calls-core.test.ts` mockea `webrtc`, `MetaCallClient` y `SilenceSegmenter` completos. No existe ningún arnés que meta audio sintético por el pipeline ni mida latencia.
6. **`@builderbot/manager` existe** (multi-tenant: `bot-manager`, `rate-limiter`, `persistence`, `api`) — patrón reutilizable para cap de concurrencia, aunque hoy no toca llamadas.
7. **Las DB adapters ya persisten historial de mensajes** (los `message` de voz quedan guardados como mensajes normales si `disableCapture`/saveHistory lo permite) — o sea el **transcript ya se guarda gratis** vía history; lo que falta es audio + vínculo por `callId`.

---

## D1. Grabación + transcripción persistida

| POV | Análisis |
|---|---|
| **Consumidor API** | Opt-in por config: `recording: { enabled: true, dir: './recordings' }` → WAV por llamada (concatenar utterances del segmenter, que es exactamente el audio del llamante; el lado del bot = TTS, guardable aparte). Transcript: emitir `call_transcript` por utterance con `{ callId, from, body, at }` y/o persistirlo ligado al `callId`. |
| **Maintainer** | Implementación acotada: en `enqueueUtterance`/`handleUtterance` ya está el PCM — añadir un `CallRecorder` por sesión (append PCM → WAV al `onTerminate`, reusar `pcmToWav` de `audio.ts:22`). Vincular por `callId` (hoy el payload usa `from` = teléfono; añadir `ctx.callId` para correlación). **No** meter storage cloud en la lib (disco local + hook `onRecordingReady(path)` para que el dev suba a S3/GCS). Tests: recorder unit + integración con core mockeado. |
| **Operador** | **Legal**: grabar llamadas exige consentimiento en muchas jurisdicciones → el saludo (A4) es el lugar natural del aviso; documentarlo. Disco: PCM 16 kHz mono ≈ 1,9 MB/min por lado → rotación/retención es del dev (documentar). Privacidad: transcripts = PII → cifrado en reposo queda fuera de scope (del deploy). |
| **Veredicto** | ✅ Hacer. Esfuerzo **M**. Prerequisito menor: añadir `callId` al payload (S). Riesgo bajo, valor enterprise alto (compliance/QA). |

---

## D2. Concurrencia + métricas / observabilidad

| POV | Análisis |
|---|---|
| **Consumidor API** | Config `maxConcurrentCalls?: number` (defensivo, p. ej. 50; el límite duro de Meta es 1.000/WABA) → al superarlo, `reject` limpio + evento `call_rejected { reason: 'concurrency' }`. Métricas: **no meter Prometheus en la lib**; emitir evento `call_metrics` al terminar: `{ callId, durationMs, turns, interruptions, sttLatencyMs[], ttsLatencyMs[], firstAudioMs }` — el dev lo manda a su stack (Prom/Datadog/OTel). |
| **Maintainer** | Los timings ya se emiten como `notice` sueltos → recolectarlos en la sesión (barato) y emitir el resumen en `releaseSession`/`onTerminate`. Cap de concurrencia: check en `onConnect` antes de crear PC (fail-fast, antes de gastar ICE/pre_accept). Patrón de rate-limiter ya existe en `manager` (referencia, no dependencia). Tests: cap + shape del evento. |
| **Operador** | Lo que se rompe en producción sin esto: (a) pico de llamadas → OOM/latencia sin señal; (b) imposible medir SLA de voz; (c) el límite 1.000 de Meta llega sin aviso. Con el evento `call_metrics` se responde "¿cuánto tarda el bot?" con datos, no con sensaciones. |
| **Veredicto** | ✅ Hacer. Esfuerzo **S–M**. Bajo riesgo, es requisito de compra enterprise. |

---

## D3. Simulador de llamadas (testkit)

| POV | Análisis |
|---|---|
| **Consumidor API** | Como dev de bots de voz quiero probar mi flujo **sin llamada real**: `simulateCall({ audio: 'hola.wav' })` → corre el pipeline (segmenter→STT mockeado o real→flujo→TTS) y me devuelve transcript + latencias + eventos. Base para CI de bots de voz y para nuestra propia evaluación de calidad (tipo Cekura, pero interno). |
| **Maintainer** | Hoy los tests mockean TODO el core (verificado) → no hay regresión de pipeline real. El simulador vive como testkit interno primero (`__tests__/helpers/call-simulator`): inyectar frames PCM desde WAV al camino de `wireAudioSink` (fake timers para pacing), STT/TTS mockeados deterministas, y asserts sobre eventos. Publicarlo como `@builderbot/testing` = decisión aparte. |
| **Operador** | Sin esto, cada cambio de Fase A/B/C se valida "a mano" con llamadas reales (caro, lento, no repetible). Con esto, NV1-NV4 de las fases anteriores se convierten en checks automáticos parciales (la parte live real sigue siendo NV). |
| **Veredicto** | ✅ Hacer **interno** en Fase D. Esfuerzo **M**. Es el habilitador de confianza para todo lo demás. Publicar como paquete → evaluar después. |

---

## D4. Analytics por llamada (resumen, sentimiento, KPIs)

| POV | Análisis |
|---|---|
| **Consumidor API** | Al terminar: `call_summary { callId, from, durationMs, turns, transcript }` → el dev hace post-proceso LLM (resumen/sentimiento) o usa un helper opcional `summarizeCall(transcript, llm)`. KPIs: duración media, tasa de contención (¿resolvió el bot?), transferencias (cuando exista B4). |
| **Maintainer** | Mantener la lib **delgada**: emitir datos (D2 + D1) y como mucho un helper puro `summarizeCall` (función, no servicio). No acoplar a un LLM concreto. El "contención" la define el dev (marcador en el flujo, p. ej. `state.update({ resolved: true })`). |
| **Operador** | Coste: el post-proceso LLM por llamada es opt-in (tokens). Almacenamiento: transcript ya vive en history (DB); el resumen es un campo más. |
| **Veredicto** | ✅ Hacer `call_summary` + helper puro (**S–M**). Dashboards/BI fuera de scope. |

---

## Plan Fase D alineado (orden por valor/riesgo)

| Ola | Contenido | Depende de | Riesgo | Esfuerzo |
|---|---|---|---|---|
| **D-W1** | `callId` en payload + D2 (`call_metrics`, `maxConcurrentCalls`, `call_rejected`) | A-W1 | Bajo | S–M |
| **D-W2** | D1 recorder (`CallRecorder` + `onRecordingReady`) + doc legal/consentimiento en saludo (A4) | A-W1 | Bajo | M |
| **D-W3** | D3 simulador interno (WAV→pipeline, fake timers, asserts de latencia) | A/B/C según qué se valide | Medio | M |
| **D-W4** | D4 `call_summary` + helper `summarizeCall` | D-W2 | Bajo | S–M |

## Registro de sorpresas eliminadas

1. ~~"Hay que construir persistencia de transcripts"~~ → el transcript **ya se guarda** vía history de la DB; lo que falta es **audio** y la **correlación por `callId`** (hoy el payload solo trae `from`).
2. ~~"Métricas = meter Prometheus"~~ → anti-patrón en una lib; emitir **eventos** (`call_metrics`) y que el dev enchufe su stack.
3. ~~"El límite de Meta se gestiona solo"~~ → 1.000/WABA llega **sin webhook específico** (el usuario ve error genérico); cap local + `reject` limpio es la defensa.
4. ~~"Grabar es un detalle técnico"~~ → es un tema **legal** (consentimiento) además de técnico; el aviso va en el saludo (A4), y disco/retención/cifrado son del deploy, no de la lib.
5. ~~"Los tests actuales cubren el pipeline"~~ → están **100% mockeados**; sin simulador, cada fase se valida a mano y sin repetibilidad.
6. ~~"Analytics = feature grande"~~ → con `call_metrics` + `call_summary` emitidos, el 80% del valor es del dev con un LLM; la lib se mantiene delgada.

## Aceptación live — NV (pendiente)

- [ ] NV1: llamada real grabada → WAV reproducible + transcript correlacionado por `callId`.
- [ ] NV2: `call_metrics` con latencias reales (p50/p95) tras Fase C.
- [ ] NV3: cap de concurrencia: N+1 llamadas simultáneas → la N+1 recibe `reject` + evento, sin degradar las activas.
- [ ] NV4: simulador reproduce una conversación enlatada end-to-end en CI (< 1 min).

---

## Fuentes

- Repo: `packages/provider-voice/src/calls/core.ts` (sessions:93, payload:567-598), `src/calls/types.ts:180-193` (`WhatsAppVoicePayload`), `src/audio.ts:22` (`pcmToWav`), `packages/provider-voice-whatsapp/src/whatsapp-voice/provider.ts` (saveFile), `packages/provider-meta/src/meta/provider.ts:234` (saveFile), `packages/manager/src/rate-limiter.ts` (patrón), `packages/provider-voice/__tests__/calls-core.test.ts` (mocks completos).
- Límite 1.000/WABA y error genérico al superarlo: `https://docs.360dialog.com/docs/messaging/calling`.
